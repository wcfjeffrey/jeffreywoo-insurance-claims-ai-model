import type { Request } from "express";
import type { Pool } from "pg";

export async function writeAudit(
  pool: Pool,
  opts: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    req?: Request;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      opts.userId,
      opts.action,
      opts.entityType,
      opts.entityId ?? null,
      JSON.stringify(opts.metadata ?? {}),
      opts.req?.ip ?? opts.req?.socket?.remoteAddress ?? null,
      opts.req?.get("user-agent") ?? null,
    ],
  );
}
