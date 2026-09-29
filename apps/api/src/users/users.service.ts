import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE, type SqlDatabase } from '../db/database.js';
import { AuthService } from '../auth/auth.service.js';
import { writeAudit } from '../shared/audit.js';
import type { AuthActor } from '../shared/security.js';
import type { CreateSystemAdminDto, CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.dto.js';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  status: string;
  role_code: string;
  role_name: string;
  college_id: string | null;
  college_name: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

const userSelect = `u.id, u.email, u.full_name, u.status, r.code AS role_code,
  r.name AS role_name, c.id AS college_id, c.name AS college_name,
  u.created_at, u.last_login_at`;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async list(actor: AuthActor, query: ListUsersQuery) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (actor.collegeId) {
      values.push(actor.collegeId);
      conditions.push(`m.college_id = $${values.length}`);
    } else if (!actor.isSuperAdmin) {
      throw new ForbiddenException('College membership is required.');
    }
    if (query.status) {
      values.push(query.status);
      conditions.push(`u.status = $${values.length}`);
    }
    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      conditions.push(`(u.full_name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM users u JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       JOIN roles r ON r.code = m.role_code LEFT JOIN colleges c ON c.id = m.college_id ${where}`,
      values,
    );
    values.push(query.limit, (query.page - 1) * query.limit);
    const rows = await this.database.query<UserRow>(
      `SELECT ${userSelect}
       FROM users u JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       JOIN roles r ON r.code = m.role_code LEFT JOIN colleges c ON c.id = m.college_id ${where}
       ORDER BY u.created_at DESC, u.id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      data: rows.rows.map(toUser),
      pagination: { page: query.page, limit: query.limit, total: Number(count.rows[0]?.count ?? 0) },
    };
  }

  async create(dto: CreateUserDto, actor: AuthActor) {
    const collegeId = actor.isSuperAdmin ? (actor.collegeId ?? dto.collegeId ?? null) : actor.collegeId;
    if (!collegeId) throw new BadRequestException('Select a college before creating a college member.');
    if (!actor.isSuperAdmin && dto.collegeId && dto.collegeId !== actor.collegeId) {
      throw new ForbiddenException('College access is not available.');
    }
    const college = await this.database.query<{ id: string }>(
      `SELECT id FROM colleges WHERE id = $1 AND status = 'active'`,
      [collegeId],
    );
    if (!college.rows[0]) throw new NotFoundException('College not found.');

    const id = randomUUID();
    try {
      await this.database.transaction(async (executor) => {
        await executor.query(
          `INSERT INTO users (id, email, full_name, status)
           VALUES ($1, lower($2), $3, 'invited')`,
          [id, dto.email.trim(), dto.fullName.trim()],
        );
        await executor.query(
          `INSERT INTO memberships (id, user_id, college_id, role_code)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), id, collegeId, dto.roleCode],
        );
        await writeAudit(executor, actor, 'user.invited', 'user', id, collegeId, { roleCode: dto.roleCode });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('An account with this email already exists.');
      throw error;
    }

    await this.authService.requestPasswordReset(dto.email);
    const result = await this.database.query<UserRow>(
      `SELECT ${userSelect}
       FROM users u JOIN memberships m ON m.user_id = u.id
       JOIN roles r ON r.code = m.role_code JOIN colleges c ON c.id = m.college_id
       WHERE u.id = $1 AND m.college_id = $2`,
      [id, collegeId],
    );
    return { data: { ...toUser(result.rows[0]), invitationSent: true } };
  }

  async createSystemAdmin(dto: CreateSystemAdminDto, actor: AuthActor) {
    const id = randomUUID();
    try {
      await this.database.transaction(async (executor) => {
        await executor.query(
          `INSERT INTO users (id, email, full_name, status)
           VALUES ($1, lower($2), $3, 'invited')`,
          [id, dto.email.trim(), dto.fullName.trim()],
        );
        await executor.query(
          `INSERT INTO memberships (id, user_id, college_id, role_code)
           VALUES ($1, $2, NULL, 'super_admin')`,
          [randomUUID(), id],
        );
        await writeAudit(executor, actor, 'system_admin.invited', 'user', id, null);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('An account with this email already exists.');
      throw error;
    }

    await this.authService.requestPasswordReset(dto.email);
    return {
      data: {
        id,
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName.trim(),
        role: { code: 'super_admin', name: 'Super Admin' },
        status: 'invited',
        invitationSent: true,
      },
    };
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthActor) {
    if (dto.fullName === undefined && dto.roleCode === undefined) {
      throw new BadRequestException('Provide at least one field to update.');
    }
    if (dto.roleCode && !actor.collegeId) {
      throw new BadRequestException('Select a college to update a user role.');
    }

    return this.database.transaction(async (executor) => {
      const values: unknown[] = [id];
      let membershipScope = '';
      if (actor.collegeId) {
        values.push(actor.collegeId);
        membershipScope = `AND m.college_id = $${values.length}`;
      }
      const target = await executor.query<{ id: string; college_id: string | null; role_code: string }>(
        `SELECT u.id, m.college_id, m.role_code
         FROM users u LEFT JOIN memberships m ON m.user_id = u.id
         WHERE u.id = $1 ${membershipScope} LIMIT 1 FOR UPDATE OF u`,
        values,
      );
      if (!target.rows[0]) throw new NotFoundException('User not found.');
      if (target.rows[0].role_code === 'super_admin') {
        throw new ForbiddenException('System administrator accounts cannot be changed here.');
      }

      if (dto.fullName !== undefined) {
        await executor.query('UPDATE users SET full_name = $1, updated_at = now() WHERE id = $2', [
          dto.fullName.trim(),
          id,
        ]);
      }
      if (dto.roleCode !== undefined) {
        await executor.query(
          `UPDATE memberships SET role_code = $1, updated_at = now()
           WHERE user_id = $2 AND college_id = $3 AND status = 'active'`,
          [dto.roleCode, id, actor.collegeId],
        );
      }
      await writeAudit(
        executor,
        actor,
        'user.updated',
        'user',
        id,
        target.rows[0].college_id,
        { fields: Object.keys(dto) },
      );
      const updated = await executor.query<UserRow>(
        `SELECT ${userSelect}
         FROM users u JOIN memberships m ON m.user_id = u.id
         JOIN roles r ON r.code = m.role_code LEFT JOIN colleges c ON c.id = m.college_id
         WHERE u.id = $1 ${actor.collegeId ? 'AND m.college_id = $2' : ''} LIMIT 1`,
        actor.collegeId ? [id, actor.collegeId] : [id],
      );
      return { data: toUser(updated.rows[0]) };
    });
  }

  async deactivate(id: string, actor: AuthActor) {
    return this.database.transaction(async (executor) => {
      if (actor.isSuperAdmin && !actor.collegeId) {
        if (id === actor.userId) throw new ForbiddenException('You cannot deactivate your own system administrator account.');
        const superAdmin = await executor.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM memberships m WHERE m.user_id = $1 AND m.role_code = 'super_admin'
           ) AS exists`,
          [id],
        );
        const target = await executor.query<{ id: string; status: string }>(
          `UPDATE users SET status = 'deactivated', deactivated_at = now(), updated_at = now()
           WHERE id = $1 AND status <> 'deactivated' RETURNING id, status`,
          [id],
        );
        if (!target.rows[0]) throw new NotFoundException('User not found.');
        await executor.query(`UPDATE memberships SET status = 'deactivated', updated_at = now() WHERE user_id = $1`, [id]);
        await executor.query(`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
        if (superAdmin.rows[0]?.exists) {
          const remainingAdmins = await executor.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM memberships m
             JOIN users u ON u.id = m.user_id
             WHERE m.role_code = 'super_admin' AND m.status = 'active' AND u.status = 'active'`,
          );
          if (Number(remainingAdmins.rows[0]?.count ?? 0) === 0) {
            throw new ConflictException('The last active Super Admin account cannot be deactivated.');
          }
        }
        await writeAudit(executor, actor, 'user.deactivated', 'user', id, null);
        return { data: { id, status: 'deactivated' } };
      }

      if (!actor.collegeId) throw new ForbiddenException('College membership is required.');
      const target = await executor.query<{ id: string; role_code: string }>(
        `SELECT u.id, m.role_code FROM users u
         JOIN memberships m ON m.user_id = u.id
         WHERE u.id = $1 AND m.college_id = $2 AND m.status = 'active' FOR UPDATE OF u`,
        [id, actor.collegeId],
      );
      if (!target.rows[0]) throw new NotFoundException('User not found.');
      if (target.rows[0].role_code === 'super_admin') {
        throw new ForbiddenException('System administrator accounts cannot be changed here.');
      }
      await executor.query(
        `UPDATE memberships SET status = 'deactivated', updated_at = now()
         WHERE user_id = $1 AND college_id = $2`,
        [id, actor.collegeId],
      );
      const remaining = await executor.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM memberships
         WHERE user_id = $1 AND status = 'active'`,
        [id],
      );
      if (Number(remaining.rows[0]?.count ?? 0) === 0) {
        await executor.query(
          `UPDATE users SET status = 'deactivated', deactivated_at = now(), updated_at = now() WHERE id = $1`,
          [id],
        );
        await executor.query(
          `UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
          [id],
        );
      }
      await writeAudit(executor, actor, 'user.membership_deactivated', 'user', id, actor.collegeId);
      return { data: { id, status: 'deactivated' } };
    });
  }
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    role: { code: row.role_code, name: row.role_name },
    college: row.college_id ? { id: row.college_id, name: row.college_name } : null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}