# 04 — Prisma Schema + Seed

## Scope

`apps/api/prisma/`:

- `schema.prisma` with models:
  - `Warehouse` (id, name, latitude, longitude)
  - `Product` (id, sku, name, unitPrice, weightGrams)
  - `WarehouseStock` (composite PK warehouse_id+product_id, quantity with CHECK >= 0)
  - `Order` (id, orderNumber unique from PG sequence, subtotal, discountAmount, shippingCost, total, quantity, latitude, longitude, createdAt)
  - `OrderLine` (id, orderId, productId, quantity, unitPrice, discountPercent)
  - `OrderFulfillment` (id, orderLineId, warehouseId, quantity, distanceKm, shippingCost)
- `seed.ts` loading:
  - 6 warehouses with coordinates and stock as specified
  - 1 product: SCOS Station P1 Pro, $150, 365g

Data model supports future multi-SKU (WarehouseStock keyed on product, OrderLine per product).

`apps/api/prisma/migrations/`, one migration per table (not one jumbo migration), in dependency order:

- `create_warehouses` — Warehouse table + unique index on name
- `create_products` — Product table + unique index on sku
- `create_warehouse_stock` — WarehouseStock table, FKs to warehouses/products, CHECK quantity >= 0
- `create_orders` — Order table, unique index on orderNumber, order_number_seq sequence
- `create_order_lines` — OrderLine table, FKs to orders/products
- `create_order_fulfillments` — OrderFulfillment table, FKs to order_lines/warehouses

## Acceptance Criteria

- `npx prisma generate` succeeds
- `npx prisma migrate dev` applies all 6 migrations cleanly to a local Postgres
- `npx prisma db seed` inserts 6 warehouses, 1 product, 6 stock rows
- CHECK constraint on WarehouseStock.quantity >= 0 exists (raw SQL migration or Prisma extension)

## Dependencies

- 01 (workspace setup)
