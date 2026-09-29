import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DATABASE, type SqlDatabase } from '../db/database.js';

const PUBLIC_ROUTE = 'public_route';
const REQUIRED_PERMISSIONS = 'required_permissions';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
let ephemeralSecret: Uint8Array | undefined;

export interface CollegeMembership {
  collegeId: string;
  collegeName: string;
  roleCode: string;
  roleName: string;
}

export interface AuthActor {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  isSuperAdmin: boolean;
  collegeId: string | null;
  collegeName: string | null;
  permissions: string[];
  memberships: CollegeMembership[];
}

export type AuthenticatedRequest = Request & { actor?: AuthActor };

export function getSessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && Buffer.byteLength(configured) >= 32) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured with at least 32 bytes in production.');
  }
  ephemeralSecret ??= randomBytes(32);
  return ephemeralSecret;
}

export function signSessionToken(sessionId: string, userId: string, expiresAt: Date) {
  const secret = getSessionSecret();
  const signature = createHmac('sha256', secret).update(`${sessionId}.${userId}.${expiresAt.getTime()}`).digest('base64url');
  return `${sessionId}.${userId}.${expiresAt.getTime()}.${signature}`;
}

function verifySessionToken(token: string) {
  const [sessionId, userId, expiryValue, signature, ...extra] = token.split('.');
  if (!sessionId || !userId || !expiryValue || !signature || extra.length) return undefined;
  const expiresAt = Number(expiryValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return undefined;
  const expected = createHmac('sha256', getSessionSecret())
    .update(`${sessionId}.${userId}.${expiresAt}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return undefined;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  return { sessionId, userId };
}

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const RequirePermission = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) throw new UnauthorizedException();
    return request.actor;
  },
);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (safeMethods.has(request.method)) return true;
    const cookieToken = request.cookies?.cms_csrf;
    const headerToken = request.get('x-csrf-token');
    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);
    if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
    return true;
  }
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.cms_session;
    const session = typeof token === 'string' ? verifySessionToken(token) : undefined;
    if (!session) throw new UnauthorizedException('Please sign in to continue.');

    const result = await this.database.query<{
      id: string;
      email: string;
      full_name: string;
      status: string;
    }>(
      `SELECT u.id, u.email, u.full_name, u.status
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
         AND s.expires_at > now() AND u.status = 'active'`,
      [session.sessionId, session.userId],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('Please sign in to continue.');

    const membershipsResult = await this.database.query<{
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
    const memberships = membershipsResult.rows;
    const superAdminMembership = memberships.find((membership) => membership.role_code === 'super_admin');
    const isSuperAdmin = Boolean(superAdminMembership);
    const requestedCollegeId = request.get('x-college-id')?.trim() || null;

    let selectedMembership = undefined as (typeof memberships)[number] | undefined;
    if (isSuperAdmin) {
      if (requestedCollegeId) {
        const collegeResult = await this.database.query<{ id: string; name: string }>(
          `SELECT id, name FROM colleges WHERE id = $1 AND status = 'active'`,
          [requestedCollegeId],
        );
        if (!collegeResult.rows[0]) throw new ForbiddenException('College access is not available.');
        selectedMembership = {
          college_id: collegeResult.rows[0].id,
          college_name: collegeResult.rows[0].name,
          role_code: 'super_admin',
          role_name: 'Super Admin',
        };
      } else {
        selectedMembership = superAdminMembership;
      }
    } else {
      const collegeMemberships = memberships.filter((membership) => membership.college_id !== null);
      if (requestedCollegeId) {
        selectedMembership = collegeMemberships.find((membership) => membership.college_id === requestedCollegeId);
        if (!selectedMembership) throw new ForbiddenException('College access is not available.');
      } else if (collegeMemberships.length === 1) {
        selectedMembership = collegeMemberships[0];
      } else if (collegeMemberships.length > 1) {
        throw new BadRequestException('Select a college using the X-College-Id header.');
      }
    }

    if (!selectedMembership) throw new ForbiddenException('An active college membership is required.');

    const permissionResult = await this.database.query<{ code: string }>(
      `SELECT rp.permission_code AS code
       FROM role_permissions rp
       WHERE rp.role_code = $1
       ORDER BY rp.permission_code`,
      [selectedMembership.role_code],
    );

    const actor: AuthActor = {
      userId: user.id,
      sessionId: session.sessionId,
      email: user.email,
      fullName: user.full_name,
      roleCode: selectedMembership.role_code,
      roleName: selectedMembership.role_name,
      isSuperAdmin,
      collegeId: selectedMembership.college_id,
      collegeName: selectedMembership.college_name,
      permissions: permissionResult.rows.map((permission) => permission.code),
      memberships: memberships.flatMap((membership) =>
        membership.college_id && membership.college_name
          ? [{
              collegeId: membership.college_id,
              collegeName: membership.college_name,
              roleCode: membership.role_code,
              roleName: membership.role_name,
            }]
          : [],
      ),
    };
    request.actor = actor;

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.some((permission) => !actor.permissions.includes(permission))) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}

let maintenanceCache: { enabled: boolean; expiresAt: number } | undefined;
let lastRateLimitCleanup = 0;

export function clearMaintenanceModeCache() {
  maintenanceCache = undefined;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== 'POST' || !['/auth/login', '/auth/forgot-password', '/auth/reset-password'].some((path) => request.path.endsWith(path))) {
      return true;
    }

    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const keyHash = createHmac('sha256', getSessionSecret())
      .update(`${request.path}:${address}`)
      .digest('hex');
    const result = await this.database.query<{ attempts: number }>(
      `INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts)
       VALUES ($1, now(), 1)
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts = CASE
           WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1
           ELSE auth_rate_limits.attempts + 1
         END,
         window_started_at = CASE
           WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now()
           ELSE auth_rate_limits.window_started_at
         END
       RETURNING attempts`,
      [keyHash],
    );
    if (Number(result.rows[0]?.attempts ?? 0) > 10) {
      throw new HttpException('Too many attempts. Please wait before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (Date.now() - lastRateLimitCleanup > 60_000) {
      lastRateLimitCleanup = Date.now();
      void this.database.query('DELETE FROM auth_rate_limits WHERE window_started_at < now() - interval \'1 day\'')
        .catch(() => undefined);
    }
    return true;
  }
}

@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const publicAvailabilityPaths = [
      '/health', '/auth/csrf', '/auth/login', '/auth/logout', '/auth/me',
      '/auth/forgot-password', '/auth/reset-password',
    ];
    if (publicAvailabilityPaths.some((path) => request.path.endsWith(path))) return true;
    if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) {
      if (!maintenanceCache.enabled || request.actor?.isSuperAdmin) return true;
      throw new ServiceUnavailableException('The platform is temporarily unavailable for maintenance.');
    }

    const result = await this.database.query<{ value: boolean }>(
      `SELECT value FROM system_settings WHERE key = 'maintenance_mode'`,
    );
    const enabled = result.rows[0]?.value === true;
    maintenanceCache = { enabled, expiresAt: Date.now() + 5_000 };
    if (enabled && !request.actor?.isSuperAdmin) {
      throw new ServiceUnavailableException('The platform is temporarily unavailable for maintenance.');
    }
    return true;
  }
}