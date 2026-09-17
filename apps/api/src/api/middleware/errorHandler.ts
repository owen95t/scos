import type { FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import {
  InsufficientStockError,
  InvalidOrderError,
} from "../../domain/errors.js";

export function errorHandler(
  err: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (hasZodFastifySchemaValidationErrors(err)) {
    const reason = err.validation
      .map((v) => `${v.instancePath.replace(/^\//, "") || v.params?.issue?.path?.join(".") || "field"}: ${v.message}`)
      .join("; ");
    request.log.debug({ reason }, "validation error");
    return reply.status(400).send({
      error: "VALIDATION_ERROR" as const,
      reason,
    });
  }

  if (err instanceof InsufficientStockError) {
    request.log.warn({ error: err.message, quantity: err.quantity }, "order rejected: insufficient stock");
    return reply.status(409).send({
      error: "INSUFFICIENT_STOCK" as const,
      reason: err.message,
    });
  }

  if (err instanceof InvalidOrderError) {
    request.log.warn({ error: err.message, quantity: err.quantity }, "order rejected: invalid order");
    return reply.status(409).send({
      error: "INVALID_ORDER" as const,
      reason: err.message,
    });
  }

  request.log.error({ err }, "unhandled error");
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    reason: "An unexpected error occurred",
  });
}
