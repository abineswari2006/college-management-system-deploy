import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type SqlDatabase } from '../db/database.js';
import type { AuthActor } from '../shared/security.js';

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async summary(actor: AuthActor) {
    const scope = actor.collegeId ? 'college' : 'system';
    const collegeFilter = actor.collegeId ? 'AND m.college_id = $1' : '';
    const parameters = actor.collegeId ? [actor.collegeId] : [];
    const [colleges, users, invitations, activity] = await Promise.all([
      actor.collegeId
        ? this.database.query<{ active: string; deactivated: string }>(
            `SELECT count(*) FILTER (WHERE status = 'active')::text AS active,
                    count(*) FILTER (WHERE status = 'deactivated')::text AS deactivated
             FROM colleges WHERE id = $1`,
            [actor.collegeId],
          )
        : this.database.query<{ active: string; deactivated: string }>(
            `SELECT count(*) FILTER (WHERE status = 'active')::text AS active,
                    count(*) FILTER (WHERE status = 'deactivated')::text AS deactivated
             FROM colleges`,
          ),
      this.database.query<{ count: string }>(
        `SELECT count(DISTINCT u.id)::text AS count FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN colleges c ON c.id = m.college_id AND c.status = 'active'
         WHERE u.status = 'active' ${collegeFilter}`,
        parameters,
      ),
      this.database.query<{ count: string }>(
        `SELECT count(DISTINCT u.id)::text AS count FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN colleges c ON c.id = m.college_id AND c.status = 'active'
         WHERE u.status = 'invited' ${collegeFilter}`,
        parameters,
      ),
      this.database.query<{
        id: string;
        action: string;
        entity_type: string;
        created_at: Date;
        actor_name: string | null;
        college_name: string | null;
      }>(
        `SELECT a.id, a.action, a.entity_type, a.created_at,
                u.full_name AS actor_name, c.name AS college_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         LEFT JOIN colleges c ON c.id = a.college_id
         ${actor.collegeId ? 'WHERE a.college_id = $1' : ''}
         ORDER BY a.created_at DESC LIMIT 8`,
        parameters,
      ),
    ]);

    return {
      data: {
        scope: {
          type: scope,
          collegeId: actor.collegeId,
          collegeName: actor.collegeName,
        },
        metrics: {
          activeColleges: Number(colleges.rows[0]?.active ?? 0),
          deactivatedColleges: Number(colleges.rows[0]?.deactivated ?? 0),
          activeUsers: Number(users.rows[0]?.count ?? 0),
          pendingInvitations: Number(invitations.rows[0]?.count ?? 0),
        },
        recentActivity: activity.rows.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          createdAt: row.created_at,
          actorName: row.actor_name,
          collegeName: row.college_name,
        })),
      },
    };
  }
}