import { randomUUID } from 'node:crypto';
export async function writeAudit(executor, actor, action, entityType, entityId, collegeId = actor?.collegeId ?? null, metadata = {}) {
    await executor.query(`INSERT INTO audit_logs (id, actor_user_id, college_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`, [randomUUID(), actor?.userId ?? null, collegeId, action, entityType, entityId, JSON.stringify(metadata)]);
}
