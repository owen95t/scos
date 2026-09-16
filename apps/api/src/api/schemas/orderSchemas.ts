import { z } from "zod";

export const verifyOrderSchema = z.object({
  quantity: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const submitOrderSchema = verifyOrderSchema;

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().regex(/^ORD-\d{6,}$/),
});
