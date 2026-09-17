import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError } from "../../src/domain/errors.ts";
import { PRODUCT_ID } from "../../src/domain/product.ts";
import { createOrderRepository } from "../../src/repositories/orderRepository.ts";
import { createWarehouseRepository } from "../../src/repositories/warehouseRepository.ts";
import { createOrderService } from "../../src/services/orderService.ts";
import type { ServiceContext } from "../../src/services/orderService.ts";
import type { Logger } from "../../src/types/logger.ts";
import { resetDb, warehouseIdByName } from "../support/db.ts";

const noop = () => {};
const testLogger = {
  info: noop, debug: noop, warn: noop, error: noop, fatal: noop, trace: noop, silent: noop,
  child: () => testLogger, level: "silent",
} as unknown as Logger;

const testCtx: ServiceContext = { log: testLogger, requestId: "test-req-001" };

describe("orderService integration", () => {
  let prisma: PrismaClient;
  let orderService: ReturnType<typeof createOrderService>;
  let laId: number;

  function buildService(orderRepository = createOrderRepository(prisma)) {
    return createOrderService({
      prisma,
      warehouseRepository: createWarehouseRepository(prisma),
      orderRepository,
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
    orderService = buildService();
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

  it("concurrent submissions never oversell", async () => {
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
    // Order creation runs after stock is decremented, so its failure
    // must undo the decrement.
    const failingService = buildService({
      ...createOrderRepository(prisma),
      create: async () => {
        throw new Error("order write failed");
      },
    });

    await expect(
      failingService.submitOrder(testCtx, 10, 34.0, -118.0)
    ).rejects.toThrow("order write failed");

    expect(await stockOf(laId)).toBe(355);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderFulfillment.count()).toBe(0);
  });
});
