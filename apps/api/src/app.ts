import Fastify, { type FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { createContainer } from "./container.js";
import { orderRoutes } from "./api/routes/orders.js";
import { warehouseRoutes } from "./api/routes/warehouses.js";
import { errorHandler } from "./api/middleware/errorHandler.js";

export async function createApp(container?: ReturnType<typeof createContainer>): Promise<{ app: FastifyInstance; container: ReturnType<typeof createContainer> }> {
  const c = container ?? createContainer();

  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "SCOS API", version: "0.1.0" },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  await app.register(orderRoutes(c.orderService, c.orderRepository), { prefix: "/api" });
  await app.register(warehouseRoutes(c.warehouseRepository), { prefix: "/api" });

  app.setErrorHandler(errorHandler);

  return { app, container: c };
}
