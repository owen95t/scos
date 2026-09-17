import type { FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import { getEnv } from "./env.ts";

// Top-level Fastify option; it has no effect inside the logger config.
export const genReqId = () => `req-${randomUUID().slice(0, 8)}`;

export function buildLoggerConfig(): FastifyServerOptions["logger"] {
  const { NODE_ENV, LOG_LEVEL } = getEnv();
  const isDev = NODE_ENV !== "production";

  return {
    level: LOG_LEVEL ?? (isDev ? "debug" : "info"),

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
