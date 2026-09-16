import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createOrderService,
  InsufficientStockError,
} from "../../src/services/orderService.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("orderService integration", () => {
  let prisma: PrismaClient;
  let orderService: ReturnType<typeof createOrderService>;

  beforeAll(async () => {
    prisma = new PrismaClient();
    orderService = createOrderService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.orderFulfillment.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();

    await prisma.$executeRawUnsafe(
      `UPDATE warehouse_stock SET quantity = CASE warehouse_id
        WHEN 1 THEN 355
        WHEN 2 THEN 578
        WHEN 3 THEN 265
        WHEN 4 THEN 694
        WHEN 5 THEN 245
        WHEN 6 THEN 419
       END
       WHERE product_id = 1`
    );
  });

  it("verifyOrder returns quote without side effects", async () => {
    const quote = await orderService.verifyOrder(10, 34.0, -118.0);
    expect(quote.valid).toBe(true);
    expect(quote.subtotal).toBe(1500);
    expect(quote.fulfillmentPlan.length).toBeGreaterThan(0);

    const stock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: 1, productId: 1 },
    });
    expect(stock!.quantity).toBe(355);
  });

  it("submitOrder persists order and decrements stock", async () => {
    const result = await orderService.submitOrder(10, 34.0, -118.0);
    expect(result.orderNumber).toMatch(/^ORD-/);
    expect(result.quote.valid).toBe(true);

    const stock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: 1, productId: 1 },
    });
    expect(stock!.quantity).toBe(345);
  });

  it("concurrent submissions never oversell", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE warehouse_stock SET quantity = 50 WHERE warehouse_id = 1 AND product_id = 1`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE warehouse_stock SET quantity = 0 WHERE warehouse_id != 1 AND product_id = 1`
    );

    const promises = Array.from({ length: 10 }, () =>
      orderService
        .submitOrder(10, 34.0, -118.0)
        .then(() => "success" as const)
        .catch((e) => {
          if (
            e instanceof InsufficientStockError ||
            e.message?.includes("quantity")
          ) {
            return "insufficient" as const;
          }
          throw e;
        })
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r === "success").length;
    const failures = results.filter((r) => r === "insufficient").length;

    expect(successes).toBe(5);
    expect(failures).toBe(5);

    const stock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: 1, productId: 1 },
    });
    expect(stock!.quantity).toBe(0);
  });

  it("returns 409-equivalent on insufficient stock", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE warehouse_stock SET quantity = 0 WHERE product_id = 1`
    );

    await expect(
      orderService.submitOrder(1, 34.0, -118.0)
    ).rejects.toThrow(InsufficientStockError);
  });
});
