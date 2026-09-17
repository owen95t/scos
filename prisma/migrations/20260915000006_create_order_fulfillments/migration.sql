-- CreateTable
CREATE TABLE "order_fulfillments" (
    "id" SERIAL NOT NULL,
    "order_line_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "shipping_cost" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "order_fulfillments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "order_fulfillments" ADD CONSTRAINT "order_fulfillments_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfillments" ADD CONSTRAINT "order_fulfillments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
