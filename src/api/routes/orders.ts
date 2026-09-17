import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { OrderService } from "../../services/orderService.ts";
import type { OrderRepository } from "../../repositories/orderRepository.ts";
import {
  orderNumberParamSchema,
  submitOrderSchema,
  verifyOrderSchema,
} from "../schemas/orderSchemas.ts";

export function orderRoutes(
  orderService: OrderService,
  orderRepository: OrderRepository
): FastifyPluginAsync {
  return async function (fastify) {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post("/orders/verify", {
      schema: { body: verifyOrderSchema },
    }, async (request) => {
      const { quantity, latitude, longitude } = request.body;
      const ctx = { log: request.log, requestId: request.id };
      return orderService.verifyOrder(ctx, quantity, latitude, longitude);
    });

    app.post("/orders", {
      schema: { body: submitOrderSchema },
    }, async (request, reply) => {
      const { quantity, latitude, longitude } = request.body;
      const ctx = { log: request.log, requestId: request.id };
      const result = await orderService.submitOrder(ctx, quantity, latitude, longitude);
      reply.status(201);
      return result;
    });

    app.get("/orders/:orderNumber", {
      schema: { params: orderNumberParamSchema },
    }, async (request, reply) => {
      const { orderNumber } = request.params;
      const order = await orderRepository.findByOrderNumber(orderNumber);
      if (!order) {
        reply.status(404);
        return {
          error: "NOT_FOUND" as const,
          reason: `Order ${orderNumber} not found`,
        };
      }
      return order;
    });
  };
}
