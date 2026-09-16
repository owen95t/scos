import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { OrderService } from "../../services/orderService.js";
import type { OrderRepository } from "../../repositories/orderRepository.js";
import {
  orderNumberParamSchema,
  submitOrderSchema,
  verifyOrderSchema,
} from "../schemas/orderSchemas.js";

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
      return orderService.verifyOrder(request.log, quantity, latitude, longitude);
    });

    app.post("/orders", {
      schema: { body: submitOrderSchema },
    }, async (request, reply) => {
      const { quantity, latitude, longitude } = request.body;
      const result = await orderService.submitOrder(request.log, quantity, latitude, longitude);
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
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        quantity: order.quantity,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        shippingCost: order.shippingCost,
        total: order.total,
        latitude: order.latitude,
        longitude: order.longitude,
        createdAt: order.createdAt.toISOString(),
        lines: order.lines.map((line) => ({
          productId: line.productId,
          productName: line.product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          fulfillments: line.fulfillments.map((f) => ({
            warehouseId: f.warehouseId,
            warehouseName: f.warehouse.name,
            quantity: f.quantity,
            distanceKm: f.distanceKm,
            shippingCost: f.shippingCost,
          })),
        })),
      };
    });
  };
}
