-- CreateTable
CREATE TABLE "warehouse_stock" (
    "warehouse_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "warehouse_stock_pkey" PRIMARY KEY ("warehouse_id","product_id")
);

-- AddForeignKey
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint for stock non-negative
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_quantity_check" CHECK ("quantity" >= 0);
