import Fastify, { type FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { createContainer } from "./container.ts";
import { orderRoutes } from "./api/routes/orders.ts";
import { warehouseRoutes } from "./api/routes/warehouses.ts";
import { errorHandler } from "./api/middleware/errorHandler.ts";
import { buildLoggerConfig, genReqId } from "./config/logger.ts";
import { healthRoutes } from "./api/routes/health.ts";

export async function createApp(container?: ReturnType<typeof createContainer>): Promise<{ app: FastifyInstance; container: ReturnType<typeof createContainer> }> {
  const c = container ?? createContainer();

  const app = Fastify({ logger: buildLoggerConfig(), genReqId });

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

  await app.register(healthRoutes(c.prisma));
  await app.register(orderRoutes(c.orderService, c.orderRepository), { prefix: "/api" });
  await app.register(warehouseRoutes(c.warehouseRepository), { prefix: "/api" });

  return { app, container: c };
}
