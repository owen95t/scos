-- Add updated_at to orders
ALTER TABLE "orders" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add status to orders (all existing orders are 'confirmed')
ALTER TABLE "orders" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';

-- Add updated_at to warehouse_stock
ALTER TABLE "warehouse_stock" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");
