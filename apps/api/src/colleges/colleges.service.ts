import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE, type SqlDatabase } from '../db/database.js';
import { writeAudit } from '../shared/audit.js';
import type { AuthActor } from '../shared/security.js';
import type { CreateCollegeDto, ListCollegesQuery, UpdateCollegeDto } from './colleges.dto.js';

interface CollegeRow {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'deactivated';
  timezone: string;
  locale: string;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

const selectColumns = `id, name, code, status, timezone, locale, currency, created_at, updated_at`;

@Injectable()
export class CollegesService {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async list(query: ListCollegesQuery) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (query.status) {
      values.push(query.status);
      clauses.push(`status = $${values.length}`);
    }
    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      clauses.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM colleges ${where}`,
      values,
    );
    values.push(query.limit, (query.page - 1) * query.limit);
    const rows = await this.database.query<CollegeRow>(
      `SELECT ${selectColumns} FROM colleges ${where}
       ORDER BY created_at DESC, id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      data: rows.rows.map(toCollege),
      pagination: { page: query.page, limit: query.limit, total: Number(count.rows[0]?.count ?? 0) },
    };
  }

  async get(id: string) {
    const result = await this.database.query<CollegeRow>(
      `SELECT ${selectColumns} FROM colleges WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('College not found.');
    return { data: toCollege(result.rows[0]) };
  }

  async create(dto: CreateCollegeDto, actor: AuthActor) {
    const id = randomUUID();
    try {
      const result = await this.database.transaction(async (executor) => {
        const inserted = await executor.query<CollegeRow>(
          `INSERT INTO colleges (id, name, code, timezone, locale, currency)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${selectColumns}`,
          [id, dto.name.trim(), dto.code.toUpperCase(), dto.timezone ?? 'UTC', dto.locale ?? 'en', (dto.currency ?? 'USD').toUpperCase()],
        );
        await writeAudit(executor, actor, 'college.created', 'college', id, null, { code: dto.code.toUpperCase() });
        return inserted.rows[0];
      });
      return { data: toCollege(result) };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A college with this code already exists.');
      throw error;
    }
  }

  async update(id: string, dto: UpdateCollegeDto, actor: AuthActor) {
    const fields: Array<[keyof UpdateCollegeDto, string]> = [
      ['name', 'name'],
      ['code', 'code'],
      ['timezone', 'timezone'],
      ['locale', 'locale'],
      ['currency', 'currency'],
    ];
    const updates = fields.filter(([key]) => dto[key] !== undefined);
    if (updates.length === 0) throw new ConflictException('Provide at least one field to update.');
    const values: unknown[] = [id];
    const setClauses = updates.map(([key, column]) => {
      let value = dto[key];
      if (key === 'name' && typeof value === 'string') value = value.trim();
      if ((key === 'code' || key === 'currency') && typeof value === 'string') value = value.toUpperCase();
      values.push(value);
      return `${column} = $${values.length}`;
    });
    setClauses.push('updated_at = now()');

    try {
      return await this.database.transaction(async (executor) => {
        const result = await executor.query<CollegeRow>(
          `UPDATE colleges SET ${setClauses.join(', ')} WHERE id = $1 RETURNING ${selectColumns}`,
          values,
        );
        if (!result.rows[0]) throw new NotFoundException('College not found.');
        await writeAudit(executor, actor, 'college.updated', 'college', id, null, { fields: updates.map(([key]) => key) });
        return { data: toCollege(result.rows[0]) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A college with this code already exists.');
      throw error;
    }
  }

  async deactivate(id: string, actor: AuthActor) {
    return this.database.transaction(async (executor) => {
      const result = await executor.query<CollegeRow>(
        `UPDATE colleges SET status = 'deactivated', deactivated_at = now(), updated_at = now()
         WHERE id = $1 AND status <> 'deactivated' RETURNING ${selectColumns}`,
        [id],
      );
      if (!result.rows[0]) {
        const exists = await executor.query<{ id: string }>('SELECT id FROM colleges WHERE id = $1', [id]);
        if (!exists.rows[0]) throw new NotFoundException('College not found.');
        return { data: { id, status: 'deactivated' } };
      }
      await writeAudit(executor, actor, 'college.deactivated', 'college', id, null);
      await executor.query(
        `UPDATE memberships SET status = 'deactivated', updated_at = now()
         WHERE college_id = $1 AND status = 'active'`,
        [id],
      );
      await executor.query(
        `UPDATE auth_sessions s SET revoked_at = now()
         WHERE s.revoked_at IS NULL
           AND EXISTS (
             SELECT 1 FROM memberships m
             WHERE m.user_id = s.user_id AND m.college_id = $1 AND m.status = 'deactivated'
           )
           AND NOT EXISTS (
             SELECT 1 FROM memberships m
             LEFT JOIN colleges c ON c.id = m.college_id
             WHERE m.user_id = s.user_id AND m.status = 'active'
               AND (m.college_id IS NULL OR c.status = 'active')
           )`,
        [id],
      );
      return { data: toCollege(result.rows[0]) };
    });
  }
}

function toCollege(row: CollegeRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    timezone: row.timezone,
    locale: row.locale,
    currency: row.currency.trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}