import type { FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";

export function buildLoggerConfig(): FastifyServerOptions["logger"] {
  const isDev = process.env.NODE_ENV !== "production";

  return {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),

    genReqId: () => `req-${randomUUID().slice(0, 8)}`,

    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },

    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    }),
  };
}
