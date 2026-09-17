import { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { healthRoutes } from "../../src/api/routes/health.js";
import { genReqId } from "../../src/config/logger.js";

describe("Health API", () => {
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

  it("GET /health reports database up", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", database: "up" });
  });
});

describe("Health API without database", () => {
  it("GET /health returns 503 when the database is unreachable", async () => {
    const prisma = {
      $queryRaw: () => Promise.reject(new Error("connection refused")),
    } as unknown as PrismaClient;
    const app = Fastify({ genReqId });
    await app.register(healthRoutes(prisma));

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "error", database: "down" });
    await app.close();
  });
});
