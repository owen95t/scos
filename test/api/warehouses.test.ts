import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WAREHOUSES } from "../../prisma/seedData.js";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { resetDb } from "../support/db.js";

describe("Warehouses API", () => {
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

  it("GET /api/warehouses returns all seeded warehouses with stock", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/warehouses",
    });

    expect(res.statusCode).toBe(200);
    const body: Array<{ name: string; stock: Array<{ quantity: number }> }> = res.json();
    expect(body.map((w) => w.name).sort()).toEqual(WAREHOUSES.map((w) => w.name).sort());

    for (const seeded of WAREHOUSES) {
      const warehouse = body.find((w) => w.name === seeded.name)!;
      expect(warehouse.stock[0].quantity).toBe(seeded.stock);
    }
  });
});
