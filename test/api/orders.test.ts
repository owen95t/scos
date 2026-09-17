import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createContainer } from "../../src/container.ts";
import { resetDb } from "../support/db.ts";

describe("Orders API", () => {
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
    await resetDb(prisma);
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

    it.each([
      ["zero quantity", { quantity: 0, latitude: 34.0, longitude: -118.0 }],
      ["negative quantity", { quantity: -5, latitude: 34.0, longitude: -118.0 }],
      ["non-integer quantity", { quantity: 1.5, latitude: 34.0, longitude: -118.0 }],
      ["longitude out of range", { quantity: 10, latitude: 34.0, longitude: 181 }],
    ])("returns 400 for %s", async (_label, payload) => {
      const res = await app.inject({ method: "POST", url: "/api/orders/verify", payload });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("VALIDATION_ERROR");
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

    it("returns 409 when shipping exceeds 15% of the order", async () => {
      // South Pacific: more than 6,164 km from every warehouse, so 1 unit is too costly to ship.
      const res = await app.inject({
        method: "POST",
        url: "/api/orders",
        payload: { quantity: 1, latitude: -50.0, longitude: -140.0 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("INVALID_ORDER");
      expect(await prisma.order.count()).toBe(0);
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

      // Money is stored as DECIMAL(12,2) and returned as plain numbers.
      const order = res.json();
      const cents = (n: number) => Math.round(n * 100);
      expect(order.subtotal).toBe(1500);
      expect(order.lines[0].unitPrice).toBe(150);
      for (const amount of [order.discountAmount, order.shippingCost, order.total]) {
        expect(amount).toBeTypeOf("number");
        expect(Number(amount.toFixed(2))).toBe(amount);
      }
      expect(cents(order.total)).toBe(
        cents(order.subtotal) - cents(order.discountAmount) + cents(order.shippingCost)
      );
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
