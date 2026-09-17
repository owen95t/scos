import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

export function healthRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async function (fastify) {
    fastify.get("/health", async (request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "ok", database: "up" };
      } catch (err) {
        request.log.error({ err }, "health check: database unreachable");
        return reply.code(503).send({ status: "error", database: "down" });
      }
    });
  };
}
