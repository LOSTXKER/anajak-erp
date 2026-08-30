/**
 * ชุดข้อมูลสำหรับลอง ERP/Station บนฐาน local แยกเท่านั้น
 *
 * ปลอดภัยโดยตั้งใจ:
 * - ไม่ใช่ canonical `prisma/seed.ts` และไม่ถูกเรียกอัตโนมัติ
 * - ยอมทำงานเฉพาะ 127.0.0.1:5433/anajak_erp_demo + --reset + token ตรงกัน
 * - เก็บ auth mapping/settings/master ที่ไม่ใช่สต๊อก แล้วสร้าง Product/ProductVariant DEMO-* ใหม่ทุก reset
 * - ปฏิเสธฐานที่มี Stock credentials และไม่เรียก Stock API จริง
 */
import {
  Prisma,
  PrismaClient,
  type CustomerStatus,
  type InternalStatus,
  type OperationPhase,
  type OperationState,
  type ProductionStepType,
  type StepStatus,
  type WorkOrderState,
} from "@prisma/client";
import {
  assertDemoSeedPlan,
  buildDemoResetTableNames,
  DEMO_SEED_SCENARIOS,
  type DemoSeedFeature,
  type DemoSeedScenario,
  validateDemoDatabaseUrl,
  validateDemoSeedInvocation,
} from "../src/lib/demo-seed-plan";

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1_000;
const DEMO_ART =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#f4f4f5"/><circle cx="320" cy="210" r="112" fill="#2563eb"/><path d="M252 218h136v32H252z" fill="white"/><text x="320" y="390" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#18181b">ANAJAK DEMO</text></svg>',
  );

const V2_WORK_CENTERS = [
  { id: "demo-wc-prep", code: "PREP", name: "เตรียมงาน", sortOrder: 10 },
  { id: "demo-wc-dtf", code: "DTF_PRINT", name: "พิมพ์ DTF", sortOrder: 20 },
  { id: "demo-wc-press", code: "HEAT_PRESS", name: "รีดร้อน", sortOrder: 30 },
  { id: "demo-wc-qc", code: "FINAL_QC", name: "ตรวจคุณภาพขั้นสุดท้าย", sortOrder: 40 },
  { id: "demo-wc-pack", code: "FINAL_PACK", name: "แพ็กขั้นสุดท้าย", sortOrder: 50 },
  { id: "demo-wc-outsource", code: "OUTSOURCE", name: "งานส่งผลิตภายนอก", sortOrder: 60 },
] as const;

const V2_CENTER_ID = Object.fromEntries(
  V2_WORK_CENTERS.map((center) => [center.code, center.id]),
) as Record<(typeof V2_WORK_CENTERS)[number]["code"], string>;

const V2_ROUTING = {
  standard: {
    routingId: "demo-routing-standard",
    versionId: "demo-routing-standard-v1",
  },
  outsource: {
    routingId: "demo-routing-outsource",
    versionId: "demo-routing-outsource-v1",
  },
} as const;

const DEMO_STOCK_PRODUCTS = {
  ready: {
    id: "demo-stock-product-ready",
    sku: "DEMO-POLO-READY",
    name: "โปโล Dry-Tech · สต๊อกทดสอบ",
    productType: "POLO",
    variants: [
      {
        id: "demo-stock-ready-s",
        sku: "DEMO-POLO-BLK-S",
        size: "S",
        color: "ดำ",
        stock: 24,
      },
      {
        id: "demo-stock-ready-m",
        sku: "DEMO-POLO-BLK-M",
        size: "M",
        color: "ดำ",
        stock: 24,
      },
      {
        id: "demo-stock-ready-l",
        sku: "DEMO-POLO-BLK-L",
        size: "L",
        color: "ดำ",
        stock: 24,
      },
    ],
  },
  blocked: {
    id: "demo-stock-product-blocked",
    sku: "DEMO-TEE-SHORT",
    name: "เสื้อยืด Heavy Cotton · สต๊อกทดสอบ",
    productType: "T_SHIRT",
    variants: [
      {
        id: "demo-stock-blocked-s",
        sku: "DEMO-TEE-CREAM-S",
        size: "S",
        color: "ครีม",
        stock: 20,
      },
      {
        id: "demo-stock-blocked-m",
        sku: "DEMO-TEE-CREAM-M",
        size: "M",
        color: "ครีม",
        stock: 20,
      },
      {
        id: "demo-stock-blocked-l",
        sku: "DEMO-TEE-CREAM-L",
        size: "L",
        color: "ครีม",
        stock: 6,
      },
    ],
  },
} as const;

const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const fromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1_000);
function bangkokPeriod() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("สร้างงวดเลขเอกสาร demo ไม่ได้");
  return `${year}${month}`;
}

function splitQuantity(quantity: number, color: string) {
  const small = Math.floor(quantity * 0.25);
  const medium = Math.floor(quantity * 0.4);
  return [
    { size: "S", color, quantity: small },
    { size: "M", color, quantity: medium },
    { size: "L", color, quantity: quantity - small - medium },
  ];
}

function orderPrice(quantity: number) {
  const productUnit = money(105);
  const printUnit = money(65);
  const subtotalItems = productUnit.plus(printUnit).mul(quantity);
  const subtotalFees = money(500);
  const taxable = subtotalItems.plus(subtotalFees);
  const taxAmount = taxable.mul(7).div(100).toDecimalPlaces(2);
  return {
    productUnit,
    printUnit,
    subtotalItems,
    subtotalFees,
    taxAmount,
    totalAmount: taxable.plus(taxAmount),
  };
}

function productionEndDays(status: InternalStatus) {
  switch (status) {
    case "QUALITY_CHECK":
      return -2;
    case "PACKING":
      return -4;
    case "READY_TO_SHIP":
      return -5;
    case "SHIPPED":
      return -7;
    case "COMPLETED":
      return -8;
    default:
      return null;
  }
}

const customerSeeds = [
  {
    id: "demo-customer-northstar",
    name: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    customerType: "CORPORATE" as const,
    segment: "WHOLESALE" as const,
    phone: "02-000-1101",
    email: "purchasing@northstar.example.invalid",
    taxId: "0105550001101",
    tags: ["B2B", "เครดิต 30 วัน"],
    defaultPaymentTerms: "NET_30",
    creditLimit: money(250_000),
  },
  {
    id: "demo-customer-runclub",
    name: "คุณนนท์",
    company: "Bangkok Run Club",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "080-000-2202",
    email: "team@runclub.example.invalid",
    taxId: "0105550002202",
    tags: ["อีเวนต์", "สั่งซ้ำ"],
    defaultPaymentTerms: "DEPOSIT_50",
    creditLimit: money(100_000),
  },
  {
    id: "demo-customer-campus",
    name: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "081-000-3303",
    email: "alumni@campus.example.invalid",
    taxId: "0105550003303",
    tags: ["มหาวิทยาลัย"],
    defaultPaymentTerms: "NET_30",
    creditLimit: money(150_000),
  },
  {
    id: "demo-customer-river-cafe",
    name: "คุณออม",
    company: "River Yard Cafe",
    customerType: "CORPORATE" as const,
    segment: "NEW" as const,
    phone: "082-000-4404",
    email: "hello@riveryard.example.invalid",
    taxId: "0105550004404",
    tags: ["ร้านอาหาร", "นำเสื้อมาเอง"],
    defaultPaymentTerms: "FULL_PREPAY",
    creditLimit: money(50_000),
  },
  {
    id: "demo-customer-sea-project",
    name: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    customerType: "CORPORATE" as const,
    segment: "VIP" as const,
    phone: "083-000-5505",
    email: "project@seathai.example.invalid",
    taxId: "0105550005505",
    tags: ["องค์กร", "งานด่วน"],
    defaultPaymentTerms: "DEPOSIT_50",
    creditLimit: money(300_000),
  },
  {
    id: "demo-customer-studio",
    name: "คุณฟ้า",
    company: "Sunday Studio",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "084-000-6606",
    email: "studio@sunday.example.invalid",
    taxId: "0105550006606",
    tags: ["แบรนด์", "Blind ship"],
    defaultPaymentTerms: "NET_15",
    creditLimit: money(120_000),
  },
] satisfies Prisma.CustomerCreateManyInput[];

type SeededOrder = {
  id: string;
  number: string;
  itemId: string;
  productLineId: string;
  customerId: string;
  quantity: number;
  createdAt: Date;
  blockerReason: string | null;
  variants: Array<{ size: string; color: string; quantity: number }>;
  stepIds: Partial<Record<"garment" | "dtf" | "heat" | "outsource", string>>;
};

type SeededDemoStockProduct = {
  id: string;
  name: string;
  productType: string;
  variants: Array<{
    id: string;
    sku: string;
    size: string;
    color: string;
    stock: number;
    totalStock: number;
  }>;
};

type DemoV2Operation = {
  id: string;
  code: "PREP" | "DTF_PRINT" | "HEAT_PRESS" | "OUTSOURCE" | "FINAL_QC" | "FINAL_PACK";
  name: string;
  stepType: ProductionStepType;
  phase: OperationPhase;
  state: OperationState;
  legacyStatus: StepStatus;
  workCenterId: string;
  routingOperationId: string;
  sortOrder: number;
  qtyGood: number;
  qtyScrap?: number;
  qtyRework?: number;
  assignedToId?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  executionMode?: "IN_HOUSE" | "OUTSOURCE";
};

async function seedProductionV2Master(
  tx: Prisma.TransactionClient,
  ownerId: string,
) {
  await tx.workCenter.createMany({ data: [...V2_WORK_CENTERS] });
  await tx.workResource.createMany({
    data: [
      {
        id: "demo-resource-dtf-printer-1",
        workCenterId: V2_CENTER_ID.DTF_PRINT,
        code: "DTF-01",
        name: "เครื่องพิมพ์ DTF 01",
        kind: "MACHINE",
      },
      {
        id: "demo-resource-heat-press-1",
        workCenterId: V2_CENTER_ID.HEAT_PRESS,
        code: "PRESS-01",
        name: "เครื่องรีดร้อน 01",
        kind: "MACHINE",
      },
    ],
  });
  await tx.workCenterMember.createMany({
    data: [
      { id: "demo-wcm-prep", workCenterId: V2_CENTER_ID.PREP, userId: "demo-user-prep", memberRole: "OPERATOR" },
      { id: "demo-wcm-dtf", workCenterId: V2_CENTER_ID.DTF_PRINT, userId: "demo-user-dtf", memberRole: "OPERATOR" },
      { id: "demo-wcm-press", workCenterId: V2_CENTER_ID.HEAT_PRESS, userId: "demo-user-press", memberRole: "OPERATOR" },
      { id: "demo-wcm-qc", workCenterId: V2_CENTER_ID.FINAL_QC, userId: "demo-user-press", memberRole: "OPERATOR" },
      { id: "demo-wcm-pack", workCenterId: V2_CENTER_ID.FINAL_PACK, userId: "demo-user-press", memberRole: "OPERATOR" },
      { id: "demo-wcm-outsource", workCenterId: V2_CENTER_ID.OUTSOURCE, userId: "demo-user-supervisor", memberRole: "LEAD", canDispatch: true, canSupervise: true },
    ],
  });

  await tx.routing.createMany({
    data: [
      { id: V2_ROUTING.standard.routingId, code: "DEMO_STANDARD_DTF", name: "DTF ในโรงงาน" },
      { id: V2_ROUTING.outsource.routingId, code: "DEMO_OUTSOURCE", name: "ส่งผลิตภายนอก" },
    ],
  });
  await tx.routingVersion.createMany({
    data: [
      {
        id: V2_ROUTING.standard.versionId,
        routingId: V2_ROUTING.standard.routingId,
        versionNumber: 1,
      },
      {
        id: V2_ROUTING.outsource.versionId,
        routingId: V2_ROUTING.outsource.routingId,
        versionNumber: 1,
      },
    ],
  });

  const standardOperations = [
    ["PREP", "เตรียมงาน", 10, "PREPARATION", V2_CENTER_ID.PREP],
    ["DTF_PRINT", "พิมพ์ DTF", 20, "MANUFACTURING", V2_CENTER_ID.DTF_PRINT],
    ["HEAT_PRESS", "รีดร้อน", 30, "MANUFACTURING", V2_CENTER_ID.HEAT_PRESS],
    ["FINAL_QC", "ตรวจคุณภาพขั้นสุดท้าย", 40, "QUALITY", V2_CENTER_ID.FINAL_QC],
    ["FINAL_PACK", "แพ็กขั้นสุดท้าย", 50, "PACKING", V2_CENTER_ID.FINAL_PACK],
  ] as const;
  const outsourceOperations = [
    ["PREP", "เตรียมงาน", 10, "PREPARATION", V2_CENTER_ID.PREP],
    ["OUTSOURCE", "ส่งผลิตภายนอก", 20, "OUTSOURCE", V2_CENTER_ID.OUTSOURCE],
    ["FINAL_QC", "ตรวจคุณภาพขั้นสุดท้าย", 30, "QUALITY", V2_CENTER_ID.FINAL_QC],
    ["FINAL_PACK", "แพ็กขั้นสุดท้าย", 40, "PACKING", V2_CENTER_ID.FINAL_PACK],
  ] as const;
  await tx.routingOperation.createMany({
    data: [
      ...standardOperations.map(([code, name, sequence, phase, workCenterId]) => ({
        id: `demo-route-op-standard-${code.toLowerCase()}`,
        routingVersionId: V2_ROUTING.standard.versionId,
        operationCode: code,
        name,
        sequence,
        phase,
        workCenterId,
        instructions: { text: `${name}ตามใบงานและภาพอนุมัติ` },
      })),
      ...outsourceOperations.map(([code, name, sequence, phase, workCenterId]) => ({
        id: `demo-route-op-outsource-${code.toLowerCase()}`,
        routingVersionId: V2_ROUTING.outsource.versionId,
        operationCode: code,
        name,
        sequence,
        phase,
        executionMode: code === "OUTSOURCE" ? ("OUTSOURCE" as const) : ("IN_HOUSE" as const),
        workCenterId,
        instructions: { text: `${name}ตามใบงานและภาพอนุมัติ` },
      })),
    ],
  });
  await tx.routingOperationDependency.createMany({
    data: [
      // Prep กับ DTF เริ่มขนานกันได้ แล้ว Heat Press รอทั้งสองทาง
      { id: "demo-route-dep-standard-prep-press", predecessorOperationId: "demo-route-op-standard-prep", successorOperationId: "demo-route-op-standard-heat_press" },
      { id: "demo-route-dep-standard-dtf-press", predecessorOperationId: "demo-route-op-standard-dtf_print", successorOperationId: "demo-route-op-standard-heat_press" },
      { id: "demo-route-dep-standard-press-qc", predecessorOperationId: "demo-route-op-standard-heat_press", successorOperationId: "demo-route-op-standard-final_qc" },
      { id: "demo-route-dep-standard-qc-pack", predecessorOperationId: "demo-route-op-standard-final_qc", successorOperationId: "demo-route-op-standard-final_pack" },
      { id: "demo-route-dep-outsource-prep-send", predecessorOperationId: "demo-route-op-outsource-prep", successorOperationId: "demo-route-op-outsource-outsource" },
      { id: "demo-route-dep-outsource-send-qc", predecessorOperationId: "demo-route-op-outsource-outsource", successorOperationId: "demo-route-op-outsource-final_qc" },
      { id: "demo-route-dep-outsource-qc-pack", predecessorOperationId: "demo-route-op-outsource-final_qc", successorOperationId: "demo-route-op-outsource-final_pack" },
    ],
  });
  await tx.routingVersion.updateMany({
    where: { id: { in: [V2_ROUTING.standard.versionId, V2_ROUTING.outsource.versionId] } },
    data: {
      state: "RELEASED",
      releasedAt: fromNow(-30),
      releasedById: ownerId,
    },
  });
}

function v2StateForScenario(status: InternalStatus): WorkOrderState {
  if (status === "PRODUCTION_QUEUE") return "RELEASED";
  if (["READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(status)) return "COMPLETED";
  return "IN_PROGRESS";
}

function distributeGood(
  variants: readonly { quantity: number }[],
  totalGood: number,
): number[] {
  let remaining = totalGood;
  return variants.map((variant) => {
    const good = Math.min(variant.quantity, remaining);
    remaining -= good;
    return good;
  });
}

async function seedProductionV2WorkOrder(
  tx: Prisma.TransactionClient,
  input: {
    scenario: DemoSeedScenario;
    period: string;
    orderId: string;
    productLineId: string;
    productionId: string;
    productionCreatedAt: Date;
    productionEndedAt: Date | null;
    quantity: number;
    variants: readonly { size: string; color: string; quantity: number }[];
    stepIds: SeededOrder["stepIds"];
    ownerId: string;
  },
) {
  const { scenario } = input;
  const outsource = scenario.features.includes("OUTSOURCE_OVERDUE");
  const routePrefix = outsource ? "outsource" : "standard";
  const routingVersionId = outsource
    ? V2_ROUTING.outsource.versionId
    : V2_ROUTING.standard.versionId;
  const workOrderState = v2StateForScenario(scenario.internalStatus as InternalStatus);
  const now = fromNow(0, -1);
  const isAfterProduction = [
    "QUALITY_CHECK",
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
    "COMPLETED",
  ].includes(scenario.internalStatus);
  const isAfterQc = ["PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(
    scenario.internalStatus,
  );
  const isAfterPack = ["READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(
    scenario.internalStatus,
  );

  const legacySteps = await tx.productionStep.findMany({
    where: { productionId: input.productionId },
    select: {
      id: true,
      stepType: true,
      status: true,
      assignedToId: true,
      startedAt: true,
      completedAt: true,
    },
  });
  const byId = new Map(legacySteps.map((step) => [step.id, step]));
  const operations: DemoV2Operation[] = [];

  if (input.stepIds.garment) {
    const legacy = byId.get(input.stepIds.garment)!;
    const state: OperationState =
      legacy.status === "COMPLETED"
        ? "COMPLETED"
        : legacy.status === "FAILED" || legacy.status === "ON_HOLD"
          ? "BLOCKED"
          : "READY";
    operations.push({
      id: legacy.id,
      code: "PREP",
      name: "เตรียมงาน",
      stepType: legacy.stepType,
      phase: "PREPARATION",
      state,
      legacyStatus: legacy.status,
      workCenterId: V2_CENTER_ID.PREP,
      routingOperationId: `demo-route-op-${routePrefix}-prep`,
      sortOrder: 10,
      qtyGood: state === "COMPLETED" ? input.quantity : 0,
      assignedToId: legacy.assignedToId,
      startedAt: legacy.startedAt,
      completedAt: legacy.completedAt,
    });
  }

  if (input.stepIds.dtf) {
    const legacy = byId.get(input.stepIds.dtf)!;
    const state: OperationState =
      legacy.status === "COMPLETED"
        ? "COMPLETED"
        : legacy.status === "IN_PROGRESS"
          ? "RUNNING"
          : "READY";
    operations.push({
      id: legacy.id,
      code: "DTF_PRINT",
      name: "พิมพ์ DTF",
      stepType: legacy.stepType,
      phase: "MANUFACTURING",
      state,
      legacyStatus: legacy.status,
      workCenterId: V2_CENTER_ID.DTF_PRINT,
      routingOperationId: "demo-route-op-standard-dtf_print",
      sortOrder: 20,
      qtyGood: state === "COMPLETED" ? input.quantity : 0,
      assignedToId: legacy.assignedToId,
      startedAt: legacy.startedAt,
      completedAt: legacy.completedAt,
    });
  }

  if (input.stepIds.heat) {
    const legacy = byId.get(input.stepIds.heat)!;
    const state: OperationState = isAfterProduction
      ? "COMPLETED"
      : scenario.features.includes("HEAT_PRESS")
        ? "READY"
        : "PLANNED";
    operations.push({
      id: legacy.id,
      code: "HEAT_PRESS",
      name: "รีดร้อน",
      stepType: legacy.stepType,
      phase: "MANUFACTURING",
      state,
      legacyStatus: state === "COMPLETED" ? "COMPLETED" : "PENDING",
      workCenterId: V2_CENTER_ID.HEAT_PRESS,
      routingOperationId: "demo-route-op-standard-heat_press",
      sortOrder: 30,
      qtyGood: state === "COMPLETED" ? input.quantity : 0,
      assignedToId: legacy.assignedToId,
      startedAt: legacy.startedAt,
      completedAt: legacy.completedAt,
    });
  }

  if (input.stepIds.outsource) {
    const legacy = byId.get(input.stepIds.outsource)!;
    operations.push({
      id: legacy.id,
      code: "OUTSOURCE",
      name: "ส่งผลิตภายนอก",
      stepType: legacy.stepType,
      phase: "OUTSOURCE",
      state: "RUNNING",
      legacyStatus: "IN_PROGRESS",
      workCenterId: V2_CENTER_ID.OUTSOURCE,
      routingOperationId: "demo-route-op-outsource-outsource",
      sortOrder: 20,
      qtyGood: 0,
      assignedToId: legacy.assignedToId,
      startedAt: legacy.startedAt,
      completedAt: legacy.completedAt,
      executionMode: "OUTSOURCE",
    });
  }

  const finalQcId = `demo-step-${scenario.key}-final-qc`;
  const finalPackId = `demo-step-${scenario.key}-final-pack`;
  const finalQcState: OperationState =
    scenario.internalStatus === "QUALITY_CHECK"
      ? "RUNNING"
      : isAfterQc
        ? "COMPLETED"
        : "PLANNED";
  const finalPackState: OperationState =
    scenario.internalStatus === "PACKING"
      ? "RUNNING"
      : isAfterPack
        ? "COMPLETED"
        : "PLANNED";
  operations.push(
    {
      id: finalQcId,
      code: "FINAL_QC",
      name: "ตรวจคุณภาพขั้นสุดท้าย",
      stepType: "CUSTOM",
      phase: "QUALITY",
      state: finalQcState,
      legacyStatus: finalQcState === "COMPLETED" ? "COMPLETED" : finalQcState === "RUNNING" ? "IN_PROGRESS" : "PENDING",
      workCenterId: V2_CENTER_ID.FINAL_QC,
      routingOperationId: `demo-route-op-${routePrefix}-final_qc`,
      sortOrder: outsource ? 30 : 40,
      qtyGood: finalQcState === "COMPLETED" ? input.quantity : finalQcState === "RUNNING" ? 20 : 0,
      assignedToId: finalQcState === "RUNNING" ? "demo-user-press" : null,
      startedAt: finalQcState === "RUNNING" ? fromNow(-1, -4) : null,
      completedAt: finalQcState === "COMPLETED" ? input.productionEndedAt : null,
    },
    {
      id: finalPackId,
      code: "FINAL_PACK",
      name: "แพ็กขั้นสุดท้าย",
      stepType: "CUSTOM",
      phase: "PACKING",
      state: finalPackState,
      legacyStatus: finalPackState === "COMPLETED" ? "COMPLETED" : finalPackState === "RUNNING" ? "IN_PROGRESS" : "PENDING",
      workCenterId: V2_CENTER_ID.FINAL_PACK,
      routingOperationId: `demo-route-op-${routePrefix}-final_pack`,
      sortOrder: outsource ? 40 : 50,
      qtyGood: finalPackState === "COMPLETED" ? input.quantity : finalPackState === "RUNNING" ? Math.floor(input.quantity / 2) : 0,
      assignedToId: finalPackState === "RUNNING" ? "demo-user-press" : null,
      startedAt: finalPackState === "RUNNING" ? fromNow(-1, -2) : null,
      completedAt: finalPackState === "COMPLETED" ? input.productionEndedAt : null,
    },
  );

  for (const operation of operations) {
    const common = {
      operationCode: operation.code,
      operationName: operation.name,
      operationPhase: operation.phase,
      operationState: operation.state,
      executionMode: operation.executionMode ?? ("IN_HOUSE" as const),
      workCenterId: operation.workCenterId,
      workResourceId:
        operation.code === "DTF_PRINT"
          ? "demo-resource-dtf-printer-1"
          : operation.code === "HEAT_PRESS"
            ? "demo-resource-heat-press-1"
            : null,
      routingOperationId: operation.routingOperationId,
      executionEnabled: true,
      dispatchSequence: operation.sortOrder,
      qtyPlanned: input.quantity,
      qtyGood: operation.qtyGood,
      qtyScrap: operation.qtyScrap ?? 0,
      qtyRework: operation.qtyRework ?? 0,
      qtyTotal: input.quantity,
      qtyDone: operation.qtyGood,
      status: operation.legacyStatus,
      assignedToId: operation.assignedToId ?? null,
      readyAt: operation.state === "READY" ? now : null,
      startedAt: operation.startedAt ?? null,
      completedAt: operation.completedAt ?? null,
      instructionSnapshot: { text: `${operation.name}ตามจำนวนและภาพที่อนุมัติ` },
      referenceSnapshot: { mockup: DEMO_ART, source: "LOCAL_DEMO" },
    };
    if (byId.has(operation.id)) {
      await tx.productionStep.update({ where: { id: operation.id }, data: common });
    } else {
      await tx.productionStep.create({
        data: {
          id: operation.id,
          productionId: input.productionId,
          stepType: operation.stepType,
          customStepName: operation.name,
          sortOrder: operation.sortOrder,
          createdAt: input.productionCreatedAt,
          ...common,
        },
      });
    }

    const goodByVariant = distributeGood(input.variants, operation.qtyGood);
    await tx.operationQuantity.createMany({
      data: input.variants.map((variant, index) => ({
        id: `demo-qty-${scenario.key}-${operation.code.toLowerCase()}-${index}`,
        productionId: input.productionId,
        productionStepId: operation.id,
        scopeKey: `${variant.color}:${variant.size}:FRONT`,
        scopeKind: operation.code === "FINAL_PACK" ? ("PACK_LINE" as const) : ("VARIANT_PRINT_POSITION" as const),
        sourceOrderItemProductId: input.productLineId,
        description: `${variant.color} / ${variant.size}`,
        size: variant.size,
        color: variant.color,
        printPosition: "FRONT",
        qtyPlanned: variant.quantity,
        qtyGood: goodByVariant[index],
        referenceSnapshot: { size: variant.size, color: variant.color, printPosition: "FRONT" },
      })),
    });

    const events: Prisma.OperationEventCreateManyInput[] = [
      {
        id: `demo-event-${scenario.key}-${operation.code.toLowerCase()}-created`,
        productionId: input.productionId,
        productionStepId: operation.id,
        eventType: "CREATED",
        commandId: `demo-command-${scenario.key}-${operation.code.toLowerCase()}-created`,
        actorId: input.ownerId,
        toState: "PLANNED",
        occurredAt: input.productionCreatedAt,
      },
    ];
    if (operation.qtyGood > 0) {
      events.push({
        id: `demo-event-${scenario.key}-${operation.code.toLowerCase()}-output`,
        productionId: input.productionId,
        productionStepId: operation.id,
        eventType: "OUTPUT_REPORTED",
        commandId: `demo-command-${scenario.key}-${operation.code.toLowerCase()}-output`,
        actorId: operation.assignedToId ?? input.ownerId,
        fromState: "RUNNING",
        toState: "RUNNING",
        qtyGoodDelta: operation.qtyGood,
        occurredAt: operation.completedAt ?? operation.startedAt ?? now,
      });
    }
    if (operation.state === "COMPLETED") {
      events.push({
        id: `demo-event-${scenario.key}-${operation.code.toLowerCase()}-completed`,
        productionId: input.productionId,
        productionStepId: operation.id,
        eventType: "COMPLETED",
        commandId: `demo-command-${scenario.key}-${operation.code.toLowerCase()}-completed`,
        actorId: operation.assignedToId ?? input.ownerId,
        fromState: "RUNNING",
        toState: "COMPLETED",
        occurredAt: operation.completedAt ?? now,
      });
    }
    await tx.operationEvent.createMany({ data: events });
  }

  const operationByCode = new Map(operations.map((operation) => [operation.code, operation.id]));
  const dependencies = outsource
    ? [
        ["PREP", "OUTSOURCE"],
        ["OUTSOURCE", "FINAL_QC"],
        ["FINAL_QC", "FINAL_PACK"],
      ]
    : [
        ["PREP", "HEAT_PRESS"],
        ["DTF_PRINT", "HEAT_PRESS"],
        ["HEAT_PRESS", "FINAL_QC"],
        ["FINAL_QC", "FINAL_PACK"],
      ];
  await tx.operationJobDependency.createMany({
    data: dependencies.map(([predecessor, successor], index) => ({
      id: `demo-job-dep-${scenario.key}-${index}`,
      predecessorStepId: operationByCode.get(predecessor as DemoV2Operation["code"])!,
      successorStepId: operationByCode.get(successor as DemoV2Operation["code"])!,
    })),
  });

  await tx.production.update({
    where: { id: input.productionId },
    data: {
      workOrderNumber: `MO-${input.period}-${String(scenario.sequence).padStart(4, "0")}`,
      workOrderState,
      routingVersionId,
      releasedById: input.ownerId,
      releasedAt: input.productionCreatedAt,
      revision: 1,
      routingSnapshot: { route: routePrefix, dependencies },
      instructionSnapshot: { text: "ทำตามใบงานและภาพที่ลูกค้าอนุมัติ" },
      approvedMockupSnapshot: { fileUrl: DEMO_ART, approval: "APPROVED" },
      plannedStartAt: input.productionCreatedAt,
      plannedEndAt: fromNow(scenario.deadlineInDays, 10),
      completionOwnerStepId: finalPackId,
      status: workOrderState === "COMPLETED" ? "COMPLETED" : workOrderState === "RELEASED" ? "PENDING" : "IN_PROGRESS",
      startDate: workOrderState === "RELEASED" ? null : input.productionCreatedAt,
      endDate: workOrderState === "COMPLETED" ? input.productionEndedAt : null,
    },
  });
  await tx.manufacturingReferenceSnapshot.create({
    data: {
      id: `demo-snapshot-${scenario.key}-mockup`,
      productionId: input.productionId,
      kind: "APPROVED_MOCKUP",
      contentHash: `demo-${scenario.key}-approved-v1`,
      payload: { fileUrl: DEMO_ART, approval: "APPROVED", version: 1 },
    },
  });
  await tx.order.update({
    where: { id: input.orderId },
    data: { productionCompletionOwnerId: input.productionId },
  });
  if (scenario.features.includes("BLOCKED_STOCK")) {
    const prep = operationByCode.get("PREP")!;
    await tx.productionException.create({
      data: {
        id: `demo-exception-${scenario.key}`,
        productionId: input.productionId,
        productionStepId: prep,
        workCenterId: V2_CENTER_ID.PREP,
        code: "MATERIAL_SHORTAGE",
        title: "เสื้อไม่พอเริ่มงาน",
        description: "สต๊อกทดสอบไม่ครบตามสีและไซซ์",
        severity: "CRITICAL",
        blocksJob: true,
        state: "OPEN",
        disposition: "HOLD",
        raisedById: "demo-user-prep",
      },
    });
  }
}

async function main() {
  validateDemoSeedInvocation(
    process.argv.slice(2),
    process.env.DEMO_SEED_RESET_TOKEN,
  );
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assertDemoSeedPlan(DEMO_SEED_SCENARIOS);

  const stockCredentialCount = await prisma.setting.count({
    where: { key: { in: ["stock_api_url", "stock_api_key"] } },
  });
  if (stockCredentialCount > 0) {
    throw new Error(
      "Demo seed ถูกปิดไว้: ฐานนี้มี Stock credentials — ลบออกก่อนเพื่อกันเขียนสต๊อคจริง",
    );
  }

  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    throw new Error(
      "Demo seed ต้องมี active OWNER ที่ copy จาก Supabase เพื่อให้ login ได้",
      );
  }

  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = current_schema()
    ORDER BY tablename
  `;
  const resetTables = buildDemoResetTableNames(
    tableRows.map((row) => row.table_name),
  );
  for (const table of resetTables) {
    if (!/^[a-z0-9_]+$/.test(table))
      throw new Error(`ชื่อตารางไม่ปลอดภัย: ${table}`);
  }

  const period = bangkokPeriod();
  const seeded = new Map<string, SeededOrder>();
  const dtfTimelines = {
    printing: {
      createdAt: fromNow(-1),
      printedAt: null,
      completedAt: null,
    },
    printed: {
      createdAt: fromNow(-1),
      printedAt: fromNow(0, -2),
      completedAt: null,
    },
    completed: {
      createdAt: fromNow(-5),
      printedAt: fromNow(-4),
      completedAt: fromNow(-3),
    },
    historical: {
      createdAt: fromNow(-11),
      printedAt: fromNow(-10.5),
      completedAt: fromNow(-10),
    },
  } as const;

  await prisma.$transaction(
    async (tx) => {
      if (resetTables.length > 0) {
        const quotedTables = resetTables
          .map((table) => `"${table}"`)
          .join(", ");
        await tx.$executeRawUnsafe(
          `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
        );
      }

      const seededStockProducts = {} as Record<
        keyof typeof DEMO_STOCK_PRODUCTS,
        SeededDemoStockProduct
      >;
      for (const [key, product] of Object.entries(DEMO_STOCK_PRODUCTS) as Array<
        [
          keyof typeof DEMO_STOCK_PRODUCTS,
          (typeof DEMO_STOCK_PRODUCTS)[keyof typeof DEMO_STOCK_PRODUCTS],
        ]
      >) {
        const totalStock = product.variants.reduce(
          (sum, variant) => sum + variant.stock,
          0,
        );
        await tx.product.upsert({
          where: { id: product.id },
          create: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description:
              "สินค้า local สำหรับทดสอบการจอง เบิก และคืน โดยไม่เชื่อมระบบหลัก",
            productType: product.productType,
            category: "DEMO",
            basePrice: money(105),
            costPrice: money(0),
            imageUrl: DEMO_ART,
            isActive: true,
            source: "LOCAL",
            itemType: "FINISHED_GOOD",
            unit: "PCS",
            unitName: "ตัว",
            totalStock,
          },
          update: {
            sku: product.sku,
            name: product.name,
            description:
              "สินค้า local สำหรับทดสอบการจอง เบิก และคืน โดยไม่เชื่อมระบบหลัก",
            productType: product.productType,
            category: "DEMO",
            basePrice: money(105),
            costPrice: money(0),
            imageUrl: DEMO_ART,
            isActive: true,
            source: "LOCAL",
            itemType: "FINISHED_GOOD",
            stockProductId: null,
            unit: "PCS",
            unitName: "ตัว",
            totalStock,
            lastSyncAt: null,
            deletedAt: null,
          },
        });
        await tx.productVariant.deleteMany({
          where: {
            productId: product.id,
            id: { notIn: product.variants.map((variant) => variant.id) },
          },
        });
        for (const variant of product.variants) {
          await tx.productVariant.upsert({
            where: { id: variant.id },
            create: {
              id: variant.id,
              productId: product.id,
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
              totalStock: variant.stock,
              isActive: true,
              sellingPrice: money(105),
              costPrice: money(0),
            },
            update: {
              productId: product.id,
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
              totalStock: variant.stock,
              isActive: true,
              stockVariantId: null,
              sellingPrice: money(105),
              costPrice: money(0),
            },
          });
        }
        seededStockProducts[key] = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
          select: {
            id: true,
            name: true,
            productType: true,
            variants: {
              where: { isActive: true },
              orderBy: { sku: "asc" },
              select: {
                id: true,
                sku: true,
                size: true,
                color: true,
                stock: true,
                totalStock: true,
              },
            },
          },
        });
      }

      const demoStaff = [
        {
          id: "demo-user-supervisor",
          supabaseId: "demo-local-supervisor",
          email: "supervisor@demo.invalid",
          name: "พี่ก้อย · หัวหน้าผลิต",
          role: "MANAGER" as const,
        },
        {
          id: "demo-user-prep",
          supabaseId: "demo-local-prep",
          email: "prep@demo.invalid",
          name: "นัท · เตรียมเสื้อ",
          role: "PRODUCTION_STAFF" as const,
        },
        {
          id: "demo-user-dtf",
          supabaseId: "demo-local-dtf",
          email: "dtf@demo.invalid",
          name: "บาส · พิมพ์ DTF",
          role: "PRODUCTION_STAFF" as const,
        },
        {
          id: "demo-user-press",
          supabaseId: "demo-local-press",
          email: "press@demo.invalid",
          name: "มิ้น · รีดร้อนและ QC",
          role: "PRODUCTION_STAFF" as const,
        },
      ];
      for (const staff of demoStaff) {
        await tx.user.upsert({
          where: { id: staff.id },
          create: { ...staff, isActive: true },
          update: { name: staff.name, role: staff.role, isActive: true },
        });
      }

      await seedProductionV2Master(tx, owner.id);

      await tx.customer.createMany({ data: customerSeeds });
      await tx.vendor.createMany({
        data: [
          {
            id: "demo-vendor-embroidery",
            name: "โรงปักศรีนครินทร์",
            contactName: "คุณเล็ก",
            phone: "085-000-7101",
            capabilities: ["EMBROIDERY", "TAGGING"],
            qualityRating: 4.6,
            timeRating: 4.1,
            priceRating: 4.3,
          },
          {
            id: "demo-vendor-screen",
            name: "เจริญสกรีน",
            contactName: "คุณเอก",
            phone: "085-000-7202",
            capabilities: ["SCREEN_PRINTING"],
            qualityRating: 4.4,
            timeRating: 3.8,
            priceRating: 4.5,
          },
          {
            id: "demo-vendor-sewing",
            name: "บ้านช่างเย็บ",
            contactName: "คุณนิด",
            phone: "085-000-7303",
            capabilities: ["SEWING"],
            qualityRating: 4.7,
            timeRating: 4.2,
            priceRating: 4.0,
          },
        ],
      });

      let quotationNumber = 0;
      let depositInvoiceNumber = 0;
      let finalInvoiceNumber = 0;
      let receiptNumber = 0;

      for (const [index, scenario] of DEMO_SEED_SCENARIOS.entries()) {
        const id = `demo-order-${scenario.key}`;
        const number = `ORD-${period}-${String(scenario.sequence).padStart(4, "0")}`;
        const customer = customerSeeds[scenario.customerIndex];
        const price = orderPrice(scenario.quantity);
        const features = new Set<DemoSeedFeature>(scenario.features);
        const orderCreatedAt = fromNow(-scenario.ageDays);
        const orderCompletedAt =
          scenario.internalStatus === "COMPLETED" ? fromNow(-1) : null;
        const isBlockedStock = features.has("BLOCKED_STOCK");
        const isStockPickReady = features.has("STOCK_PICK_READY");
        const stockProduct = isBlockedStock
          ? seededStockProducts.blocked
          : isStockPickReady
            ? seededStockProducts.ready
            : null;
        const isDemoStock = stockProduct !== null;
        const received =
          scenario.internalStatus === "PRODUCTION_QUEUE" ||
          (features.has("GARMENT_RECEIVE") &&
            scenario.key !== "garment-receive");
        const color = ["ดำ", "ขาว", "กรม", "ครีม", "เขียวเข้ม", "เทา"][
          scenario.customerIndex
        ];
        const stockQtyPerVariant = stockProduct
          ? Math.floor(scenario.quantity / stockProduct.variants.length)
          : 0;
        const variants = stockProduct
          ? stockProduct.variants.map((variant, variantIndex) => ({
              size: variant.size,
              color: variant.color,
              quantity:
                variantIndex === stockProduct.variants.length - 1
                  ? scenario.quantity -
                    stockQtyPerVariant * (stockProduct.variants.length - 1)
                  : stockQtyPerVariant,
            }))
          : splitQuantity(scenario.quantity, color);
        const stockShortages = isBlockedStock
          ? variants
              .map((variant, variantIndex) => ({
                ...variant,
                shortage: Math.max(
                  variant.quantity -
                    stockProduct!.variants[variantIndex]!.stock,
                  0,
                ),
              }))
              .filter((variant) => variant.shortage > 0)
          : [];
        const stockBlockerReason = isBlockedStock
          ? `สต๊อกทดสอบ ${stockShortages
              .map(
                (variant) =>
                  `${variant.size}${variant.color ? ` ${variant.color}` : ""} ขาด ${variant.shortage}`,
              )
              .join(", ")} ตัว — ต้องเติมของทดสอบหรือปรับแผนก่อนเบิก`
          : null;

        await tx.order.create({
          data: {
            id,
            orderNumber: number,
            orderType: "CUSTOM",
            channel:
              index % 4 === 0 ? "WEBSITE" : index % 3 === 0 ? "PHONE" : "LINE",
            customerId: customer.id,
            createdById: owner.id,
            customerStatus: scenario.customerStatus as CustomerStatus,
            internalStatus: scenario.internalStatus as InternalStatus,
            description:
              "งานตัวอย่างจากวันทำงานจริง เพื่อทดลอง ERP และ Station Mode",
            deadline: fromNow(scenario.deadlineInDays, 10),
            subtotalItems: price.subtotalItems,
            subtotalFees: price.subtotalFees,
            discount: money(0),
            taxRate: money(7),
            taxAmount: price.taxAmount,
            totalAmount: price.totalAmount,
            priority:
              scenario.deadlineInDays <= 1
                ? "URGENT"
                : scenario.deadlineInDays <= 3
                  ? "HIGH"
                  : "NORMAL",
            paymentTerms: customer.defaultPaymentTerms,
            poNumber:
              customer.customerType === "CORPORATE"
                ? `PO-${period}-${index + 101}`
                : null,
            shippingRecipientName: customer.company ?? customer.name,
            shippingPhone: customer.phone,
            shippingAddress: `${99 + index}/1 ถนนตัวอย่าง`,
            shippingSubDistrict: "บางนาเหนือ",
            shippingDistrict: "บางนา",
            shippingProvince: "กรุงเทพมหานคร",
            shippingPostalCode: "10260",
            blindShip: scenario.key === "packing",
            blindShipSenderName:
              scenario.key === "packing" ? customer.company : null,
            stockReservedAt: isStockPickReady ? fromNow(-2) : null,
            stockReservationError: stockBlockerReason,
            completedAt: orderCompletedAt,
            notes: "ข้อมูล demo local — ชื่อและข้อมูลติดต่อเป็นข้อมูลสมมติ",
            createdAt: orderCreatedAt,
            updatedAt: orderCompletedAt ?? fromNow(0, -1),
          },
        });

        const itemId = `demo-item-${scenario.key}`;
        const productLineId = `demo-item-product-${scenario.key}`;
        await tx.orderItem.create({
          data: {
            id: itemId,
            orderId: id,
            description: isDemoStock
              ? stockProduct.name
              : `เสื้อยืด Cotton 100% สี${color}`,
            totalQuantity: scenario.quantity,
            subtotal: price.subtotalItems,
            taxLineType: "HIRE_OF_WORK",
          },
        });
        await tx.orderItemProduct.create({
          data: {
            id: productLineId,
            orderItemId: itemId,
            productId: isDemoStock ? stockProduct.id : null,
            productType: isDemoStock ? stockProduct.productType : "T_SHIRT",
            description: isDemoStock
              ? stockProduct.name
              : `เสื้อยืด Cotton 100% สี${color}`,
            material: isDemoStock ? null : "Cotton 100%",
            baseUnitPrice: price.productUnit,
            totalQuantity: scenario.quantity,
            subtotal: price.productUnit.mul(scenario.quantity),
            itemSource: isDemoStock ? "FROM_STOCK" : "CUSTOMER_PROVIDED",
            garmentCondition: received ? "สภาพดี พร้อมผลิต" : null,
            receivedInspected: received,
            receiveNote: received ? "ตรวจจำนวนและสภาพครบตามใบรับ" : null,
          },
        });
        await tx.orderItemVariant.createMany({
          data: variants.map((variant) => ({
            id: `demo-variant-${scenario.key}-${variant.size}-${variant.color}`,
            orderItemProductId: productLineId,
            ...variant,
          })),
        });
        await tx.orderItemPrint.create({
          data: {
            id: `demo-print-${scenario.key}`,
            orderItemId: itemId,
            position: index % 2 === 0 ? "FRONT" : "BACK",
            printType: features.has("OUTSOURCE_OVERDUE")
              ? "EMBROIDERY"
              : "HEAT_TRANSFER",
            printSize: index % 3 === 0 ? "A3" : "A4",
            width: index % 3 === 0 ? 28 : 20,
            height: index % 3 === 0 ? 35 : 25,
            designNote: "วางกึ่งกลางตาม mockup ที่อนุมัติ",
            designImageUrl: DEMO_ART,
            unitPrice: price.printUnit,
          },
        });
        await tx.orderFee.create({
          data: {
            id: `demo-fee-${scenario.key}`,
            orderId: id,
            feeType: "DESIGN_FEE",
            name: "ค่าเตรียมไฟล์และวางแบบ",
            amount: price.subtotalFees,
          },
        });

        if (scenario.internalStatus !== "INQUIRY") {
          const approved = scenario.internalStatus !== "DESIGNING";
          await tx.designVersion.create({
            data: {
              id: `demo-design-${scenario.key}`,
              orderId: id,
              versionNumber: 1,
              fileUrl: DEMO_ART,
              thumbnailUrl: DEMO_ART,
              approvalStatus: approved ? "APPROVED" : "PENDING",
              designerNotes: approved
                ? "ลูกค้าอนุมัติขนาดและตำแหน่งแล้ว"
                : "รอลูกค้าตรวจตัวสะกด",
              approvedAt: approved
                ? fromNow(-Math.max(1, scenario.ageDays - 2))
                : null,
              createdAt: fromNow(-Math.max(1, scenario.ageDays - 1)),
            },
          });
        }

        if (features.has("QUOTATION")) {
          quotationNumber += 1;
          const quotationSentAt = fromNow(-Math.max(1, scenario.ageDays - 1));
          const quotationAcceptedAt =
            scenario.internalStatus === "INQUIRY" ? null : fromNow(-2);
          await tx.quotation.create({
            data: {
              id: `demo-quotation-${scenario.key}`,
              quotationNumber: `QT-${period}-${String(quotationNumber).padStart(4, "0")}`,
              orderId: id,
              customerId: customer.id,
              createdById: owner.id,
              status:
                scenario.internalStatus === "INQUIRY" ? "SENT" : "ACCEPTED",
              validUntil: fromNow(10),
              terms: customer.defaultPaymentTerms,
              subtotal: price.subtotalItems.plus(price.subtotalFees),
              tax: price.taxAmount,
              totalAmount: price.totalAmount,
              sentAt: quotationSentAt,
              acceptedAt: quotationAcceptedAt,
              buyerName: customer.name,
              buyerCompany: customer.company,
              buyerTaxId: customer.taxId,
              buyerPhone: customer.phone,
              createdAt: orderCreatedAt,
              updatedAt: quotationAcceptedAt ?? quotationSentAt,
              items: {
                create: {
                  name: scenario.title,
                  quantity: scenario.quantity,
                  unitPrice: price.subtotalItems.div(scenario.quantity),
                  totalPrice: price.subtotalItems,
                },
              },
            },
          });
        }

        const stepIds: SeededOrder["stepIds"] = {};
        const productionStatuses: InternalStatus[] = [
          "PRODUCTION_QUEUE",
          "PRODUCING",
          "QUALITY_CHECK",
          "PACKING",
          "READY_TO_SHIP",
          "SHIPPED",
          "COMPLETED",
        ];
        if (
          productionStatuses.includes(scenario.internalStatus as InternalStatus)
        ) {
          const productionId = `demo-production-${scenario.key}`;
          const productionComplete = [
            "READY_TO_SHIP",
            "SHIPPED",
            "COMPLETED",
          ].includes(scenario.internalStatus);
          const productionCreatedAt = fromNow(
            -Math.max(1, scenario.ageDays - 2),
          );
          const productionEndOffset = productionEndDays(
            scenario.internalStatus as InternalStatus,
          );
          const productionEndedAt =
            productionEndOffset === null ? null : fromNow(productionEndOffset);
          await tx.production.create({
            data: {
              id: productionId,
              orderId: id,
              status: productionComplete ? "COMPLETED" : "IN_PROGRESS",
              startDate: productionCreatedAt,
              endDate: productionEndedAt,
              notes: "ใบผลิต demo local สำหรับทดลอง workflow",
              createdAt: productionCreatedAt,
              updatedAt: productionEndedAt ?? fromNow(0, -1),
            },
          });

          if (isBlockedStock || isStockPickReady) {
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            stepIds.dtf = `demo-step-${scenario.key}-dtf`;
            stepIds.heat = `demo-step-${scenario.key}-heat`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_PICK",
                  status: isBlockedStock ? "FAILED" : "PENDING",
                  sortOrder: 10,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: isBlockedStock ? "demo-user-prep" : null,
                  notes: isBlockedStock
                    ? `[แจ้งปัญหาจากสถานี] ${stockBlockerReason}`
                    : null,
                  startedAt: isBlockedStock ? fromNow(-1, -2) : null,
                  createdAt: productionCreatedAt,
                  updatedAt: isBlockedStock
                    ? fromNow(-1, -2)
                    : productionCreatedAt,
                },
                {
                  id: stepIds.dtf,
                  productionId,
                  stepType: "DTF_PRINT",
                  status: "PENDING",
                  sortOrder: 20,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  createdAt: productionCreatedAt,
                  updatedAt: productionCreatedAt,
                },
                {
                  id: stepIds.heat,
                  productionId,
                  stepType: "HEAT_PRESS",
                  status: "PENDING",
                  sortOrder: 30,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  createdAt: productionCreatedAt,
                  updatedAt: productionCreatedAt,
                },
              ],
            });
          } else if (features.has("OUTSOURCE_OVERDUE")) {
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            stepIds.outsource = `demo-step-${scenario.key}-outsource`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_RECEIVE",
                  status: "COMPLETED",
                  sortOrder: 10,
                  qtyDone: scenario.quantity,
                  qtyTotal: scenario.quantity,
                  assignedToId: "demo-user-prep",
                  startedAt: fromNow(-8),
                  completedAt: fromNow(-7),
                  createdAt: productionCreatedAt,
                  updatedAt: fromNow(-7),
                },
                {
                  id: stepIds.outsource,
                  productionId,
                  stepType: "EMBROIDERY",
                  status: "IN_PROGRESS",
                  sortOrder: 20,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: "demo-user-supervisor",
                  startedAt: fromNow(-5),
                  notes: "ร้านแจ้งเครื่องปักเสีย กำลังเร่งส่งกลับ",
                  createdAt: productionCreatedAt,
                  updatedAt: fromNow(-1),
                },
              ],
            });
          } else {
            const garmentPending = scenario.key === "garment-receive";
            const dtfPrinting = features.has("DTF_PRINTING");
            const dtfPrinted = features.has("DTF_PRINTED");
            const heatReady = features.has("HEAT_PRESS");
            const downstreamComplete = [
              "QUALITY_CHECK",
              "PACKING",
              "READY_TO_SHIP",
              "SHIPPED",
              "COMPLETED",
            ].includes(scenario.internalStatus);
            const queuedForProduction =
              scenario.internalStatus === "PRODUCTION_QUEUE";
            const garmentStartedAt = queuedForProduction
              ? new Date(productionCreatedAt.getTime() + 60 * 60 * 1_000)
              : downstreamComplete
                ? fromNow(-12)
                : fromNow(-8);
            const garmentCompletedAt = queuedForProduction
              ? new Date(productionCreatedAt.getTime() + 2 * 60 * 60 * 1_000)
              : downstreamComplete
                ? fromNow(-11)
                : fromNow(-7);
            const dtfTimeline = dtfPrinting
              ? dtfTimelines.printing
              : dtfPrinted
                ? dtfTimelines.printed
                : heatReady
                  ? dtfTimelines.completed
                  : downstreamComplete
                    ? dtfTimelines.historical
                    : null;
            const dtfStartedAt = dtfTimeline?.createdAt ?? null;
            const dtfCompletedAt = dtfTimeline?.completedAt ?? null;
            const heatStartedAt =
              downstreamComplete && productionEndOffset !== null
                ? fromNow(productionEndOffset - 1)
                : null;
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            stepIds.dtf = `demo-step-${scenario.key}-dtf`;
            stepIds.heat = `demo-step-${scenario.key}-heat`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_RECEIVE",
                  status: garmentPending ? "PENDING" : "COMPLETED",
                  sortOrder: 10,
                  qtyDone: garmentPending ? 0 : scenario.quantity,
                  qtyTotal: scenario.quantity,
                  assignedToId: garmentPending ? null : "demo-user-prep",
                  startedAt: garmentPending ? null : garmentStartedAt,
                  completedAt: garmentPending ? null : garmentCompletedAt,
                  createdAt: productionCreatedAt,
                  updatedAt: garmentPending
                    ? productionCreatedAt
                    : garmentCompletedAt,
                },
                {
                  id: stepIds.dtf,
                  productionId,
                  stepType: "DTF_PRINT",
                  status:
                    dtfPrinting || dtfPrinted
                      ? "IN_PROGRESS"
                      : downstreamComplete || heatReady
                        ? "COMPLETED"
                        : "PENDING",
                  sortOrder: 20,
                  qtyDone:
                    downstreamComplete || heatReady ? scenario.quantity : 0,
                  qtyTotal: scenario.quantity,
                  assignedToId:
                    dtfPrinting || dtfPrinted
                      ? "demo-user-dtf"
                      : downstreamComplete || heatReady
                        ? "demo-user-dtf"
                        : null,
                  startedAt:
                    dtfPrinting || dtfPrinted || downstreamComplete || heatReady
                      ? dtfStartedAt
                      : null,
                  completedAt: dtfCompletedAt,
                  createdAt: productionCreatedAt,
                  updatedAt:
                    dtfCompletedAt ?? dtfStartedAt ?? productionCreatedAt,
                },
                {
                  id: stepIds.heat,
                  productionId,
                  stepType: "HEAT_PRESS",
                  status: downstreamComplete ? "COMPLETED" : "PENDING",
                  sortOrder: 30,
                  qtyDone: downstreamComplete ? scenario.quantity : 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: downstreamComplete ? "demo-user-press" : null,
                  startedAt: heatStartedAt,
                  completedAt: downstreamComplete ? productionEndedAt : null,
                  createdAt: productionCreatedAt,
                  updatedAt: downstreamComplete
                    ? (productionEndedAt ?? productionCreatedAt)
                    : productionCreatedAt,
                },
              ],
            });
          }

          await seedProductionV2WorkOrder(tx, {
            scenario,
            period,
            orderId: id,
            productLineId,
            productionId,
            productionCreatedAt,
            productionEndedAt,
            quantity: scenario.quantity,
            variants,
            stepIds,
            ownerId: owner.id,
          });
        }

        if (received) {
          await tx.goodsReceipt.create({
            data: {
              id: `demo-receipt-${scenario.key}`,
              orderId: id,
              productionStepId: stepIds.garment ?? null,
              receiptType: "CUSTOMER_GARMENT",
              notes: "รับครบตามไซส์ ตรวจสภาพก่อนเข้าผลิตแล้ว",
              receivedById: "demo-user-prep",
              receivedAt: fromNow(-Math.max(2, scenario.ageDays - 2)),
              createdAt: fromNow(-Math.max(2, scenario.ageDays - 2)),
              lines: {
                create: variants.map((variant) => ({
                  orderItemProductId: productLineId,
                  description:
                    stockProduct?.name ?? `เสื้อยืด Cotton 100% สี${color}`,
                  size: variant.size,
                  color: variant.color,
                  qtyExpected: variant.quantity,
                  qtyCounted: variant.quantity,
                })),
              },
            },
          });
        }

        if (features.has("QC")) {
          const isPartialCheck = scenario.key === "quality-check";
          const productionEndOffset = productionEndDays(
            scenario.internalStatus as InternalStatus,
          );
          const checkedAt = isPartialCheck
            ? fromNow(-1, -3)
            : productionEndOffset === null
              ? fromNow(-1)
              : fromNow(productionEndOffset, 6);
          await tx.qcRecord.create({
            data: {
              id: `demo-qc-${scenario.key}`,
              orderId: id,
              productionStepId: `demo-step-${scenario.key}-final-qc`,
              qtyGood: isPartialCheck ? 20 : scenario.quantity,
              qtyDefect: isPartialCheck ? 3 : 0,
              notes: isPartialCheck
                ? "ตรวจรอบแรกผ่าน 20 ตัว เหลือ 30 ตัวรอตรวจต่อ"
                : "ผ่านครบ พร้อมเข้าขั้นถัดไป",
              checkedById: "demo-user-press",
              checkedAt,
              createdAt: checkedAt,
              ...(isPartialCheck
                ? {
                    defects: {
                      create: {
                        id: `demo-qc-defect-${scenario.key}`,
                        qty: 3,
                        size: variants[0]?.size ?? null,
                        color: variants[0]?.color ?? null,
                        printLabel: "อกหน้า",
                        reason: "PRINT_PEEL",
                        disposition: "REWORK" as const,
                        note: "ฟิล์มลอกบางส่วน ส่งกลับรีดและต้องตรวจซ้ำ",
                      },
                    },
                  }
                : {}),
            },
          });
        }

        const deliveryFeature = scenario.features.find((feature) =>
          feature.startsWith("DELIVERY_"),
        );
        if (features.has("PACKING") || deliveryFeature) {
          const partial = features.has("PACKING");
          const deliveryStatus =
            deliveryFeature === "DELIVERY_COMPLETED"
              ? "DELIVERED"
              : deliveryFeature === "DELIVERY_SHIPPED"
                ? "SHIPPED"
                : "PREPARING";
          const deliveryCreatedAt =
            deliveryStatus === "DELIVERED"
              ? fromNow(-5)
              : deliveryStatus === "SHIPPED"
                ? fromNow(-4)
                : fromNow(-3);
          const shippedAt =
            deliveryStatus === "DELIVERED"
              ? fromNow(-3)
              : deliveryStatus === "SHIPPED"
                ? fromNow(-2)
                : null;
          const deliveredAt =
            deliveryStatus === "DELIVERED" ? fromNow(-2) : null;
          await tx.delivery.create({
            data: {
              id: `demo-delivery-${scenario.key}`,
              orderId: id,
              recipientName: customer.company ?? customer.name,
              phone: customer.phone ?? "02-000-0000",
              address: `${99 + index}/1 ถนนตัวอย่าง`,
              subDistrict: "บางนาเหนือ",
              district: "บางนา",
              province: "กรุงเทพมหานคร",
              postalCode: "10260",
              shippingMethod: scenario.key === "packing" ? "FLASH" : "KERRY",
              trackingNumber:
                deliveryStatus === "PREPARING"
                  ? null
                  : `THDEMO${period}${index + 1}`,
              shippingCost: money(120),
              isPaid: true,
              status: deliveryStatus,
              shippedAt,
              deliveredAt,
              notes:
                scenario.key === "packing"
                  ? "Blind ship — ห้ามใส่เอกสารชื่อ Anajak"
                  : null,
              createdAt: deliveryCreatedAt,
              updatedAt: deliveredAt ?? shippedAt ?? deliveryCreatedAt,
              lines: {
                create: variants.map((variant) => ({
                  description: scenario.title,
                  size: variant.size,
                  color: variant.color,
                  qty: partial
                    ? Math.floor(variant.quantity / 2)
                    : variant.quantity,
                })),
              },
            },
          });
        }

        if (features.has("FINANCE")) {
          const isShipped = scenario.internalStatus === "SHIPPED";
          const isCompleted = scenario.internalStatus === "COMPLETED";
          const invoiceTotal =
            isShipped || isCompleted
              ? price.totalAmount
              : price.totalAmount.div(2).toDecimalPlaces(2);
          const invoiceTax = invoiceTotal.mul(7).div(107).toDecimalPlaces(2);
          const invoiceAmount = invoiceTotal.minus(invoiceTax);
          const paymentDate = fromNow(-2);
          const invoiceType = isCompleted
            ? "RECEIPT"
            : isShipped
              ? "FINAL_INVOICE"
              : "DEPOSIT_INVOICE";
          const paymentStatus = isShipped
            ? "OVERDUE"
            : scenario.internalStatus === "DESIGNING"
              ? "UNPAID"
              : "PAID";
          const documentNumber = isCompleted
            ? `REC-${period}-${String(++receiptNumber).padStart(4, "0")}`
            : isShipped
              ? `INV-F-${period}-${String(++finalInvoiceNumber).padStart(4, "0")}`
              : `INV-D-${period}-${String(++depositInvoiceNumber).padStart(4, "0")}`;
          const invoiceId = `demo-invoice-${scenario.key}`;
          const invoiceIssueDate = isCompleted
            ? paymentDate
            : fromNow(-Math.max(1, scenario.ageDays - 1));
          await tx.invoice.create({
            data: {
              id: invoiceId,
              invoiceNumber: documentNumber,
              orderId: id,
              customerId: customer.id,
              type: invoiceType,
              amount: invoiceAmount,
              tax: invoiceTax,
              totalAmount: invoiceTotal,
              paymentStatus,
              dueDate: isCompleted
                ? null
                : isShipped
                  ? fromNow(-5)
                  : fromNow(7),
              paidAt: paymentStatus === "PAID" ? paymentDate : null,
              issueDate: invoiceIssueDate,
              buyerName: customer.name,
              buyerCompany: customer.company,
              buyerTaxId: customer.taxId,
              buyerPhone: customer.phone,
              notes: "เอกสาร demo local",
              createdAt: invoiceIssueDate,
              updatedAt:
                paymentStatus === "PAID" ? paymentDate : invoiceIssueDate,
            },
          });
          if (paymentStatus === "PAID") {
            const paymentId = `demo-payment-${scenario.key}`;
            await tx.payment.create({
              data: {
                id: paymentId,
                invoiceId,
                amount: invoiceTotal,
                method: index % 2 === 0 ? "QR" : "TRANSFER",
                reference: `DEMO-${period}-${index + 1}`,
                notes: "รับเงินในชุดข้อมูล demo",
                createdAt: paymentDate,
              },
            });
            if (!isCompleted) {
              await tx.invoice.create({
                data: {
                  id: `demo-receipt-${scenario.key}`,
                  invoiceNumber: `REC-${period}-${String(++receiptNumber).padStart(4, "0")}`,
                  orderId: id,
                  customerId: customer.id,
                  type: "RECEIPT",
                  amount: invoiceAmount,
                  tax: invoiceTax,
                  totalAmount: invoiceTotal,
                  paymentStatus: "PAID",
                  dueDate: null,
                  paidAt: paymentDate,
                  issueDate: paymentDate,
                  forPaymentId: paymentId,
                  buyerName: customer.name,
                  buyerCompany: customer.company,
                  buyerTaxId: customer.taxId,
                  buyerPhone: customer.phone,
                  notes: `ใบเสร็จของงวดรับเงิน ${documentNumber} · demo local`,
                  createdAt: paymentDate,
                  updatedAt: paymentDate,
                },
              });
            }
          }
        }

        seeded.set(scenario.key, {
          id,
          number,
          itemId,
          productLineId,
          customerId: customer.id,
          quantity: scenario.quantity,
          createdAt: orderCreatedAt,
          blockerReason: stockBlockerReason,
          variants,
          stepIds,
        });
      }

      const receiving = seeded.get("garment-receive");
      if (!receiving?.stepIds.garment) {
        throw new Error("Demo Prep partial receipt scenario ไม่ครบ");
      }
      await tx.goodsReceipt.create({
        data: {
          id: "demo-receipt-garment-receive-partial",
          orderId: receiving.id,
          productionStepId: receiving.stepIds.garment,
          receiptType: "CUSTOMER_GARMENT",
          notes: "รับบางส่วนก่อน ส่วนที่เหลือลูกค้าส่งตามวันถัดไป",
          receivedById: "demo-user-prep",
          receivedAt: fromNow(-1),
          lines: {
            create: receiving.variants.map((variant, index) => ({
              orderItemProductId: receiving.productLineId,
              description: "เสื้อพนักงานหน้าร้าน รอบสอง",
              size: variant.size,
              color: variant.color,
              qtyExpected: variant.quantity,
              qtyCounted: index === 0 ? variant.quantity : Math.floor(variant.quantity / 2),
            })),
          },
        },
      });

      const stockPick = seeded.get("stock-pick-ready");
      if (!stockPick?.stepIds.garment) {
        throw new Error("Demo Prep issue/return scenario ไม่ครบ");
      }
      await tx.materialUsage.createMany({
        data: [
          {
            id: "demo-material-issue-stock-pick",
            productionId: "demo-production-stock-pick-ready",
            productionStepId: stockPick.stepIds.garment,
            productId: DEMO_STOCK_PRODUCTS.ready.id,
            productVariantId: DEMO_STOCK_PRODUCTS.ready.variants[0].id,
            quantity: 8,
            unit: "PCS",
            movementType: "ISSUE",
            note: "เบิกเสื้อไซซ์ S ไปจุดเตรียมงาน",
          },
          {
            id: "demo-material-return-stock-pick",
            productionId: "demo-production-stock-pick-ready",
            productionStepId: stockPick.stepIds.garment,
            productId: DEMO_STOCK_PRODUCTS.ready.id,
            productVariantId: DEMO_STOCK_PRODUCTS.ready.variants[0].id,
            quantity: 1,
            unit: "PCS",
            movementType: "RETURN",
            note: "คืนเสื้อเกินจากจุดเตรียมงาน",
          },
        ],
      });

      const printing = seeded.get("dtf-printing");
      const printed = seeded.get("dtf-printed");
      const completedRunOrder = seeded.get("heat-press");
      const historicalRunOrders = [
        "quality-check",
        "packing",
        "ready-to-ship",
        "shipped",
        "completed",
      ].map((key) => seeded.get(key));
      if (
        !printing?.stepIds.dtf ||
        !printed?.stepIds.dtf ||
        !completedRunOrder?.stepIds.dtf
      ) {
        throw new Error("Demo DTF scenario ไม่ครบ");
      }
      if (historicalRunOrders.some((order) => !order?.stepIds.dtf)) {
        throw new Error("Demo DTF history scenario ไม่ครบ");
      }
      await tx.printRun.create({
        data: {
          id: "demo-print-run-printing",
          runNumber: `FR-${period}-0001`,
          status: "PRINTING",
          note: "ม้วนเช้า — ฟิล์มด้าน 60 ซม.",
          createdById: "demo-user-dtf",
          operatorId: "demo-user-dtf",
          workResourceId: "demo-resource-dtf-printer-1",
          createdAt: dtfTimelines.printing.createdAt,
          updatedAt: dtfTimelines.printing.createdAt,
          items: {
            create: {
              productionStepId: printing.stepIds.dtf,
              orderId: printing.id,
              qty: printing.quantity,
              createdAt: dtfTimelines.printing.createdAt,
            },
          },
        },
      });
      await tx.printRun.create({
        data: {
          id: "demo-print-run-printed",
          runNumber: `FR-${period}-0002`,
          status: "PRINTED",
          note: "พิมพ์เสร็จ รอตัดแยกและติดป้าย",
          createdById: "demo-user-dtf",
          operatorId: "demo-user-dtf",
          workResourceId: "demo-resource-dtf-printer-1",
          printedAt: dtfTimelines.printed.printedAt,
          createdAt: dtfTimelines.printed.createdAt,
          updatedAt: dtfTimelines.printed.printedAt,
          items: {
            create: {
              productionStepId: printed.stepIds.dtf,
              orderId: printed.id,
              qty: printed.quantity,
              qtyGood: printed.quantity - 2,
              qtyScrap: 2,
              qtyReprint: 2,
              resultReportedAt: dtfTimelines.printed.printedAt,
              createdAt: dtfTimelines.printed.createdAt,
            },
          },
        },
      });
      const completedRun = await tx.printRun.create({
        data: {
          id: "demo-print-run-completed",
          runNumber: `FR-${period}-0003`,
          status: "COMPLETED",
          note: "ตัดแยกครบ มีฟิล์มเผื่อ 3 ชิ้น",
          createdById: "demo-user-dtf",
          operatorId: "demo-user-dtf",
          workResourceId: "demo-resource-dtf-printer-1",
          printedAt: dtfTimelines.completed.printedAt,
          completedAt: dtfTimelines.completed.completedAt,
          createdAt: dtfTimelines.completed.createdAt,
          updatedAt: dtfTimelines.completed.completedAt,
          items: {
            create: {
              productionStepId: completedRunOrder.stepIds.dtf,
              orderId: completedRunOrder.id,
              qty: completedRunOrder.quantity,
              extraQty: 3,
              qtyGood: completedRunOrder.quantity,
              qtyScrap: 2,
              qtyReprint: 2,
              resultReportedAt: dtfTimelines.completed.completedAt,
              createdAt: dtfTimelines.completed.createdAt,
            },
          },
        },
      });
      await tx.filmStock.create({
        data: {
          id: "demo-film-stock-extra",
          customerId: completedRunOrder.customerId,
          orderId: completedRunOrder.id,
          printRunId: completedRun.id,
          label: "โลโก้ครบรอบ อกหน้า A4",
          qty: 3,
          initialQty: 3,
          note: "ฟิล์มเผื่อจากรอบ demo",
          createdAt: fromNow(-3),
          updatedAt: fromNow(-3),
        },
      });
      await tx.printRun.create({
        data: {
          id: "demo-print-run-historical",
          runNumber: `FR-${period}-0004`,
          status: "COMPLETED",
          note: "รอบประวัติรวมงานที่ส่งต่อเข้ารีดร้อนแล้ว",
          createdById: "demo-user-dtf",
          operatorId: "demo-user-dtf",
          workResourceId: "demo-resource-dtf-printer-1",
          printedAt: dtfTimelines.historical.printedAt,
          completedAt: dtfTimelines.historical.completedAt,
          createdAt: dtfTimelines.historical.createdAt,
          updatedAt: dtfTimelines.historical.completedAt,
          items: {
            create: historicalRunOrders.map((order) => ({
              productionStepId: order!.stepIds.dtf!,
              orderId: order!.id,
              qty: order!.quantity,
              qtyGood: order!.quantity,
              resultReportedAt: dtfTimelines.historical.completedAt,
              createdAt: dtfTimelines.historical.createdAt,
            })),
          },
        },
      });

      const outsource = seeded.get("outsource-overdue");
      if (!outsource?.stepIds.outsource)
        throw new Error("Demo outsource scenario ไม่ครบ");
      const outsourceAllocations = (outsourceOrderId: string, total: number) =>
        distributeGood(outsource.variants, total)
          .map((qty, index) => ({
            id: `demo-outsource-line-${outsourceOrderId}-${index}`,
            outsourceOrderId,
            operationQuantityId: `demo-qty-outsource-overdue-outsource-${index}`,
            qty,
          }))
          .filter((line) => line.qty > 0);
      await tx.outsourceOrder.create({
        data: {
          id: "demo-outsource-overdue",
          productionStepId: outsource.stepIds.outsource,
          vendorId: "demo-vendor-embroidery",
          status: "IN_PROGRESS",
          description: "ปักโลโก้อกซ้าย 1 ตำแหน่ง",
          quantity: outsource.quantity,
          unitCost: money(32),
          totalCost: money(32).mul(outsource.quantity),
          sentAt: fromNow(-5),
          expectedBackAt: fromNow(-1),
          notes: "เกินกำหนด 1 วัน — โทรตามแล้วช่วงเช้า",
          createdAt: fromNow(-6),
          updatedAt: fromNow(-1),
          allocations: {
            create: outsourceAllocations(
              "demo-outsource-overdue",
              outsource.quantity,
            ).map((line) => ({
              id: line.id,
              operationQuantityId: line.operationQuantityId,
              qty: line.qty,
            })),
          },
        },
      });
      await tx.outsourceOrder.createMany({
        data: [
          {
            id: "demo-outsource-history-pass",
            productionStepId: outsource.stepIds.outsource,
            vendorId: "demo-vendor-embroidery",
            status: "QC_PASSED",
            description: "รอบตัวอย่างที่รับกลับและผ่าน QC",
            quantity: 6,
            unitCost: money(32),
            totalCost: money(192),
            sentAt: fromNow(-14),
            expectedBackAt: fromNow(-11),
            receivedAt: fromNow(-11),
            qcPassed: true,
            qcNotes: "จำนวนและงานปักผ่านครบ",
            createdAt: fromNow(-15),
            updatedAt: fromNow(-11),
          },
          {
            id: "demo-outsource-history-fail",
            productionStepId: outsource.stepIds.outsource,
            vendorId: "demo-vendor-embroidery",
            status: "QC_FAILED",
            description: "รอบตัวอย่างที่รับกลับแล้วส่งแก้",
            quantity: 4,
            unitCost: money(32),
            totalCost: money(128),
            sentAt: fromNow(-10),
            expectedBackAt: fromNow(-8),
            receivedAt: fromNow(-8),
            qcPassed: false,
            qcNotes: "ตำแหน่งปักคลาด ต้องส่งกลับแก้",
            createdAt: fromNow(-11),
            updatedAt: fromNow(-8),
          },
        ],
      });
      await tx.outsourceOrderLine.createMany({
        data: [
          ...outsourceAllocations("demo-outsource-history-pass", 6),
          ...outsourceAllocations("demo-outsource-history-fail", 4),
        ],
      });

      const qualityCheck = seeded.get("quality-check");
      if (!qualityCheck) throw new Error("Demo QC/rework scenario ไม่ครบ");
      const qualityProductionId = "demo-production-quality-check";
      const finalQcStepId = "demo-step-quality-check-final-qc";
      const reworkException = await tx.productionException.create({
        data: {
          id: "demo-exception-quality-rework",
          productionId: qualityProductionId,
          productionStepId: finalQcStepId,
          workCenterId: V2_CENTER_ID.FINAL_QC,
          code: "QUALITY_DEFECT",
          title: "ฟิล์มลอก 3 ตัว รอตรวจซ้ำ",
          description: "ส่งกลับจุดรีดร้อนแล้ว ต้องตรวจซ้ำก่อนแพ็ก",
          severity: "WARNING",
          blocksJob: true,
          state: "ACKNOWLEDGED",
          disposition: "REWORK",
          raisedById: "demo-user-press",
          ownerId: "demo-user-supervisor",
          acknowledgedAt: fromNow(-1, -2),
        },
      });
      const rework = await tx.reworkCase.create({
        data: {
          id: "demo-rework-quality-check",
          productionId: qualityProductionId,
          sourceOperationId: finalQcStepId,
          sourceQcRecordId: "demo-qc-quality-check",
          sourceQcDefectId: "demo-qc-defect-quality-check",
          sourceExceptionId: reworkException.id,
          targetWorkCenterId: V2_CENTER_ID.HEAT_PRESS,
          state: "AWAITING_REINSPECTION",
          qty: 3,
          reason: "ฟิล์มลอก ส่งกลับรีดใหม่",
          requiresReinspection: true,
          plannedById: "demo-user-supervisor",
          releasedById: "demo-user-supervisor",
          releasedAt: fromNow(-1, -1),
          completedAt: fromNow(0, -3),
        },
      });
      await tx.productionStep.create({
        data: {
          id: "demo-step-quality-check-rework",
          productionId: qualityProductionId,
          stepType: "CUSTOM",
          customStepName: "รีดแก้ฟิล์มลอก",
          status: "COMPLETED",
          sortOrder: 35,
          operationCode: "REWORK-PRESS-01",
          operationName: "รีดแก้ฟิล์มลอก",
          operationState: "COMPLETED",
          operationPhase: "MANUFACTURING",
          executionMode: "IN_HOUSE",
          executionEnabled: true,
          workCenterId: V2_CENTER_ID.HEAT_PRESS,
          reworkCaseId: rework.id,
          dispatchSequence: 35,
          qtyPlanned: 3,
          qtyGood: 3,
          qtyTotal: 3,
          qtyDone: 3,
          assignedToId: "demo-user-press",
          startedAt: fromNow(0, -5),
          completedAt: fromNow(0, -3),
          instructionSnapshot: { text: "รีดใหม่เฉพาะ 3 ตัวที่ฟิล์มลอก" },
          referenceSnapshot: { sourceQcDefectId: "demo-qc-defect-quality-check" },
          createdAt: fromNow(-1),
        },
      });
      await tx.operationJobDependency.create({
        data: {
          id: "demo-job-dep-quality-rework-reinspect",
          predecessorStepId: "demo-step-quality-check-rework",
          successorStepId: finalQcStepId,
        },
      });
      await tx.operationQuantity.create({
        data: {
          id: "demo-qty-quality-rework",
          productionId: qualityProductionId,
          productionStepId: "demo-step-quality-check-rework",
          scopeKey: "REWORK:PRINT_PEEL",
          scopeKind: "VARIANT_PRINT_POSITION",
          description: "ฟิล์มลอก 3 ตัว",
          printPosition: "FRONT",
          qtyPlanned: 3,
          qtyGood: 3,
          referenceSnapshot: { sourceQcDefectId: "demo-qc-defect-quality-check" },
        },
      });
      await tx.productionStep.update({
        where: { id: finalQcStepId },
        data: {
          operationState: "BLOCKED",
          status: "ON_HOLD",
          qtyRework: 3,
          revision: { increment: 1 },
        },
      });
      await tx.operationQuantity.updateMany({
        where: { productionStepId: finalQcStepId },
        data: { qtyRework: 1 },
      });
      await tx.operationEvent.createMany({
        data: [
          {
            id: "demo-event-quality-rework-completed",
            productionId: qualityProductionId,
            productionStepId: "demo-step-quality-check-rework",
            eventType: "COMPLETED",
            commandId: "demo-command-quality-rework-completed",
            actorId: "demo-user-press",
            fromState: "RUNNING",
            toState: "COMPLETED",
            qtyGoodDelta: 3,
            occurredAt: fromNow(0, -3),
          },
          {
            id: "demo-event-quality-awaiting-reinspection",
            productionId: qualityProductionId,
            productionStepId: finalQcStepId,
            eventType: "REWORK_RELEASED",
            commandId: "demo-command-quality-awaiting-reinspection",
            actorId: "demo-user-supervisor",
            fromState: "RUNNING",
            toState: "BLOCKED",
            qtyReworkDelta: 3,
            occurredAt: fromNow(0, -3),
          },
        ],
      });

      const shipped = seeded.get("shipped");
      if (!shipped) throw new Error("Demo shipped scenario ไม่ครบ");
      const overdueInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: "demo-invoice-shipped" },
      });
      await tx.billingNote.create({
        data: {
          id: "demo-billing-note-overdue",
          billingNoteNumber: `BN-${period}-0001`,
          customerId: shipped.customerId,
          billingDate: fromNow(-7),
          dueDate: fromNow(-5),
          totalAmount: overdueInvoice.totalAmount,
          notes: "รอบวางบิล demo — เกินกำหนดชำระ",
          createdAt: fromNow(-7),
          updatedAt: fromNow(-7),
          items: {
            create: {
              invoiceId: overdueInvoice.id,
              amount: overdueInvoice.totalAmount,
            },
          },
        },
      });

      const settledPayments = await tx.payment.findMany({
        select: {
          amount: true,
          whtAmount: true,
          invoice: { select: { customerId: true } },
        },
      });
      for (const customer of customerSeeds) {
        const orders = [...seeded.values()].filter(
          (order) => order.customerId === customer.id,
        );
        const spent = settledPayments
          .filter((payment) => payment.invoice.customerId === customer.id)
          .reduce(
            (sum, payment) => sum.plus(payment.amount).plus(payment.whtAmount),
            money(0),
          );
        const lastOrderAt = orders.reduce<Date | null>(
          (latest, order) =>
            latest === null || order.createdAt > latest
              ? order.createdAt
              : latest,
          null,
        );
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalOrders: orders.length,
            totalSpent: spent,
            lastOrderAt,
          },
        });
      }

      await tx.documentSequence.createMany({
        data: [
          {
            docType: "ORDER",
            period,
            lastNumber: Math.max(
              ...DEMO_SEED_SCENARIOS.map((scenario) => scenario.sequence),
            ),
          },
          { docType: "QUOTATION", period, lastNumber: quotationNumber },
          {
            docType: "DEPOSIT_INVOICE",
            period,
            lastNumber: depositInvoiceNumber,
          },
          { docType: "FINAL_INVOICE", period, lastNumber: finalInvoiceNumber },
          { docType: "RECEIPT", period, lastNumber: receiptNumber },
          { docType: "PRINT_RUN", period, lastNumber: 4 },
          { docType: "BILLING_NOTE", period, lastNumber: 1 },
        ],
      });
      const blockedStock = seeded.get("blocked-stock");
      if (!blockedStock?.blockerReason || !blockedStock.stepIds.garment) {
        throw new Error("Demo blocked Stock scenario ไม่ครบ");
      }
      await tx.notification.createMany({
        data: [
          {
            id: "demo-notification-stock",
            userId: owner.id,
            type: "SYSTEM",
            title: "งานผลิตติดปัญหาสต๊อค",
            message: `${blockedStock.number} ${blockedStock.blockerReason}`,
            link: `/production/${blockedStock.id}`,
            entityType: "ORDER",
            entityId: blockedStock.id,
          },
          {
            id: "demo-notification-outsource",
            userId: owner.id,
            type: "DEADLINE",
            title: "ร้านนอกเกินกำหนดรับกลับ",
            message: `${seeded.get("outsource-overdue")?.number} เกินกำหนด 1 วัน`,
            link: "/outsource",
            entityType: "OUTSOURCE_ORDER",
            entityId: "demo-outsource-overdue",
          },
        ],
      });
      await tx.auditLog.createMany({
        data: [
          {
            id: "demo-audit-seed",
            userId: owner.id,
            action: "DEMO_SEED_CREATED",
            entityType: "SYSTEM",
            reason: "สร้างชุดข้อมูล local สำหรับลอง ERP/Station",
          },
          {
            id: "demo-audit-problem",
            userId: "demo-user-prep",
            action: "REPORT_PROBLEM",
            entityType: "PRODUCTION_STEP",
            entityId: blockedStock.stepIds.garment,
            reason: blockedStock.blockerReason,
          },
        ],
      });

      const [
        orderCount,
        productionRows,
        stepRows,
        runItems,
        printRuns,
        qcRows,
        deliveries,
        invoices,
        demoStockRows,
        demoStockOrders,
        v2WorkOrders,
        v2Dependencies,
        v2WorkCenterCount,
        v2ReworkCases,
      ] = await Promise.all([
        tx.order.count(),
        tx.production.findMany({
          select: { id: true, createdAt: true, startDate: true, endDate: true },
        }),
        tx.productionStep.findMany({
          select: {
            id: true,
            stepType: true,
            status: true,
            qtyDone: true,
            qtyTotal: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
          },
        }),
        tx.printRunItem.findMany({
          include: {
            printRun: { select: { createdAt: true, completedAt: true } },
            productionStep: {
              include: { production: { select: { orderId: true } } },
            },
          },
        }),
        tx.printRun.findMany({
          select: {
            id: true,
            createdAt: true,
            printedAt: true,
            completedAt: true,
          },
        }),
        tx.qcRecord.findMany({ include: { defects: true } }),
        tx.delivery.findMany({
          include: {
            order: {
              select: {
                internalStatus: true,
                completedAt: true,
                productions: { select: { endDate: true } },
              },
            },
          },
        }),
        tx.invoice.findMany({
          include: {
            forPayment: true,
            payments: { include: { receiptInvoice: true } },
          },
        }),
        tx.product.findMany({
          where: {
            id: {
              in: Object.values(DEMO_STOCK_PRODUCTS).map(
                (product) => product.id,
              ),
            },
          },
          select: {
            id: true,
            sku: true,
            source: true,
            totalStock: true,
            variants: {
              where: { isActive: true },
              select: {
                sku: true,
                size: true,
                color: true,
                stock: true,
                totalStock: true,
              },
            },
          },
        }),
        tx.order.findMany({
          where: {
            id: {
              in: ["demo-order-stock-pick-ready", "demo-order-blocked-stock"],
            },
          },
          select: {
            id: true,
            stockReservedAt: true,
            stockReservationError: true,
            items: {
              select: {
                products: {
                  select: {
                    productId: true,
                    variants: {
                      select: { size: true, color: true, quantity: true },
                    },
                  },
                },
              },
            },
          },
        }),
        tx.production.findMany({
          where: { workOrderNumber: { not: null } },
          select: {
            id: true,
            orderId: true,
            workOrderNumber: true,
            workOrderState: true,
            completionOwnerStepId: true,
            order: { select: { productionCompletionOwnerId: true } },
            steps: {
              where: { executionEnabled: true },
              select: {
                id: true,
                stepType: true,
                workCenterId: true,
                operationState: true,
                qtyPlanned: true,
                qtyGood: true,
                qtyScrap: true,
                qtyRework: true,
                quantities: {
                  select: {
                    qtyPlanned: true,
                    qtyGood: true,
                    qtyScrap: true,
                    qtyRework: true,
                  },
                },
                events: { select: { id: true } },
              },
            },
          },
        }),
        tx.operationJobDependency.findMany({
          select: {
            predecessorStep: { select: { productionId: true } },
            successorStep: { select: { productionId: true } },
          },
        }),
        tx.workCenter.count({ where: { isActive: true } }),
        tx.reworkCase.findMany({
          select: {
            id: true,
            state: true,
            requiresReinspection: true,
            sourceQcDefectId: true,
            operations: { select: { operationState: true } },
          },
        }),
      ]);
      if (
        orderCount !== DEMO_SEED_SCENARIOS.length ||
        productionRows.length < 8
      ) {
        throw new Error("Demo seed จำนวนออเดอร์หรือใบผลิตไม่ครบ");
      }
      if (demoStockRows.length !== Object.keys(DEMO_STOCK_PRODUCTS).length) {
        throw new Error("Demo seed สินค้าสต๊อกทดสอบไม่ครบ");
      }
      if (
        v2WorkOrders.length !== productionRows.length ||
        v2WorkCenterCount !== V2_WORK_CENTERS.length
      ) {
        throw new Error("Demo Production V2 work order หรือ Work Center ไม่ครบ");
      }
      for (const workOrder of v2WorkOrders) {
        if (!workOrder.workOrderNumber || workOrder.steps.length === 0) {
          throw new Error(`Demo V2 work order ${workOrder.id} ไม่มีเลขที่หรืองานสถานี`);
        }
        if (
          !workOrder.completionOwnerStepId ||
          workOrder.order.productionCompletionOwnerId !== workOrder.id
        ) {
          throw new Error(`Demo V2 work order ${workOrder.id} ไม่มี completion owner`);
        }
        for (const step of workOrder.steps) {
          if (!step.workCenterId || step.stepType === "PACKAGING") {
            throw new Error(`Demo V2 operation ${step.id} ไม่มี Work Center หรือใช้ PACKAGING เดิม`);
          }
          if (step.events.length === 0 || step.quantities.length === 0) {
            throw new Error(`Demo V2 operation ${step.id} ไม่มี ledger หรือ quantity line`);
          }
          const sums = step.quantities.reduce(
            (total, line) => ({
              planned: total.planned + line.qtyPlanned,
              good: total.good + line.qtyGood,
              scrap: total.scrap + line.qtyScrap,
              rework: total.rework + line.qtyRework,
            }),
            { planned: 0, good: 0, scrap: 0, rework: 0 },
          );
          if (
            sums.planned !== step.qtyPlanned ||
            sums.good !== step.qtyGood ||
            sums.scrap !== step.qtyScrap ||
            sums.rework !== step.qtyRework
          ) {
            throw new Error(`Demo V2 operation ${step.id} รวม quantity line ไม่ตรง`);
          }
        }
      }
      if (
        v2Dependencies.some(
          (dependency) =>
            dependency.predecessorStep.productionId !==
            dependency.successorStep.productionId,
        )
      ) {
        throw new Error("Demo V2 dependency ข้าม Manufacturing Order");
      }
      if (
        !v2ReworkCases.some(
          (rework) =>
            rework.state === "AWAITING_REINSPECTION" &&
            rework.requiresReinspection &&
            rework.sourceQcDefectId &&
            rework.operations.some((operation) => operation.operationState === "COMPLETED"),
        )
      ) {
        throw new Error("Demo V2 defect/rework/reinspection scenario ไม่ครบ");
      }
      for (const product of demoStockRows) {
        if (product.source !== "LOCAL" || !product.sku.startsWith("DEMO-")) {
          throw new Error(`Demo product ${product.id} ไม่ได้แยกจาก Stock หลัก`);
        }
        const variantTotal = product.variants.reduce((sum, variant) => {
          if (variant.stock !== variant.totalStock || variant.stock < 0) {
            throw new Error(
              `Demo variant ${variant.sku} มียอด local ไม่ตรงกัน`,
            );
          }
          return sum + variant.stock;
        }, 0);
        if (variantTotal !== product.totalStock) {
          throw new Error(`Demo product ${product.id} รวมยอดรายไซส์ไม่ตรง`);
        }
      }
      const demoProductById = new Map(
        demoStockRows.map((product) => [product.id, product]),
      );
      for (const order of demoStockOrders) {
        const isReady = order.id === "demo-order-stock-pick-ready";
        if (
          isReady &&
          (!order.stockReservedAt || order.stockReservationError)
        ) {
          throw new Error(
            "Demo stock-pick-ready ต้องจองสำเร็จก่อนเปิด Station",
          );
        }
        if (
          !isReady &&
          (order.stockReservedAt || !order.stockReservationError)
        ) {
          throw new Error("Demo blocked-stock ต้องมีของขาดจริงและยังไม่จอง");
        }
        const hasShortage = order.items
          .flatMap((item) => item.products)
          .some((line) => {
            const product = line.productId
              ? demoProductById.get(line.productId)
              : null;
            return line.variants.some((ordered) => {
              const stock = product?.variants.find(
                (variant) =>
                  variant.size === ordered.size &&
                  variant.color === ordered.color,
              )?.stock;
              if (stock === undefined) return true;
              const required = isReady
                ? Math.ceil(ordered.quantity * 1.03)
                : ordered.quantity;
              return stock < required;
            });
          });
        if (isReady ? hasShortage : !hasShortage) {
          throw new Error(
            isReady
              ? "Demo stock-pick-ready มีของไม่พอสำหรับเบิกเผื่อ 3%"
              : "Demo blocked-stock ไม่มี shortage จริงตามข้อความ",
          );
        }
      }
      for (const production of productionRows) {
        if (
          production.startDate &&
          production.startDate < production.createdAt
        ) {
          throw new Error(
            `Demo production ${production.id} เริ่มก่อนสร้างใบผลิต`,
          );
        }
        if (
          production.startDate &&
          production.endDate &&
          production.endDate < production.startDate
        ) {
          throw new Error(`Demo production ${production.id} จบก่อนเริ่ม`);
        }
      }
      for (const step of stepRows) {
        if (
          step.qtyDone < 0 ||
          (step.qtyTotal !== null && step.qtyDone > step.qtyTotal)
        ) {
          throw new Error(`Demo step ${step.id} มีจำนวนเกินขอบเขต`);
        }
        if (step.startedAt && step.startedAt < step.createdAt) {
          throw new Error(`Demo step ${step.id} เริ่มก่อนสร้างขั้น`);
        }
        if (
          step.startedAt &&
          step.completedAt &&
          step.completedAt < step.startedAt
        ) {
          throw new Error(`Demo step ${step.id} จบก่อนเริ่ม`);
        }
        if (step.stepType === "DTF_PRINT" && step.status === "COMPLETED") {
          const printedQty = runItems
            .filter((item) => item.productionStepId === step.id)
            .reduce((sum, item) => sum + item.qty, 0);
          if (printedQty < step.qtyDone) {
            throw new Error(
              `Demo DTF step ${step.id} ไม่มีหลักฐาน Print Run ครบ`,
            );
          }
        }
      }
      for (const item of runItems) {
        if (item.orderId !== item.productionStep.production.orderId) {
          throw new Error(
            `Demo print run item ${item.id} อ้างคนละออเดอร์กับ step`,
          );
        }
        if (
          !item.productionStep.startedAt ||
          item.productionStep.startedAt.getTime() !==
            item.printRun.createdAt.getTime()
        ) {
          throw new Error(
            `Demo print run item ${item.id} เริ่ม step ไม่ตรงเวลาเปิดรอบ`,
          );
        }
        if (
          item.printRun.completedAt &&
          (!item.productionStep.completedAt ||
            item.productionStep.completedAt < item.printRun.completedAt)
        ) {
          throw new Error(
            `Demo print run item ${item.id} ปิด step ก่อนรอบพิมพ์เสร็จ`,
          );
        }
      }
      for (const run of printRuns) {
        if (run.printedAt && run.printedAt < run.createdAt) {
          throw new Error(`Demo Print Run ${run.id} พิมพ์ก่อนสร้างรอบ`);
        }
        if (
          run.printedAt &&
          run.completedAt &&
          run.completedAt < run.printedAt
        ) {
          throw new Error(`Demo Print Run ${run.id} จบก่อนพิมพ์`);
        }
      }
      for (const qc of qcRows) {
        const defectSum = qc.defects.reduce(
          (sum, defect) => sum + defect.qty,
          0,
        );
        if (defectSum !== qc.qtyDefect)
          throw new Error(`Demo QC ${qc.id} รวมของเสียไม่ตรง`);
      }
      for (const delivery of deliveries) {
        const latestQcAt = qcRows
          .filter((qc) => qc.orderId === delivery.orderId)
          .reduce<Date | null>(
            (latest, qc) =>
              !latest || qc.checkedAt > latest ? qc.checkedAt : latest,
            null,
          );
        if (
          !latestQcAt ||
          delivery.createdAt < latestQcAt ||
          (delivery.shippedAt && delivery.shippedAt < latestQcAt) ||
          (delivery.deliveredAt && delivery.deliveredAt < latestQcAt) ||
          (delivery.order.completedAt &&
            delivery.order.completedAt < latestQcAt)
        ) {
          throw new Error(`Demo delivery ${delivery.id} เกิดก่อนผ่าน QC`);
        }
        if (delivery.shippedAt && delivery.shippedAt < delivery.createdAt) {
          throw new Error(`Demo delivery ${delivery.id} ส่งก่อนสร้างใบส่ง`);
        }
        if (
          delivery.shippedAt &&
          delivery.deliveredAt &&
          delivery.deliveredAt < delivery.shippedAt
        ) {
          throw new Error(`Demo delivery ${delivery.id} ถึงก่อนส่ง`);
        }
        if (delivery.order.internalStatus === "COMPLETED") {
          const latestProductionEnd =
            delivery.order.productions.reduce<Date | null>(
            (latest, production) =>
              production.endDate && (!latest || production.endDate > latest)
                ? production.endDate
                : latest,
            null,
          );
          if (
            !delivery.order.completedAt ||
            (delivery.deliveredAt &&
              delivery.order.completedAt < delivery.deliveredAt) ||
            (latestProductionEnd &&
              delivery.order.completedAt < latestProductionEnd)
          ) {
            throw new Error(
              `Demo order ของ delivery ${delivery.id} ปิดก่อนงานจริงเสร็จ`,
            );
          }
        }
      }
      for (const invoice of invoices) {
        if (invoice.type === "RECEIPT" && invoice.dueDate !== null) {
          throw new Error(`Demo receipt ${invoice.id} ต้องไม่มีวันครบกำหนด`);
        }
        if (invoice.forPaymentId) {
          if (
            invoice.type !== "RECEIPT" ||
            !invoice.forPayment ||
            !invoice.issueDate ||
            invoice.issueDate.getTime() !==
              invoice.forPayment.createdAt.getTime()
          ) {
            throw new Error(
              `Demo receipt ${invoice.id} ผูกงวดรับเงินไม่ตรง tax point`,
            );
          }
        }
        if (
          ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"].includes(
            invoice.type,
          )
        ) {
          for (const payment of invoice.payments) {
            if (
              payment.amount.plus(payment.whtAmount).gt(0) &&
              !payment.receiptInvoice
            ) {
              throw new Error(`Demo payment ${payment.id} ไม่มีใบเสร็จผูกงวด`);
            }
          }
        }
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  const summary = await Promise.all([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.production.count(),
    prisma.productionStep.count(),
    prisma.printRun.count(),
    prisma.outsourceOrder.count(),
    prisma.qcRecord.count(),
    prisma.delivery.count(),
    prisma.invoice.count(),
  ]);
  console.log("Demo seed สำเร็จบน 127.0.0.1:5433/anajak_erp_demo");
  console.log(
    `customers=${summary[0]} orders=${summary[1]} productions=${summary[2]} steps=${summary[3]} print_runs=${summary[4]} outsource=${summary[5]} qc=${summary[6]} deliveries=${summary[7]} invoices=${summary[8]}`,
  );
  console.log("Stock credentials=0 · ไม่มีการเรียก Anajak Stock");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
