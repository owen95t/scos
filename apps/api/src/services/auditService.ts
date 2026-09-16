import type { PrismaClient } from "@prisma/client";

export type AuditAction = "ORDER_CREATED" | "STOCK_DECREMENTED";

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}

export interface RawClient {
  $executeRawUnsafe: PrismaClient["$executeRawUnsafe"];
}

export function createAuditService(prisma: PrismaClient) {
  async function writeEntry(
    client: RawClient,
    entry: AuditEntry,
    requestId: string
  ): Promise<void> {
    await client.$executeRawUnsafe(
      `INSERT INTO audit_log (request_id, action, entity_type, entity_id, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      requestId,
      entry.action,
      entry.entityType,
      entry.entityId,
      JSON.stringify(entry.data ?? null)
    );
  }

  return {
    async log(
      entry: AuditEntry,
      requestId: string,
      tx?: RawClient
    ): Promise<void> {
      await writeEntry(tx ?? prisma, entry, requestId);
    },

    async logMany(
      entries: AuditEntry[],
      requestId: string,
      tx?: RawClient
    ): Promise<void> {
      for (const entry of entries) {
        await writeEntry(tx ?? prisma, entry, requestId);
      }
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
