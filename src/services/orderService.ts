import type { PrismaClient } from "@prisma/client";
import type { OrderQuote } from "../types/api.ts";
import { InsufficientStockError, InvalidOrderError } from "../domain/errors.ts";
import { calculateOrder } from "../domain/orderCalculator.ts";
import { PRODUCT_ID } from "../domain/product.ts";
import type { OrderRepository } from "../repositories/orderRepository.ts";
import type { WarehouseRepository } from "../repositories/warehouseRepository.ts";
import type { Logger } from "../types/logger.ts";

export interface ServiceContext {
  log: Logger;
  requestId: string;
}

export interface OrderServiceDeps {
  // Only used to open transactions; all queries live in repositories.
  prisma: PrismaClient;
  warehouseRepository: WarehouseRepository;
  orderRepository: OrderRepository;
}

function toQuote(
  calc: ReturnType<typeof calculateOrder>
): OrderQuote {
  return {
    subtotal: calc.pricing.subtotal,
    discountPercent: calc.pricing.discountPercent,
    discountAmount: calc.pricing.discountAmount,
    shippingCost: calc.shippingCost,
    total: calc.total,
    valid: calc.valid,
    reason: calc.reason,
    fulfillmentPlan: calc.allocation.legs.map((leg) => ({
      warehouseId: leg.warehouse.id,
      warehouseName: leg.warehouse.name,
      quantity: leg.quantity,
      distanceKm: Math.round(leg.distanceKm * 100) / 100,
      shippingCost: Math.round(leg.shippingCost * 100) / 100,
    })),
  };
}

export function createOrderService({
  prisma,
  warehouseRepository,
  orderRepository,
}: OrderServiceDeps) {
  return {
    async verifyOrder(
      ctx: ServiceContext,
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<OrderQuote> {
      ctx.log.info({ quantity, latitude, longitude }, "verifying order");
      const warehouses = await warehouseRepository.getWithStock(PRODUCT_ID);
      ctx.log.debug({ warehouseCount: warehouses.length, totalStock: warehouses.reduce((s, w) => s + w.stock, 0) }, "warehouses loaded");
      const calc = calculateOrder(warehouses, quantity, { latitude, longitude });
      ctx.log.info({
        valid: calc.valid,
        allocationLegs: calc.allocation.legs.length,
        shippingCost: calc.shippingCost,
        total: calc.total,
        ...(calc.reason && { reason: calc.reason }),
      }, "order verified");
      return toQuote(calc);
    },

    async submitOrder(
      ctx: ServiceContext,
      quantity: number,
      latitude: number,
      longitude: number
    ): Promise<{ orderNumber: string; quote: OrderQuote }> {
      ctx.log.info({ quantity, latitude, longitude }, "submitting order");
      return prisma.$transaction(async (tx) => {
        const warehouses = await warehouseRepository.lockStockForUpdate(tx, PRODUCT_ID);
        ctx.log.debug({ warehouseCount: warehouses.length }, "stock locked for allocation");

        const calc = calculateOrder(warehouses, quantity, {
          latitude,
          longitude,
        });

        if (!calc.valid) {
          if (!calc.allocation.fulfilled) {
            ctx.log.warn({ requested: quantity, available: calc.allocation.fulfilledQuantity }, "insufficient stock");
            throw new InsufficientStockError(calc.reason!, { requestId: ctx.requestId, quantity });
          }
          ctx.log.warn({ reason: calc.reason }, "invalid order");
          throw new InvalidOrderError(calc.reason!, { requestId: ctx.requestId, quantity });
        }

        ctx.log.info({
          legs: calc.allocation.legs.map(l => ({
            warehouseId: l.warehouse.id,
            qty: l.quantity,
            distanceKm: Math.round(l.distanceKm),
          })),
        }, "allocation decided");

        for (const leg of calc.allocation.legs) {
          await warehouseRepository.decrementStock(tx, PRODUCT_ID, leg.warehouse.id, leg.quantity);
        }

        const orderNumber = await orderRepository.nextOrderNumber(tx);
        const order = await orderRepository.create(tx, {
          orderNumber,
          productId: PRODUCT_ID,
          quantity,
          latitude,
          longitude,
          calc,
        });

        ctx.log.info({ orderNumber: order.orderNumber, total: calc.total }, "order created");

        return {
          orderNumber: order.orderNumber,
          quote: toQuote(calc),
        };
      });
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
