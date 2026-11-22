import { db } from '../db/index.js';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: 'AUTH' | 'PAYMENT' | 'ORDER' | 'INVENTORY' | 'EXPENSE' | 'DAY_CLOSE' | 'USER' | 'SYSTEM';
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        params.userId || null,
        params.action,
        params.entityType,
        params.entityId || null,
        JSON.stringify(params.details || {}),
        params.ipAddress || null,
      ]
    );
  } catch (error) {
    console.error('[AuditLog] Failed to record audit log:', error);
  }
}
