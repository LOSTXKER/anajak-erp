export const DEMO_RESET_TOKEN = "RESET-ANAJAK-ERP-DEMO-DATA";

export const DEMO_DATABASE_TARGET = {
  hostname: "127.0.0.1",
  port: "5433",
  database: "anajak_erp_demo",
} as const;

export const DEMO_SEED_PRESERVED_TABLES = [
  "_prisma_migrations",
  "users",
  "settings",
  "agent_api_keys",
  "patterns",
  "packaging_options",
  "service_catalog",
] as const;

export type DemoSeedFeature =
  | "QUOTATION"
  | "DESIGN"
  | "STATION_READY"
  | "STOCK_PICK_READY"
  | "GARMENT_RECEIVE"
  | "DTF_PRINTING"
  | "DTF_PRINTED"
  | "HEAT_PRESS"
  | "BLOCKED_STOCK"
  | "OUTSOURCE_OVERDUE"
  | "QC"
  | "PACKING"
  | "DELIVERY_READY"
  | "DELIVERY_SHIPPED"
  | "DELIVERY_COMPLETED"
  | "FINANCE";

export type DemoSeedScenario = {
  key: string;
  sequence: number;
  title: string;
  internalStatus:
    | "INQUIRY"
    | "DESIGNING"
    | "PRODUCTION_QUEUE"
    | "PRODUCING"
    | "QUALITY_CHECK"
    | "PACKING"
    | "READY_TO_SHIP"
    | "SHIPPED"
    | "COMPLETED";
  customerStatus:
    | "ORDER_RECEIVED"
    | "PREPARING"
    | "IN_PRODUCTION"
    | "READY_TO_SHIP"
    | "SHIPPED"
    | "COMPLETED";
  quantity: number;
  ageDays: number;
  deadlineInDays: number;
  customerIndex: number;
  features: readonly DemoSeedFeature[];
};

export const DEMO_SEED_SCENARIOS = [
  {
    key: "inquiry",
    sequence: 1,
    title: "เสื้อทีมเปิดตัวร้านกาแฟ",
    internalStatus: "INQUIRY",
    customerStatus: "ORDER_RECEIVED",
    quantity: 60,
    ageDays: 1,
    deadlineInDays: 18,
    customerIndex: 0,
    features: ["QUOTATION"],
  },
  {
    key: "designing",
    sequence: 2,
    title: "เสื้อ Staff งานวิ่งชุมชน",
    internalStatus: "DESIGNING",
    customerStatus: "PREPARING",
    quantity: 120,
    ageDays: 4,
    deadlineInDays: 14,
    customerIndex: 1,
    features: ["QUOTATION", "DESIGN", "FINANCE"],
  },
  {
    key: "production-ready",
    sequence: 3,
    title: "เสื้อรุ่นกิจกรรมคณะ",
    internalStatus: "PRODUCTION_QUEUE",
    customerStatus: "IN_PRODUCTION",
    quantity: 80,
    ageDays: 6,
    deadlineInDays: 9,
    customerIndex: 2,
    features: ["DESIGN", "STATION_READY", "FINANCE"],
  },
  {
    key: "garment-receive",
    sequence: 4,
    title: "เสื้อพนักงานหน้าร้าน รอบสอง",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 72,
    ageDays: 8,
    deadlineInDays: 6,
    customerIndex: 3,
    features: ["GARMENT_RECEIVE", "FINANCE"],
  },
  {
    key: "dtf-printing",
    sequence: 5,
    title: "เสื้อแคมเปญรักษ์ทะเล",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 96,
    ageDays: 10,
    deadlineInDays: 5,
    customerIndex: 4,
    features: ["GARMENT_RECEIVE", "DTF_PRINTING", "FINANCE"],
  },
  {
    key: "dtf-printed",
    sequence: 6,
    title: "เสื้อทีมแข่งจักรยาน",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 45,
    ageDays: 11,
    deadlineInDays: 4,
    customerIndex: 5,
    features: ["GARMENT_RECEIVE", "DTF_PRINTED", "FINANCE"],
  },
  {
    key: "heat-press",
    sequence: 7,
    title: "เสื้อครบรอบสตูดิโอโยคะ",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 54,
    ageDays: 12,
    deadlineInDays: 3,
    customerIndex: 0,
    features: ["GARMENT_RECEIVE", "HEAT_PRESS", "FINANCE"],
  },
  {
    key: "blocked-stock",
    sequence: 8,
    title: "เสื้อโปโลทีมขาย — รอแก้สต๊อก",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 40,
    ageDays: 9,
    deadlineInDays: 2,
    customerIndex: 1,
    features: ["BLOCKED_STOCK", "FINANCE"],
  },
  {
    key: "outsource-overdue",
    sequence: 9,
    title: "เสื้อแจ็กเก็ตปักโลโก้พาร์ตเนอร์",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 30,
    ageDays: 16,
    deadlineInDays: 1,
    customerIndex: 2,
    features: ["GARMENT_RECEIVE", "OUTSOURCE_OVERDUE", "FINANCE"],
  },
  {
    key: "quality-check",
    sequence: 10,
    title: "เสื้ออาสาสมัครงานหนังสือ",
    internalStatus: "QUALITY_CHECK",
    customerStatus: "IN_PRODUCTION",
    quantity: 50,
    ageDays: 14,
    deadlineInDays: 2,
    customerIndex: 3,
    features: ["GARMENT_RECEIVE", "QC", "FINANCE"],
  },
  {
    key: "packing",
    sequence: 11,
    title: "เสื้อสมาชิกฟิตเนสประจำปี",
    internalStatus: "PACKING",
    customerStatus: "IN_PRODUCTION",
    quantity: 84,
    ageDays: 17,
    deadlineInDays: 1,
    customerIndex: 4,
    features: ["GARMENT_RECEIVE", "QC", "PACKING", "FINANCE"],
  },
  {
    key: "ready-to-ship",
    sequence: 12,
    title: "เสื้อของที่ระลึกสัมมนา",
    internalStatus: "READY_TO_SHIP",
    customerStatus: "READY_TO_SHIP",
    quantity: 100,
    ageDays: 20,
    deadlineInDays: 0,
    customerIndex: 5,
    features: ["GARMENT_RECEIVE", "QC", "DELIVERY_READY", "FINANCE"],
  },
  {
    key: "shipped",
    sequence: 13,
    title: "เสื้อทีมบริการภาคสนาม",
    internalStatus: "SHIPPED",
    customerStatus: "SHIPPED",
    quantity: 64,
    ageDays: 23,
    deadlineInDays: -2,
    customerIndex: 0,
    features: ["GARMENT_RECEIVE", "QC", "DELIVERY_SHIPPED", "FINANCE"],
  },
  {
    key: "completed",
    sequence: 14,
    title: "เสื้อยูนิฟอร์มทีมบริการลูกค้า",
    internalStatus: "COMPLETED",
    customerStatus: "COMPLETED",
    quantity: 150,
    ageDays: 30,
    deadlineInDays: -7,
    customerIndex: 1,
    features: ["GARMENT_RECEIVE", "QC", "DELIVERY_COMPLETED", "FINANCE"],
  },
  {
    key: "stock-pick-ready",
    sequence: 15,
    title: "เสื้อโปโลทีมหน้าร้าน — พร้อมเบิกสต๊อกทดสอบ",
    internalStatus: "PRODUCING",
    customerStatus: "IN_PRODUCTION",
    quantity: 24,
    ageDays: 5,
    deadlineInDays: 5,
    customerIndex: 2,
    features: ["STOCK_PICK_READY", "FINANCE"],
  },
] as const satisfies readonly DemoSeedScenario[];

export function validateDemoSeedInvocation(
  args: readonly string[],
  token: string | undefined,
) {
  if (args.length !== 1 || args[0] !== "--reset") {
    throw new Error(
      "Demo seed ถูกปิดไว้: ต้องระบุ --reset เพียง argument เดียว",
    );
  }
  if (token !== DEMO_RESET_TOKEN) {
    throw new Error(
      "Demo seed ถูกปิดไว้: DEMO_SEED_RESET_TOKEN ไม่ตรงกับคำยืนยัน",
    );
  }
}

export function validateDemoDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error("Demo seed ถูกปิดไว้: ไม่พบ DATABASE_URL");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Demo seed ถูกปิดไว้: DATABASE_URL ไม่ใช่ PostgreSQL URL ที่ถูกต้อง",
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const isPostgres =
    parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
  if (
    !isPostgres ||
    parsed.hostname !== DEMO_DATABASE_TARGET.hostname ||
    parsed.port !== DEMO_DATABASE_TARGET.port ||
    database !== DEMO_DATABASE_TARGET.database
  ) {
    throw new Error(
      "Demo seed อนุญาตเฉพาะ PostgreSQL 127.0.0.1:5433/anajak_erp_demo เท่านั้น",
    );
  }
}

export function buildDemoResetTableNames(
  allPrismaTables: readonly string[],
): string[] {
  const preserved = new Set<string>(DEMO_SEED_PRESERVED_TABLES);
  return [...new Set(allPrismaTables)]
    .filter((table) => !preserved.has(table))
    .sort((a, b) => a.localeCompare(b));
}

export function assertDemoSeedPlan(scenarios: readonly DemoSeedScenario[]) {
  if (scenarios.length < 10 || scenarios.length > 15) {
    throw new Error("Demo seed ต้องมี 10–15 ออเดอร์");
  }

  const uniqueKeys = new Set(scenarios.map((scenario) => scenario.key));
  const uniqueSequences = new Set(
    scenarios.map((scenario) => scenario.sequence),
  );
  if (
    uniqueKeys.size !== scenarios.length ||
    uniqueSequences.size !== scenarios.length
  ) {
    throw new Error("Demo seed key และเลขลำดับต้องไม่ซ้ำ");
  }

  const requiredStatuses = [
    "INQUIRY",
    "DESIGNING",
    "PRODUCTION_QUEUE",
    "PRODUCING",
    "QUALITY_CHECK",
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
    "COMPLETED",
  ];
  const statuses = new Set(
    scenarios.map((scenario) => scenario.internalStatus),
  );
  for (const status of requiredStatuses) {
    if (!statuses.has(status as DemoSeedScenario["internalStatus"])) {
      throw new Error(`Demo seed ขาดสถานะ ${status}`);
    }
  }

  const requiredFeatures: DemoSeedFeature[] = [
    "STATION_READY",
    "GARMENT_RECEIVE",
    "DTF_PRINTING",
    "DTF_PRINTED",
    "HEAT_PRESS",
    "BLOCKED_STOCK",
    "OUTSOURCE_OVERDUE",
    "QC",
    "PACKING",
    "DELIVERY_READY",
    "DELIVERY_SHIPPED",
    "DELIVERY_COMPLETED",
    "FINANCE",
  ];
  const features = new Set(scenarios.flatMap((scenario) => scenario.features));
  for (const feature of requiredFeatures) {
    if (!features.has(feature))
      throw new Error(`Demo seed ขาด scenario ${feature}`);
  }

  const customerStatusByInternal: Record<
    DemoSeedScenario["internalStatus"],
    DemoSeedScenario["customerStatus"]
  > = {
    INQUIRY: "ORDER_RECEIVED",
    DESIGNING: "PREPARING",
    PRODUCTION_QUEUE: "IN_PRODUCTION",
    PRODUCING: "IN_PRODUCTION",
    QUALITY_CHECK: "IN_PRODUCTION",
    PACKING: "IN_PRODUCTION",
    READY_TO_SHIP: "READY_TO_SHIP",
    SHIPPED: "SHIPPED",
    COMPLETED: "COMPLETED",
  };

  for (const scenario of scenarios) {
    if (scenario.quantity <= 0 || !Number.isInteger(scenario.quantity)) {
      throw new Error(`Demo seed ${scenario.key} มีจำนวนไม่ถูกต้อง`);
    }
    const expectedCustomerStatus =
      customerStatusByInternal[scenario.internalStatus];
    if (scenario.customerStatus !== expectedCustomerStatus) {
      throw new Error(
        `Demo seed ${scenario.key} ต้องมี customerStatus ${expectedCustomerStatus}`,
      );
    }
  }
}
