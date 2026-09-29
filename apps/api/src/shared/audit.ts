import { randomUUID } from 'node:crypto';
import type { QueryExecutor } from '../db/database.js';
import type { AuthActor } from './security.js';

export async function writeAudit(
  executor: QueryExecutor,
  actor: AuthActor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  collegeId: string | null = actor?.collegeId ?? null,
  metadata: Record<string, unknown> = {},
) {
  await executor.query(
    `INSERT INTO audit_logs (id, actor_user_id, college_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [randomUUID(), actor?.userId ?? null, collegeId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}