import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError } from "../../src/domain/errors.ts";
import { PRODUCT_ID } from "../../src/domain/product.ts";
import { createOrderRepository } from "../../src/repositories/orderRepository.ts";
import { createWarehouseRepository } from "../../src/repositories/warehouseRepository.ts";
import { createOrderService } from "../../src/services/orderService.ts";
import type { ServiceContext } from "../../src/services/orderService.ts";
import { createAuditService } from "../../src/services/auditService.ts";
import type { AuditService } from "../../src/services/auditService.ts";
import type { Logger } from "../../src/types/logger.ts";
import { resetDb, warehouseIdByName } from "../support/db.ts";

const noop = () => {};
const testLogger = {
  info: noop, debug: noop, warn: noop, error: noop, fatal: noop, trace: noop, silent: noop,
  child: () => testLogger, level: "silent",
} as unknown as Logger;

const testCtx: ServiceContext = { log: testLogger, requestId: "test-req-001" };

type AuditRow = { action: string; entity_type: string; entity_id: string; request_id: string; data: unknown };

describe("orderService integration", () => {
  let prisma: PrismaClient;
  let orderService: ReturnType<typeof createOrderService>;
  let laId: number;

  function buildService(auditService: AuditService) {
    return createOrderService({
      prisma,
      warehouseRepository: createWarehouseRepository(prisma),
      orderRepository: createOrderRepository(prisma),
      auditService,
    });
  }

  async function stockOf(warehouseId: number) {
    const stock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { warehouseId_productId: { warehouseId, productId: PRODUCT_ID } },
    });
    return stock.quantity;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    orderService = buildService(createAuditService(prisma));
    laId = await warehouseIdByName(prisma, "Los Angeles");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it("verifyOrder returns quote without side effects", async () => {
    const quote = await orderService.verifyOrder(testCtx, 10, 34.0, -118.0);
    expect(quote.valid).toBe(true);
    expect(quote.subtotal).toBe(1500);
    expect(quote.fulfillmentPlan.length).toBeGreaterThan(0);

    expect(await stockOf(laId)).toBe(355);
    expect(await prisma.order.count()).toBe(0);
  });

  it("submitOrder persists order and decrements stock", async () => {
    const result = await orderService.submitOrder(testCtx, 10, 34.0, -118.0);
    expect(result.orderNumber).toMatch(/^ORD-/);
    expect(result.quote.valid).toBe(true);

    expect(await stockOf(laId)).toBe(345);
    expect(await prisma.order.count()).toBe(1);
  });

  it("concurrent submissions never oversell and serialize on stock rows", async () => {
    await prisma.warehouseStock.updateMany({
      where: { productId: PRODUCT_ID },
      data: { quantity: 0 },
    });
    await prisma.warehouseStock.update({
      where: { warehouseId_productId: { warehouseId: laId, productId: PRODUCT_ID } },
      data: { quantity: 50 },
    });

    // Only InsufficientStockError is an expected failure; anything else
    // (e.g. the quantity >= 0 CHECK constraint firing) fails the test.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        orderService
          .submitOrder(testCtx, 10, 34.0, -118.0)
          .then((r) => ({ ok: true as const, orderNumber: r.orderNumber }))
          .catch((e) => {
            if (e instanceof InsufficientStockError) return { ok: false as const };
            throw e;
          })
      )
    );

    const orderNumbers = results.flatMap((r) => (r.ok ? [r.orderNumber] : []));
    expect(orderNumbers).toHaveLength(5);
    expect(new Set(orderNumbers).size).toBe(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(5);
    expect(await stockOf(laId)).toBe(0);

    // Each transaction must have seen the stock left by the previous one.
    // Without row locking, several would read the same starting quantity.
    const entries = await prisma.$queryRawUnsafe<AuditRow[]>(
      `SELECT action, entity_type, entity_id, request_id, data FROM audit_log
       WHERE action = 'STOCK_DECREMENTED' AND entity_id = $1`,
      `${laId}:${PRODUCT_ID}`
    );
    const before = entries
      .map((e) => (e.data as { quantityBefore: number }).quantityBefore)
      .sort((a, b) => b - a);
    expect(before).toEqual([50, 40, 30, 20, 10]);
  });

  it("throws InsufficientStockError when stock is exhausted", async () => {
    await prisma.warehouseStock.updateMany({
      where: { productId: PRODUCT_ID },
      data: { quantity: 0 },
    });

    await expect(
      orderService.submitOrder(testCtx, 1, 34.0, -118.0)
    ).rejects.toThrow(InsufficientStockError);
  });

  it("rolls back stock and order when a later step fails", async () => {
    const realAudit = createAuditService(prisma);
    const failingService = buildService({
      ...realAudit,
      logMany: async () => {
        throw new Error("audit write failed");
      },
    });

    await expect(
      failingService.submitOrder(testCtx, 10, 34.0, -118.0)
    ).rejects.toThrow("audit write failed");

    expect(await stockOf(laId)).toBe(355);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderFulfillment.count()).toBe(0);
    const audit = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*) AS n FROM audit_log`
    );
    expect(Number(audit[0].n)).toBe(0);
  });

  it("submitOrder creates audit log entries", async () => {
    const ctx: ServiceContext = { log: testLogger, requestId: "audit-test-req" };
    await orderService.submitOrder(ctx, 10, 34.0, -118.0);

    const entries = await prisma.$queryRawUnsafe<AuditRow[]>(
      `SELECT action, entity_type, entity_id, request_id, data FROM audit_log ORDER BY id ASC`
    );

    const stockEntries = entries.filter((e) => e.action === "STOCK_DECREMENTED");
    const orderEntries = entries.filter((e) => e.action === "ORDER_CREATED");

    expect(stockEntries).toHaveLength(1);
    expect(orderEntries).toHaveLength(1);

    for (const entry of entries) {
      expect(entry.request_id).toBe("audit-test-req");
    }

    const stockData = stockEntries[0].data as Record<string, unknown>;
    expect(stockData).toMatchObject({
      warehouseId: laId,
      quantityBefore: 355,
      quantityAfter: 345,
      decremented: 10,
    });

    const orderData = orderEntries[0].data as Record<string, unknown>;
    expect(orderData.quantity).toBe(10);
    expect(orderData.total).toBeTypeOf("number");
    expect(orderEntries[0].entity_id).toMatch(/^ORD-/);
  });
});
