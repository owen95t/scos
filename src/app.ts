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
import { buildLoggerConfig } from "./config/logger.js";

export async function createApp(container?: ReturnType<typeof createContainer>): Promise<{ app: FastifyInstance; container: ReturnType<typeof createContainer> }> {
  const c = container ?? createContainer();

  const app = Fastify({ logger: buildLoggerConfig() });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "SCOS API", version: "0.1.0" },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  // Must be set before route plugins register; child contexts copy the handler at load time.
  app.setErrorHandler(errorHandler);

  await app.register(orderRoutes(c.orderService, c.orderRepository), { prefix: "/api" });
  await app.register(warehouseRoutes(c.warehouseRepository), { prefix: "/api" });

  return { app, container: c };
}
