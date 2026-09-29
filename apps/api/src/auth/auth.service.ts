import { randomBytes, randomUUID, createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import nodemailer from 'nodemailer';
import { DATABASE, type SqlDatabase } from '../db/database.js';
import { signSessionToken, type AuthActor } from '../shared/security.js';
import type { ChangePasswordDto, ResetPasswordDto } from './auth.dto.js';

const sessionDurationMs = 8 * 60 * 60 * 1000;
const resetDurationMs = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async login(email: string, password: string, userAgent?: string) {
    const result = await this.database.query<{
      id: string;
      email: string;
      full_name: string;
      password_hash: string | null;
      status: string;
    }>(
      `SELECT id, email, full_name, password_hash, status
       FROM users WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    const user = result.rows[0];
    const valid = user?.status === 'active' && user.password_hash
      ? await argon2.verify(user.password_hash, password)
      : false;
    if (!user || !valid) throw new UnauthorizedException('Email or password is incorrect.');

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + sessionDurationMs);
    const token = signSessionToken(sessionId, user.id, expiresAt);
    await this.database.transaction(async (executor) => {
      await executor.query(
        `INSERT INTO auth_sessions (id, user_id, expires_at, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, user.id, expiresAt, userAgent?.slice(0, 512) ?? null],
      );
      await executor.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [user.id]);
      await executor.query(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'auth.login', 'user', $2)`,
        [randomUUID(), user.id],
      );
    });

    const membershipResult = await this.database.query<{
      college_id: string | null;
      college_name: string | null;
      role_code: string;
      role_name: string;
    }>(
      `SELECT m.college_id, c.name AS college_name, r.code AS role_code, r.name AS role_name
       FROM memberships m
       JOIN roles r ON r.code = m.role_code
       LEFT JOIN colleges c ON c.id = m.college_id
       WHERE m.user_id = $1 AND m.status = 'active'
         AND (m.college_id IS NULL OR c.status = 'active')
       ORDER BY c.name NULLS FIRST`,
      [user.id],
    );

    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      memberships: membershipResult.rows.flatMap((membership) =>
        membership.college_id && membership.college_name
          ? [{
              collegeId: membership.college_id,
              collegeName: membership.college_name,
              roleCode: membership.role_code,
              roleName: membership.role_name,
            }]
          : [],
      ),
      isSuperAdmin: membershipResult.rows.some((membership) => membership.role_code === 'super_admin'),
    };
  }

  async logout(actor: AuthActor) {
    await this.database.transaction(async (executor) => {
      await executor.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
        [actor.sessionId, actor.userId],
      );
      await executor.query(
        `INSERT INTO audit_logs (id, actor_user_id, college_id, action, entity_type, entity_id)
         VALUES ($1, $2, $3, 'auth.logout', 'user', $2)`,
        [randomUUID(), actor.userId, actor.collegeId],
      );
    });
  }

  async requestPasswordReset(email: string) {
    const result = await this.database.query<{ id: string; email: string; status: string }>(
      `SELECT id, email, status FROM users WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    const user = result.rows[0];
    if (!user || user.status === 'deactivated') return;

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + resetDurationMs);
    await this.database.transaction(async (executor) => {
      await executor.query(
        'UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL',
        [user.id],
      );
      await executor.query(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, user.id, expiresAt],
      );
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    const resetUrl = `${webOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
    if (process.env.SMTP_URL && process.env.MAIL_FROM) {
      const transport = nodemailer.createTransport(process.env.SMTP_URL);
      await transport.sendMail({
        from: process.env.MAIL_FROM,
        to: user.email,
        subject: 'Reset your College Management password',
        text: `Use this link within 30 minutes to reset your password: ${resetUrl}`,
      });
    } else if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Password reset delivery is not configured.');
    } else {
      console.info(`Development password reset for ${user.email}: ${resetUrl}`);
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.database.transaction(async (executor) => {
      const result = await executor.query<{ user_id: string }>(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [tokenHash],
      );
      const token = result.rows[0];
      if (!token) throw new BadRequestException('This password reset link is invalid or expired.');

      await executor.query(
        `UPDATE users SET password_hash = $1, status = 'active', deactivated_at = NULL, updated_at = now()
         WHERE id = $2 AND status <> 'deactivated'`,
        [passwordHash, token.user_id],
      );
      await executor.query(
        'UPDATE password_reset_tokens SET consumed_at = now() WHERE token_hash = $1',
        [tokenHash],
      );
      await executor.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [token.user_id],
      );
    });
  }

  async changePassword(actor: AuthActor, dto: ChangePasswordDto) {
    const result = await this.database.query<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE id = $1 AND status = \'active\'',
      [actor.userId],
    );
    const passwordHash = result.rows[0]?.password_hash;
    if (!passwordHash || !(await argon2.verify(passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a password different from your current password.');
    }

    const nextHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.database.transaction(async (executor) => {
      await executor.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        nextHash,
        actor.userId,
      ]);
      await executor.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL',
        [actor.userId, actor.sessionId],
      );
      await executor.query(
        `INSERT INTO audit_logs (id, actor_user_id, college_id, action, entity_type, entity_id)
         VALUES ($1, $2, $3, 'auth.password_changed', 'user', $2)`,
        [randomUUID(), actor.userId, actor.collegeId],
      );
    });
  }
}