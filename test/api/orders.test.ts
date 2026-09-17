import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Orders API", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const container = createContainer();
    prisma = container.prisma;
    const result = await createApp(container);
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM audit_log`);
    await prisma.orderFulfillment.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.$executeRawUnsafe(
      `UPDATE warehouse_stock SET quantity = CASE warehouse_id
        WHEN 1 THEN 355 WHEN 2 THEN 578 WHEN 3 THEN 265
        WHEN 4 THEN 694 WHEN 5 THEN 245 WHEN 6 THEN 419
       END WHERE product_id = 1`
    );
  });

  describe("POST /api/orders/verify", () => {
    it("returns valid quote for small order near warehouse", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/orders/verify",
        payload: { quantity: 10, latitude: 34.0, longitude: -118.0 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().valid).toBe(true);
      expect(res.json().subtotal).toBe(1500);
      expect(res.json().fulfillmentPlan).toHaveLength(1);
    });

    it("returns 400 for missing quantity", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/orders/verify",
        payload: { latitude: 34.0, longitude: -118.0 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid latitude", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/orders/verify",
        payload: { quantity: 10, latitude: 100, longitude: -118.0 },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/orders", () => {
    it("creates order and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/orders",
        payload: { quantity: 10, latitude: 34.0, longitude: -118.0 },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().orderNumber).toMatch(/^ORD-/);
      expect(res.json().quote.valid).toBe(true);
    });

    it("returns 409 when stock exhausted", async () => {
      await prisma.$executeRawUnsafe(
        `UPDATE warehouse_stock SET quantity = 0 WHERE product_id = 1`
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/orders",
        payload: { quantity: 1, latitude: 34.0, longitude: -118.0 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("INSUFFICIENT_STOCK");
    });
  });

  describe("GET /api/orders/:orderNumber", () => {
    it("returns order with fulfillment breakdown", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/orders",
        payload: { quantity: 10, latitude: 34.0, longitude: -118.0 },
      });

      const orderNumber = createRes.json().orderNumber;

      const res = await app.inject({
        method: "GET",
        url: `/api/orders/${orderNumber}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().orderNumber).toBe(orderNumber);
      expect(res.json().lines).toHaveLength(1);
      expect(res.json().lines[0].fulfillments.length).toBeGreaterThan(0);
    });

    it("returns 404 for nonexistent order", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/orders/ORD-999999",
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
