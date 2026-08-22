-- Production V2 core is additive. It does not reset, delete, or fabricate
-- history in an existing database. Apply only to the explicitly selected V2 database.

-- CreateEnum
CREATE TYPE "WorkOrderState" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationState" AS ENUM ('PLANNED', 'READY', 'RUNNING', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationExecutionMode" AS ENUM ('IN_HOUSE', 'OUTSOURCE');

-- CreateEnum
CREATE TYPE "OperationPhase" AS ENUM ('PREPARATION', 'MANUFACTURING', 'OUTSOURCE', 'QUALITY', 'PACKING');

-- CreateEnum
CREATE TYPE "RoutingVersionState" AS ENUM ('DRAFT', 'RELEASED');

-- CreateEnum
CREATE TYPE "CapacityUnit" AS ENUM ('PIECE', 'MINUTE', 'BATCH');

-- CreateEnum
CREATE TYPE "WorkResourceKind" AS ENUM ('MACHINE', 'TOOL', 'LINE', 'BENCH', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkResourceState" AS ENUM ('AVAILABLE', 'IN_USE', 'DOWN', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CalendarExceptionType" AS ENUM ('CLOSED', 'WORKING', 'CAPACITY_OVERRIDE');

-- CreateEnum
CREATE TYPE "QuantityScopeKind" AS ENUM ('PRODUCT', 'VARIANT', 'PRINT_POSITION', 'VARIANT_PRINT_POSITION', 'PACK_LINE');

-- CreateEnum
CREATE TYPE "OperationEventType" AS ENUM ('CREATED', 'RELEASED', 'ASSIGNED', 'RESEQUENCED', 'STARTED', 'PAUSED', 'OUTPUT_REPORTED', 'COMPLETED', 'CANCELLED', 'BLOCKED', 'UNBLOCKED', 'EXCEPTION_RAISED', 'EXCEPTION_RESOLVED', 'REWORK_PLANNED', 'REWORK_RELEASED', 'RECEIPT_RECORDED', 'MATERIAL_ISSUED', 'MATERIAL_RETURNED', 'QC_RECORDED', 'PACK_RECORDED');

-- CreateEnum
CREATE TYPE "ExceptionState" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QualityDisposition" AS ENUM ('HOLD', 'REWORK', 'SCRAP');

-- CreateEnum
CREATE TYPE "ReworkState" AS ENUM ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'AWAITING_REINSPECTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManufacturingCommandStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "production_completion_owner_id" TEXT;

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "production_step_id" TEXT;

-- AlterTable
ALTER TABLE "qc_records" ADD COLUMN     "production_step_id" TEXT;

-- AlterTable
ALTER TABLE "qc_defects" ADD COLUMN     "disposition" "QualityDisposition",
ADD COLUMN     "operation_quantity_id" TEXT;

-- AlterTable
ALTER TABLE "productions" ADD COLUMN     "approved_mockup_snapshot" JSONB,
ADD COLUMN     "completion_owner_step_id" TEXT,
ADD COLUMN     "instruction_snapshot" JSONB,
ADD COLUMN     "planned_end_at" TIMESTAMP(3),
ADD COLUMN     "planned_start_at" TIMESTAMP(3),
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "released_by_id" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "routing_snapshot" JSONB,
ADD COLUMN     "routing_version_id" TEXT,
ADD COLUMN     "work_order_number" TEXT,
ADD COLUMN     "work_order_state" "WorkOrderState" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "material_usages" ADD COLUMN     "production_step_id" TEXT;

-- AlterTable
ALTER TABLE "production_steps" ADD COLUMN     "dispatch_sequence" INTEGER,
ADD COLUMN     "execution_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "execution_mode" "OperationExecutionMode" NOT NULL DEFAULT 'IN_HOUSE',
ADD COLUMN     "instruction_snapshot" JSONB,
ADD COLUMN     "operation_code" TEXT,
ADD COLUMN     "operation_name" TEXT,
ADD COLUMN     "operation_phase" "OperationPhase" NOT NULL DEFAULT 'MANUFACTURING',
ADD COLUMN     "operation_state" "OperationState" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN     "planned_end_at" TIMESTAMP(3),
ADD COLUMN     "planned_start_at" TIMESTAMP(3),
ADD COLUMN     "qty_good" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_planned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_rework" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_scrap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ready_at" TIMESTAMP(3),
ADD COLUMN     "reference_snapshot" JSONB,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rework_case_id" TEXT,
ADD COLUMN     "routing_operation_id" TEXT,
ADD COLUMN     "standard_minutes" INTEGER,
ADD COLUMN     "work_center_id" TEXT,
ADD COLUMN     "work_resource_id" TEXT;

-- AlterTable
ALTER TABLE "print_runs" ADD COLUMN     "operator_id" TEXT,
ADD COLUMN     "work_resource_id" TEXT;

-- AlterTable
ALTER TABLE "print_run_items" ADD COLUMN     "qty_good" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_reprint" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qty_scrap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "result_reported_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity_unit" "CapacityUnit" NOT NULL DEFAULT 'PIECE',
    "capacity_per_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_resources" (
    "id" TEXT NOT NULL,
    "work_center_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity_unit" "CapacityUnit" NOT NULL DEFAULT 'PIECE',
    "kind" "WorkResourceKind" NOT NULL DEFAULT 'MACHINE',
    "state" "WorkResourceState" NOT NULL DEFAULT 'AVAILABLE',
    "capacity_per_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_center_members" (
    "id" TEXT NOT NULL,
    "work_center_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "member_role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "can_dispatch" BOOLEAN NOT NULL DEFAULT false,
    "can_supervise" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_center_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_calendars" (
    "id" TEXT NOT NULL,
    "work_center_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_calendar_days" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_working" BOOLEAN NOT NULL DEFAULT true,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "capacity_per_day" INTEGER,

    CONSTRAINT "work_calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_calendar_exceptions" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "exception_type" "CalendarExceptionType" NOT NULL,
    "capacity_override" INTEGER,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_versions" (
    "id" TEXT NOT NULL,
    "routing_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "state" "RoutingVersionState" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "released_at" TIMESTAMP(3),
    "released_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_operations" (
    "id" TEXT NOT NULL,
    "routing_version_id" TEXT NOT NULL,
    "operation_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "execution_mode" "OperationExecutionMode" NOT NULL DEFAULT 'IN_HOUSE',
    "phase" "OperationPhase" NOT NULL DEFAULT 'MANUFACTURING',
    "work_center_id" TEXT,
    "standard_minutes" INTEGER,
    "instructions" JSONB,
    "reference_template" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_operation_dependencies" (
    "id" TEXT NOT NULL,
    "predecessor_operation_id" TEXT NOT NULL,
    "successor_operation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_operation_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_job_dependencies" (
    "id" TEXT NOT NULL,
    "predecessor_step_id" TEXT NOT NULL,
    "successor_step_id" TEXT NOT NULL,
    "source_routing_dependency_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_job_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_quantities" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "production_step_id" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "scope_kind" "QuantityScopeKind" NOT NULL,
    "source_order_item_id" TEXT,
    "source_order_item_product_id" TEXT,
    "source_order_item_variant_id" TEXT,
    "source_order_item_print_id" TEXT,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "size" TEXT,
    "color" TEXT,
    "print_position" TEXT,
    "qty_planned" INTEGER NOT NULL,
    "qty_good" INTEGER NOT NULL DEFAULT 0,
    "qty_scrap" INTEGER NOT NULL DEFAULT 0,
    "qty_rework" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reference_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_quantities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_events" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "production_step_id" TEXT,
    "event_type" "OperationEventType" NOT NULL,
    "command_id" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "actor_id" TEXT,
    "from_state" TEXT,
    "to_state" TEXT,
    "qty_good_delta" INTEGER NOT NULL DEFAULT 0,
    "qty_scrap_delta" INTEGER NOT NULL DEFAULT 0,
    "qty_rework_delta" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_exceptions" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "production_step_id" TEXT,
    "work_center_id" TEXT,
    "source_qc_defect_id" TEXT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'WARNING',
    "blocks_job" BOOLEAN NOT NULL DEFAULT true,
    "state" "ExceptionState" NOT NULL DEFAULT 'OPEN',
    "disposition" "QualityDisposition",
    "raised_by_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "resolution" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rework_cases" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "source_operation_id" TEXT,
    "source_qc_record_id" TEXT,
    "source_qc_defect_id" TEXT,
    "source_exception_id" TEXT,
    "target_work_center_id" TEXT NOT NULL,
    "state" "ReworkState" NOT NULL DEFAULT 'PLANNED',
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "requires_reinspection" BOOLEAN NOT NULL DEFAULT true,
    "reinspected_at" TIMESTAMP(3),
    "planned_by_id" TEXT NOT NULL,
    "released_by_id" TEXT,
    "released_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rework_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_reference_snapshots" (
    "id" TEXT NOT NULL,
    "production_id" TEXT NOT NULL,
    "production_step_id" TEXT,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_entity_type" TEXT,
    "source_entity_id" TEXT,
    "content_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturing_reference_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_commands" (
    "id" TEXT NOT NULL,
    "command_id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "production_id" TEXT,
    "production_step_id" TEXT,
    "actor_id" TEXT,
    "expected_revision" INTEGER NOT NULL,
    "status" "ManufacturingCommandStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_centers_code_key" ON "work_centers"("code");

-- CreateIndex
CREATE INDEX "work_centers_is_active_sort_order_idx" ON "work_centers"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "work_resources_work_center_id_is_active_idx" ON "work_resources"("work_center_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_resources_work_center_id_code_key" ON "work_resources"("work_center_id", "code");

-- CreateIndex
CREATE INDEX "work_center_members_user_id_is_active_idx" ON "work_center_members"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_center_members_work_center_id_user_id_key" ON "work_center_members"("work_center_id", "user_id");

-- CreateIndex
CREATE INDEX "work_calendars_work_center_id_is_default_idx" ON "work_calendars"("work_center_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "work_calendar_days_calendar_id_weekday_key" ON "work_calendar_days"("calendar_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "work_calendar_exceptions_calendar_id_date_key" ON "work_calendar_exceptions"("calendar_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "routings_code_key" ON "routings"("code");

-- CreateIndex
CREATE INDEX "routings_is_active_idx" ON "routings"("is_active");

-- CreateIndex
CREATE INDEX "routing_versions_state_idx" ON "routing_versions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "routing_versions_routing_id_version_number_key" ON "routing_versions"("routing_id", "version_number");

-- CreateIndex
CREATE INDEX "routing_operations_routing_version_id_sequence_idx" ON "routing_operations"("routing_version_id", "sequence");

-- CreateIndex
CREATE INDEX "routing_operations_work_center_id_idx" ON "routing_operations"("work_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "routing_operations_routing_version_id_operation_code_key" ON "routing_operations"("routing_version_id", "operation_code");

-- CreateIndex
CREATE INDEX "routing_operation_dependencies_successor_operation_id_idx" ON "routing_operation_dependencies"("successor_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "routing_operation_dependencies_predecessor_operation_id_suc_key" ON "routing_operation_dependencies"("predecessor_operation_id", "successor_operation_id");

-- CreateIndex
CREATE INDEX "operation_job_dependencies_successor_step_id_idx" ON "operation_job_dependencies"("successor_step_id");

-- CreateIndex
CREATE INDEX "operation_job_dependencies_source_routing_dependency_id_idx" ON "operation_job_dependencies"("source_routing_dependency_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_job_dependencies_predecessor_step_id_successor_st_key" ON "operation_job_dependencies"("predecessor_step_id", "successor_step_id");

-- CreateIndex
CREATE INDEX "operation_quantities_production_id_idx" ON "operation_quantities"("production_id");

-- CreateIndex
CREATE INDEX "operation_quantities_production_step_id_scope_kind_idx" ON "operation_quantities"("production_step_id", "scope_kind");

-- CreateIndex
CREATE UNIQUE INDEX "operation_quantities_production_step_id_scope_key_key" ON "operation_quantities"("production_step_id", "scope_key");

-- CreateIndex
CREATE INDEX "operation_events_production_id_occurred_at_idx" ON "operation_events"("production_id", "occurred_at");

-- CreateIndex
CREATE INDEX "operation_events_production_step_id_occurred_at_idx" ON "operation_events"("production_step_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "operation_events_command_id_sequence_key" ON "operation_events"("command_id", "sequence");

-- CreateIndex
CREATE INDEX "production_exceptions_production_id_state_blocks_job_idx" ON "production_exceptions"("production_id", "state", "blocks_job");

-- CreateIndex
CREATE INDEX "production_exceptions_production_step_id_state_blocks_job_idx" ON "production_exceptions"("production_step_id", "state", "blocks_job");

-- CreateIndex
CREATE INDEX "production_exceptions_work_center_id_state_idx" ON "production_exceptions"("work_center_id", "state");

-- CreateIndex
CREATE INDEX "production_exceptions_owner_id_state_idx" ON "production_exceptions"("owner_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "rework_cases_source_qc_defect_id_key" ON "rework_cases"("source_qc_defect_id");

-- CreateIndex
CREATE INDEX "rework_cases_production_id_state_idx" ON "rework_cases"("production_id", "state");

-- CreateIndex
CREATE INDEX "rework_cases_source_operation_id_idx" ON "rework_cases"("source_operation_id");

-- CreateIndex
CREATE INDEX "rework_cases_source_qc_record_id_idx" ON "rework_cases"("source_qc_record_id");

-- CreateIndex
CREATE INDEX "rework_cases_source_exception_id_idx" ON "rework_cases"("source_exception_id");

-- CreateIndex
CREATE INDEX "rework_cases_target_work_center_id_state_idx" ON "rework_cases"("target_work_center_id", "state");

-- CreateIndex
CREATE INDEX "manufacturing_reference_snapshots_production_id_kind_idx" ON "manufacturing_reference_snapshots"("production_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_reference_snapshots_production_id_production__key" ON "manufacturing_reference_snapshots"("production_id", "production_step_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_commands_command_id_key" ON "manufacturing_commands"("command_id");

-- CreateIndex
CREATE INDEX "manufacturing_commands_production_id_created_at_idx" ON "manufacturing_commands"("production_id", "created_at");

-- CreateIndex
CREATE INDEX "manufacturing_commands_production_step_id_created_at_idx" ON "manufacturing_commands"("production_step_id", "created_at");

-- CreateIndex
CREATE INDEX "manufacturing_commands_status_created_at_idx" ON "manufacturing_commands"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_production_completion_owner_id_key" ON "orders"("production_completion_owner_id");

-- CreateIndex
CREATE INDEX "goods_receipts_production_step_id_idx" ON "goods_receipts"("production_step_id");

-- CreateIndex
CREATE INDEX "qc_records_production_step_id_idx" ON "qc_records"("production_step_id");

-- CreateIndex
CREATE INDEX "qc_defects_operation_quantity_id_idx" ON "qc_defects"("operation_quantity_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_exceptions_source_qc_defect_id_key" ON "production_exceptions"("source_qc_defect_id");

-- CreateIndex
CREATE UNIQUE INDEX "productions_work_order_number_key" ON "productions"("work_order_number");

-- CreateIndex
CREATE UNIQUE INDEX "productions_completion_owner_step_id_key" ON "productions"("completion_owner_step_id");

-- CreateIndex
CREATE INDEX "productions_work_order_state_planned_end_at_idx" ON "productions"("work_order_state", "planned_end_at");

-- CreateIndex
CREATE INDEX "productions_routing_version_id_idx" ON "productions"("routing_version_id");

-- CreateIndex
CREATE INDEX "productions_released_by_id_idx" ON "productions"("released_by_id");

-- CreateIndex
CREATE INDEX "material_usages_production_step_id_idx" ON "material_usages"("production_step_id");

-- CreateIndex
CREATE INDEX "production_steps_work_center_id_operation_state_dispatch_se_idx" ON "production_steps"("work_center_id", "operation_state", "dispatch_sequence");

-- CreateIndex
CREATE INDEX "production_steps_work_resource_id_idx" ON "production_steps"("work_resource_id");

-- CreateIndex
CREATE INDEX "production_steps_routing_operation_id_idx" ON "production_steps"("routing_operation_id");

-- CreateIndex
CREATE INDEX "production_steps_rework_case_id_idx" ON "production_steps"("rework_case_id");

-- CreateIndex
CREATE INDEX "print_runs_operator_id_idx" ON "print_runs"("operator_id");

-- CreateIndex
CREATE INDEX "print_runs_work_resource_id_status_idx" ON "print_runs"("work_resource_id", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_production_completion_owner_id_fkey" FOREIGN KEY ("production_completion_owner_id") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_records" ADD CONSTRAINT "qc_records_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_defects" ADD CONSTRAINT "qc_defects_operation_quantity_id_fkey" FOREIGN KEY ("operation_quantity_id") REFERENCES "operation_quantities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_routing_version_id_fkey" FOREIGN KEY ("routing_version_id") REFERENCES "routing_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_completion_owner_step_id_fkey" FOREIGN KEY ("completion_owner_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_work_resource_id_fkey" FOREIGN KEY ("work_resource_id") REFERENCES "work_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_routing_operation_id_fkey" FOREIGN KEY ("routing_operation_id") REFERENCES "routing_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_rework_case_id_fkey" FOREIGN KEY ("rework_case_id") REFERENCES "rework_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_resources" ADD CONSTRAINT "work_resources_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_center_members" ADD CONSTRAINT "work_center_members_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_center_members" ADD CONSTRAINT "work_center_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_calendars" ADD CONSTRAINT "work_calendars_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_calendar_days" ADD CONSTRAINT "work_calendar_days_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "work_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_calendar_exceptions" ADD CONSTRAINT "work_calendar_exceptions_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "work_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_versions" ADD CONSTRAINT "routing_versions_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_versions" ADD CONSTRAINT "routing_versions_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_routing_version_id_fkey" FOREIGN KEY ("routing_version_id") REFERENCES "routing_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operation_dependencies" ADD CONSTRAINT "routing_operation_dependencies_predecessor_operation_id_fkey" FOREIGN KEY ("predecessor_operation_id") REFERENCES "routing_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operation_dependencies" ADD CONSTRAINT "routing_operation_dependencies_successor_operation_id_fkey" FOREIGN KEY ("successor_operation_id") REFERENCES "routing_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_job_dependencies" ADD CONSTRAINT "operation_job_dependencies_predecessor_step_id_fkey" FOREIGN KEY ("predecessor_step_id") REFERENCES "production_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_job_dependencies" ADD CONSTRAINT "operation_job_dependencies_successor_step_id_fkey" FOREIGN KEY ("successor_step_id") REFERENCES "production_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_job_dependencies" ADD CONSTRAINT "operation_job_dependencies_source_routing_dependency_id_fkey" FOREIGN KEY ("source_routing_dependency_id") REFERENCES "routing_operation_dependencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_quantities" ADD CONSTRAINT "operation_quantities_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_quantities" ADD CONSTRAINT "operation_quantities_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_events" ADD CONSTRAINT "operation_events_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_events" ADD CONSTRAINT "operation_events_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_events" ADD CONSTRAINT "operation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_work_center_id_fkey" FOREIGN KEY ("work_center_id") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_source_qc_defect_id_fkey" FOREIGN KEY ("source_qc_defect_id") REFERENCES "qc_defects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_exceptions" ADD CONSTRAINT "production_exceptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_source_operation_id_fkey" FOREIGN KEY ("source_operation_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_source_qc_record_id_fkey" FOREIGN KEY ("source_qc_record_id") REFERENCES "qc_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_source_qc_defect_id_fkey" FOREIGN KEY ("source_qc_defect_id") REFERENCES "qc_defects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_source_exception_id_fkey" FOREIGN KEY ("source_exception_id") REFERENCES "production_exceptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_target_work_center_id_fkey" FOREIGN KEY ("target_work_center_id") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_planned_by_id_fkey" FOREIGN KEY ("planned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_cases" ADD CONSTRAINT "rework_cases_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_reference_snapshots" ADD CONSTRAINT "manufacturing_reference_snapshots_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_reference_snapshots" ADD CONSTRAINT "manufacturing_reference_snapshots_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_commands" ADD CONSTRAINT "manufacturing_commands_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_commands" ADD CONSTRAINT "manufacturing_commands_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_commands" ADD CONSTRAINT "manufacturing_commands_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_work_resource_id_fkey" FOREIGN KEY ("work_resource_id") REFERENCES "work_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Production V2 domain constraints. Unknown standards/capacity stay NULL; the
-- database never invents a duration or daily rate.
ALTER TABLE "work_centers"
  ADD CONSTRAINT "work_centers_capacity_per_day_check"
  CHECK ("capacity_per_day" IS NULL OR "capacity_per_day" > 0);

ALTER TABLE "work_resources"
  ADD CONSTRAINT "work_resources_capacity_per_day_check"
  CHECK ("capacity_per_day" IS NULL OR "capacity_per_day" > 0);

ALTER TABLE "work_calendars"
  ADD CONSTRAINT "work_calendars_valid_range_check"
  CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from");

ALTER TABLE "work_calendar_days"
  ADD CONSTRAINT "work_calendar_days_weekday_check"
  CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "work_calendar_days_minutes_check"
  CHECK (
    ("start_minute" IS NULL OR "start_minute" BETWEEN 0 AND 1439)
    AND ("end_minute" IS NULL OR "end_minute" BETWEEN 1 AND 1440)
    AND ("start_minute" IS NULL OR "end_minute" IS NULL OR "start_minute" < "end_minute")
  ),
  ADD CONSTRAINT "work_calendar_days_capacity_check"
  CHECK ("capacity_per_day" IS NULL OR "capacity_per_day" > 0);

ALTER TABLE "work_calendar_exceptions"
  ADD CONSTRAINT "work_calendar_exceptions_minutes_check"
  CHECK (
    ("start_minute" IS NULL OR "start_minute" BETWEEN 0 AND 1439)
    AND ("end_minute" IS NULL OR "end_minute" BETWEEN 1 AND 1440)
    AND ("start_minute" IS NULL OR "end_minute" IS NULL OR "start_minute" < "end_minute")
  ),
  ADD CONSTRAINT "work_calendar_exceptions_capacity_check"
  CHECK ("capacity_override" IS NULL OR "capacity_override" > 0);

ALTER TABLE "routing_versions"
  ADD CONSTRAINT "routing_versions_version_number_check"
  CHECK ("version_number" > 0),
  ADD CONSTRAINT "routing_versions_revision_check"
  CHECK ("revision" >= 0);

ALTER TABLE "routing_operations"
  ADD CONSTRAINT "routing_operations_sequence_check"
  CHECK ("sequence" >= 0),
  ADD CONSTRAINT "routing_operations_standard_minutes_check"
  CHECK ("standard_minutes" IS NULL OR "standard_minutes" > 0);

ALTER TABLE "routing_operation_dependencies"
  ADD CONSTRAINT "routing_operation_dependencies_not_self_check"
  CHECK ("predecessor_operation_id" <> "successor_operation_id");

ALTER TABLE "operation_job_dependencies"
  ADD CONSTRAINT "operation_job_dependencies_not_self_check"
  CHECK ("predecessor_step_id" <> "successor_step_id");

ALTER TABLE "productions"
  ADD CONSTRAINT "productions_revision_check"
  CHECK ("revision" >= 0);

ALTER TABLE "production_steps"
  ADD CONSTRAINT "production_steps_v2_quantity_check"
  CHECK (
    "qty_planned" >= 0
    AND "qty_good" >= 0
    AND "qty_scrap" >= 0
    AND "qty_rework" >= 0
    AND "qty_good" <= "qty_planned"
  ),
  ADD CONSTRAINT "production_steps_revision_check"
  CHECK ("revision" >= 0),
  ADD CONSTRAINT "production_steps_standard_minutes_check"
  CHECK ("standard_minutes" IS NULL OR "standard_minutes" > 0);

ALTER TABLE "operation_quantities"
  ADD CONSTRAINT "operation_quantities_totals_check"
  CHECK (
    "qty_planned" >= 0
    AND "qty_good" >= 0
    AND "qty_scrap" >= 0
    AND "qty_rework" >= 0
    AND "qty_good" <= "qty_planned"
  ),
  ADD CONSTRAINT "operation_quantities_revision_check"
  CHECK ("revision" >= 0);

ALTER TABLE "print_run_items"
  ADD CONSTRAINT "print_run_items_v2_result_check"
  CHECK (
    "qty" >= 0
    AND "extra_qty" >= 0
    AND "qty_good" >= 0
    AND "qty_scrap" >= 0
    AND "qty_reprint" >= 0
    AND "qty_good" <= "qty"
    AND "qty_reprint" <= "qty_scrap"
  );

ALTER TABLE "production_exceptions"
  ADD CONSTRAINT "production_exceptions_revision_check"
  CHECK ("revision" >= 0);

ALTER TABLE "rework_cases"
  ADD CONSTRAINT "rework_cases_qty_check"
  CHECK ("qty" > 0),
  ADD CONSTRAINT "rework_cases_revision_check"
  CHECK ("revision" >= 0);

ALTER TABLE "manufacturing_commands"
  ADD CONSTRAINT "manufacturing_commands_expected_revision_check"
  CHECK ("expected_revision" >= 0);

-- PostgreSQL unique constraints treat NULL values as distinct. This partial
-- index closes that gap for work-order-level snapshots.
CREATE UNIQUE INDEX "manufacturing_reference_snapshots_work_order_key"
  ON "manufacturing_reference_snapshots"("production_id", "kind", "version")
  WHERE "production_step_id" IS NULL;

CREATE UNIQUE INDEX "work_calendars_one_default_per_center_key"
  ON "work_calendars"("work_center_id")
  WHERE "is_default" = true;

-- Released routing versions and their graph are immutable. New work must clone
-- a new draft version instead of rewriting manufacturing history.
CREATE OR REPLACE FUNCTION "reject_released_routing_version_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."state" = 'RELEASED' THEN
    RAISE EXCEPTION 'released routing versions are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "routing_versions_released_immutable"
BEFORE UPDATE OR DELETE ON "routing_versions"
FOR EACH ROW EXECUTE FUNCTION "reject_released_routing_version_mutation"();

CREATE OR REPLACE FUNCTION "reject_released_routing_operation_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF EXISTS (
      SELECT 1
      FROM "routing_versions"
      WHERE "id" = OLD."routing_version_id"
        AND "state" = 'RELEASED'
    ) THEN
      RAISE EXCEPTION 'operations in a released routing version are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF EXISTS (
      SELECT 1
      FROM "routing_versions"
      WHERE "id" = NEW."routing_version_id"
        AND "state" = 'RELEASED'
    ) THEN
      RAISE EXCEPTION 'operations in a released routing version are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "routing_operations_released_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "routing_operations"
FOR EACH ROW EXECUTE FUNCTION "reject_released_routing_operation_mutation"();

CREATE OR REPLACE FUNCTION "reject_released_routing_dependency_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF EXISTS (
      SELECT 1
      FROM "routing_operations" ro
      JOIN "routing_versions" rv ON rv."id" = ro."routing_version_id"
      WHERE ro."id" IN (OLD."predecessor_operation_id", OLD."successor_operation_id")
        AND rv."state" = 'RELEASED'
    ) THEN
      RAISE EXCEPTION 'dependencies in a released routing version are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF EXISTS (
      SELECT 1
      FROM "routing_operations" ro
      JOIN "routing_versions" rv ON rv."id" = ro."routing_version_id"
      WHERE ro."id" IN (NEW."predecessor_operation_id", NEW."successor_operation_id")
        AND rv."state" = 'RELEASED'
    ) THEN
      RAISE EXCEPTION 'dependencies in a released routing version are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "routing_dependencies_released_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "routing_operation_dependencies"
FOR EACH ROW EXECUTE FUNCTION "reject_released_routing_dependency_mutation"();

-- Keep dependency/snapshot rows inside one manufacturing scope even if a
-- caller bypasses the service layer.
CREATE OR REPLACE FUNCTION "validate_routing_dependency_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_version TEXT;
  successor_version TEXT;
BEGIN
  SELECT "routing_version_id" INTO predecessor_version
  FROM "routing_operations"
  WHERE "id" = NEW."predecessor_operation_id";

  SELECT "routing_version_id" INTO successor_version
  FROM "routing_operations"
  WHERE "id" = NEW."successor_operation_id";

  IF predecessor_version IS DISTINCT FROM successor_version THEN
    RAISE EXCEPTION 'routing dependency operations must share a routing version'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "routing_dependencies_same_version"
BEFORE INSERT OR UPDATE ON "routing_operation_dependencies"
FOR EACH ROW EXECUTE FUNCTION "validate_routing_dependency_scope"();

CREATE OR REPLACE FUNCTION "validate_operation_job_dependency_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_production TEXT;
  successor_production TEXT;
BEGIN
  SELECT "production_id" INTO predecessor_production
  FROM "production_steps"
  WHERE "id" = NEW."predecessor_step_id";

  SELECT "production_id" INTO successor_production
  FROM "production_steps"
  WHERE "id" = NEW."successor_step_id";

  IF predecessor_production IS DISTINCT FROM successor_production THEN
    RAISE EXCEPTION 'operation dependency jobs must share a manufacturing order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "operation_job_dependencies_same_production"
BEFORE INSERT OR UPDATE ON "operation_job_dependencies"
FOR EACH ROW EXECUTE FUNCTION "validate_operation_job_dependency_scope"();

CREATE OR REPLACE FUNCTION "validate_operation_quantity_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  step_production TEXT;
BEGIN
  SELECT "production_id" INTO step_production
  FROM "production_steps"
  WHERE "id" = NEW."production_step_id";

  IF step_production IS DISTINCT FROM NEW."production_id" THEN
    RAISE EXCEPTION 'operation quantity must belong to its operation manufacturing order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "operation_quantities_same_production"
BEFORE INSERT OR UPDATE ON "operation_quantities"
FOR EACH ROW EXECUTE FUNCTION "validate_operation_quantity_scope"();

CREATE OR REPLACE FUNCTION "validate_completion_owner_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_production TEXT;
BEGIN
  IF NEW."completion_owner_step_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "production_id" INTO owner_production
  FROM "production_steps"
  WHERE "id" = NEW."completion_owner_step_id";

  IF owner_production IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'completion owner operation must belong to its manufacturing order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "productions_completion_owner_same_scope"
BEFORE INSERT OR UPDATE OF "completion_owner_step_id" ON "productions"
FOR EACH ROW EXECUTE FUNCTION "validate_completion_owner_scope"();

CREATE OR REPLACE FUNCTION "validate_order_completion_owner_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_order TEXT;
BEGIN
  IF NEW."production_completion_owner_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "order_id" INTO owner_order
  FROM "productions"
  WHERE "id" = NEW."production_completion_owner_id";

  IF owner_order IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'completion owner manufacturing order must belong to its sales order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_completion_owner_same_scope"
BEFORE INSERT OR UPDATE OF "production_completion_owner_id" ON "orders"
FOR EACH ROW EXECUTE FUNCTION "validate_order_completion_owner_scope"();

CREATE OR REPLACE FUNCTION "validate_operation_resource_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resource_center TEXT;
BEGIN
  IF NEW."work_resource_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "work_center_id" INTO resource_center
  FROM "work_resources"
  WHERE "id" = NEW."work_resource_id";

  IF NEW."work_center_id" IS NULL OR resource_center IS DISTINCT FROM NEW."work_center_id" THEN
    RAISE EXCEPTION 'operation resource must belong to the selected work center'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "production_steps_resource_same_center"
BEFORE INSERT OR UPDATE OF "work_center_id", "work_resource_id" ON "production_steps"
FOR EACH ROW EXECUTE FUNCTION "validate_operation_resource_scope"();

-- Manufacturing events and released references are append-only audit data.
CREATE OR REPLACE FUNCTION "reject_manufacturing_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'manufacturing ledger rows are append-only'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "operation_events_append_only"
BEFORE UPDATE OR DELETE ON "operation_events"
FOR EACH ROW EXECUTE FUNCTION "reject_manufacturing_ledger_mutation"();

CREATE TRIGGER "manufacturing_snapshots_append_only"
BEFORE UPDATE OR DELETE ON "manufacturing_reference_snapshots"
FOR EACH ROW EXECUTE FUNCTION "reject_manufacturing_ledger_mutation"();
