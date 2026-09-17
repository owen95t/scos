import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Warehouses API", () => {
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

  it("GET /api/warehouses returns all warehouses with stock", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/warehouses",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(6);
    expect(res.json()[0]).toHaveProperty("name");
    expect(res.json()[0]).toHaveProperty("stock");
    expect(res.json()[0].stock[0]).toHaveProperty("quantity");
  });
});
