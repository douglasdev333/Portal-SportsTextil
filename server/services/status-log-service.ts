import { pool } from "../db";

export type EntityType = "event" | "order" | "registration";
export type ChangedByType = "system" | "admin" | "athlete";

interface LogStatusChangeParams {
  entityType: EntityType;
  entityId: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string;
  changedByType: ChangedByType;
  changedById?: string | null;
  metadata?: Record<string, any> | null;
}

export async function logStatusChange(params: LogStatusChangeParams): Promise<void> {
  const {
    entityType,
    entityId,
    oldStatus,
    newStatus,
    reason,
    changedByType,
    changedById,
    metadata
  } = params;

  try {
    await pool.query(
      `INSERT INTO status_change_logs 
        (entity_type, entity_id, old_status, new_status, reason, changed_by_type, changed_by_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entityType,
        entityId,
        oldStatus,
        newStatus,
        reason,
        changedByType,
        changedById || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    
    console.log(`[status-log] ${entityType} ${entityId}: ${oldStatus || 'null'} -> ${newStatus} (${reason}) by ${changedByType}${changedById ? `:${changedById}` : ''}`);
  } catch (error) {
    console.error('[status-log] Erro ao registrar log de mudança de status:', error);
  }
}

export async function getStatusHistory(entityType: EntityType, entityId: string): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM status_change_logs 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    return result.rows;
  } catch (error) {
    console.error('[status-log] Erro ao buscar histórico:', error);
    return [];
  }
}
