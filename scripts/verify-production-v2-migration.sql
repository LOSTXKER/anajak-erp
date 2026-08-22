-- Run only against a disposable PostgreSQL database after `prisma migrate deploy`.
-- Every fixture is rolled back; this verifies database-level invariants that
-- Prisma's generated types cannot exercise.
BEGIN;

INSERT INTO "users" ("id", "supabase_id", "email", "name", "updated_at")
VALUES ('v2-user', 'v2-user', 'v2@example.invalid', 'V2 migration test', CURRENT_TIMESTAMP);

INSERT INTO "customers" ("id", "name", "updated_at")
VALUES
  ('v2-customer-a', 'V2 customer A', CURRENT_TIMESTAMP),
  ('v2-customer-b', 'V2 customer B', CURRENT_TIMESTAMP);

INSERT INTO "orders" (
  "id", "order_number", "customer_id", "created_by_id", "title", "updated_at"
)
VALUES
  ('v2-order-a', 'V2-ORDER-A', 'v2-customer-a', 'v2-user', 'V2 order A', CURRENT_TIMESTAMP),
  ('v2-order-b', 'V2-ORDER-B', 'v2-customer-b', 'v2-user', 'V2 order B', CURRENT_TIMESTAMP);

INSERT INTO "work_centers" ("id", "code", "name", "updated_at")
VALUES
  ('v2-center-a', 'V2_CENTER_A', 'V2 center A', CURRENT_TIMESTAMP),
  ('v2-center-b', 'V2_CENTER_B', 'V2 center B', CURRENT_TIMESTAMP);

INSERT INTO "work_resources" (
  "id", "work_center_id", "code", "name", "updated_at"
)
VALUES ('v2-resource-a', 'v2-center-a', 'MACHINE_A', 'Machine A', CURRENT_TIMESTAMP);

INSERT INTO "routings" ("id", "code", "name", "updated_at")
VALUES ('v2-routing', 'V2_ROUTING', 'V2 routing', CURRENT_TIMESTAMP);

INSERT INTO "routing_versions" (
  "id", "routing_id", "version_number", "updated_at"
)
VALUES ('v2-routing-version', 'v2-routing', 1, CURRENT_TIMESTAMP);

INSERT INTO "routing_operations" (
  "id", "routing_version_id", "operation_code", "name", "sequence", "work_center_id", "updated_at"
)
VALUES
  ('v2-route-op-a', 'v2-routing-version', 'A', 'Operation A', 10, 'v2-center-a', CURRENT_TIMESTAMP),
  ('v2-route-op-b', 'v2-routing-version', 'B', 'Operation B', 20, 'v2-center-b', CURRENT_TIMESTAMP);

INSERT INTO "routing_operation_dependencies" (
  "id", "predecessor_operation_id", "successor_operation_id"
)
VALUES ('v2-route-dependency', 'v2-route-op-a', 'v2-route-op-b');

UPDATE "routing_versions"
SET "state" = 'RELEASED', "released_at" = CURRENT_TIMESTAMP, "released_by_id" = 'v2-user'
WHERE "id" = 'v2-routing-version';

DO $verify$
BEGIN
  BEGIN
    UPDATE "routing_operations" SET "name" = 'must fail' WHERE "id" = 'v2-route-op-a';
    RAISE EXCEPTION 'released routing operation mutation was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$verify$;

INSERT INTO "productions" (
  "id", "order_id", "work_order_number", "routing_version_id", "updated_at"
)
VALUES
  ('v2-production-a', 'v2-order-a', 'V2-WO-A', 'v2-routing-version', CURRENT_TIMESTAMP),
  ('v2-production-b', 'v2-order-b', 'V2-WO-B', 'v2-routing-version', CURRENT_TIMESTAMP);

INSERT INTO "production_steps" (
  "id", "production_id", "step_type", "sort_order", "operation_code", "operation_name",
  "work_center_id", "work_resource_id", "execution_enabled", "qty_planned", "updated_at"
)
VALUES
  ('v2-step-a', 'v2-production-a', 'CUSTOM', 10, 'A', 'Operation A',
   'v2-center-a', 'v2-resource-a', true, 10, CURRENT_TIMESTAMP),
  ('v2-step-b', 'v2-production-a', 'CUSTOM', 20, 'B', 'Operation B',
   'v2-center-b', NULL, true, 10, CURRENT_TIMESTAMP),
  ('v2-step-other-order', 'v2-production-b', 'CUSTOM', 10, 'A', 'Operation A',
   'v2-center-a', NULL, true, 10, CURRENT_TIMESTAMP);

INSERT INTO "operation_job_dependencies" (
  "id", "predecessor_step_id", "successor_step_id"
)
VALUES ('v2-job-dependency', 'v2-step-a', 'v2-step-b');

INSERT INTO "operation_quantities" (
  "id", "production_id", "production_step_id", "scope_key", "scope_kind",
  "description", "qty_planned", "reference_snapshot", "updated_at"
)
VALUES (
  'v2-quantity', 'v2-production-a', 'v2-step-a', 'BLACK-M', 'VARIANT',
  'Black M', 10, '{}'::jsonb, CURRENT_TIMESTAMP
), (
  'v2-quantity-other', 'v2-production-b', 'v2-step-other-order', 'WHITE-L', 'VARIANT',
  'White L', 10, '{}'::jsonb, CURRENT_TIMESTAMP
);

DO $verify$
BEGIN
  BEGIN
    UPDATE "operation_quantities" SET "qty_good" = 11 WHERE "id" = 'v2-quantity';
    RAISE EXCEPTION 'quantity above plan was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "production_steps"
    SET "work_resource_id" = 'v2-resource-a', "work_center_id" = 'v2-center-b'
    WHERE "id" = 'v2-step-b';
    RAISE EXCEPTION 'resource from another work center was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "orders"
    SET "production_completion_owner_id" = 'v2-production-b'
    WHERE "id" = 'v2-order-a';
    RAISE EXCEPTION 'completion owner from another order was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$verify$;

INSERT INTO "vendors" ("id", "name", "updated_at")
VALUES ('v2-vendor', 'V2 vendor', CURRENT_TIMESTAMP);

INSERT INTO "outsource_orders" (
  "id", "production_step_id", "vendor_id", "description", "quantity",
  "unit_cost", "total_cost", "updated_at"
)
VALUES (
  'v2-outsource', 'v2-step-a', 'v2-vendor', 'V2 outsource', 5,
  0, 0, CURRENT_TIMESTAMP
);

INSERT INTO "outsource_order_lines" (
  "id", "outsource_order_id", "operation_quantity_id", "qty"
)
VALUES ('v2-outsource-line', 'v2-outsource', 'v2-quantity', 5);

DO $verify$
BEGIN
  BEGIN
    INSERT INTO "outsource_order_lines" (
      "id", "outsource_order_id", "operation_quantity_id", "qty"
    ) VALUES (
      'v2-outsource-line-wrong-scope', 'v2-outsource', 'v2-quantity-other', 1
    );
    RAISE EXCEPTION 'outsource allocation from another operation was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "outsource_order_lines" SET "qty" = 0
    WHERE "id" = 'v2-outsource-line';
    RAISE EXCEPTION 'non-positive outsource allocation was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$verify$;

INSERT INTO "operation_events" (
  "id", "production_id", "production_step_id", "event_type", "command_id"
)
VALUES ('v2-event', 'v2-production-a', 'v2-step-a', 'CREATED', 'v2-command');

DO $verify$
BEGIN
  BEGIN
    UPDATE "operation_events" SET "to_state" = 'RUNNING' WHERE "id" = 'v2-event';
    RAISE EXCEPTION 'append-only event mutation was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    DELETE FROM "operation_events" WHERE "id" = 'v2-event';
    RAISE EXCEPTION 'append-only event deletion was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$verify$;

ROLLBACK;
