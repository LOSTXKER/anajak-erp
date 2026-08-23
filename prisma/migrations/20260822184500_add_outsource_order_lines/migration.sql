-- Production V2 outsource orders allocate exact OperationQuantity rows.
CREATE TABLE "outsource_order_lines" (
    "id" TEXT NOT NULL,
    "outsource_order_id" TEXT NOT NULL,
    "operation_quantity_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outsource_order_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outsource_order_lines_qty_positive" CHECK ("qty" > 0)
);

CREATE UNIQUE INDEX "outsource_order_lines_outsource_order_id_operation_quantity_key"
ON "outsource_order_lines"("outsource_order_id", "operation_quantity_id");

CREATE INDEX "outsource_order_lines_operation_quantity_id_idx"
ON "outsource_order_lines"("operation_quantity_id");

ALTER TABLE "outsource_order_lines"
ADD CONSTRAINT "outsource_order_lines_outsource_order_id_fkey"
FOREIGN KEY ("outsource_order_id") REFERENCES "outsource_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outsource_order_lines"
ADD CONSTRAINT "outsource_order_lines_operation_quantity_id_fkey"
FOREIGN KEY ("operation_quantity_id") REFERENCES "operation_quantities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "validate_outsource_order_line_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  outsource_step TEXT;
  quantity_step TEXT;
BEGIN
  SELECT "production_step_id" INTO outsource_step
  FROM "outsource_orders"
  WHERE "id" = NEW."outsource_order_id";

  SELECT "production_step_id" INTO quantity_step
  FROM "operation_quantities"
  WHERE "id" = NEW."operation_quantity_id";

  IF outsource_step IS NULL OR quantity_step IS NULL OR outsource_step IS DISTINCT FROM quantity_step THEN
    RAISE EXCEPTION 'outsource allocation must belong to the same operation job'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "outsource_order_lines_same_operation"
BEFORE INSERT OR UPDATE ON "outsource_order_lines"
FOR EACH ROW EXECUTE FUNCTION "validate_outsource_order_line_scope"();
