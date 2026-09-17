# 06 — API Layer

## Scope

`apps/api/src/api/`:
- `routes/orders.ts` — POST /api/orders/verify, POST /api/orders, GET /api/orders/:orderNumber
- `routes/warehouses.ts` — GET /api/warehouses
- `middleware/errorHandler.ts` — centralized error handling, maps domain errors + Zod validation errors to HTTP status codes
- `schemas/` — Zod schemas for request validation (used declaratively via `fastify-type-provider-zod`)

OpenAPI spec auto-generated from Zod route schemas via `@fastify/swagger`.
Swagger UI served at `/docs` via `@fastify/swagger-ui`.

`apps/api/src/container.ts` — manual DI wiring
`apps/api/src/server.ts` — Fastify app setup

Fastify `app.inject()` tests at `apps/api/test/api/`.

## Acceptance Criteria

- All 4 endpoints respond correctly
- Zod validation rejects invalid inputs with 400
- Error handler returns proper error shapes
- `/docs` serves Swagger UI with auto-generated OpenAPI spec
- `app.inject()` tests cover happy path + validation errors + 409 conflict

## Dependencies

- 05 (services — orderService)
- 02 (shared types — response DTOs)
