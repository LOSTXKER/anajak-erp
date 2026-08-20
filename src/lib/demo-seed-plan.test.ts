import { describe, expect, it } from "vitest";
import {
  assertDemoSeedPlan,
  buildDemoResetTableNames,
  DEMO_RESET_TOKEN,
  DEMO_DATABASE_TARGET,
  DEMO_SEED_PRESERVED_TABLES,
  DEMO_SEED_SCENARIOS,
  validateDemoDatabaseUrl,
  validateDemoSeedInvocation,
} from "./demo-seed-plan";

describe("demo seed safety contract", () => {
  it("requires both the one-shot reset flag and the exact confirmation token", () => {
    expect(() => validateDemoSeedInvocation([], DEMO_RESET_TOKEN)).toThrow(/--reset/);
    expect(() => validateDemoSeedInvocation(["--reset", "--extra"], DEMO_RESET_TOKEN)).toThrow(/--reset/);
    expect(() => validateDemoSeedInvocation(["--reset"], undefined)).toThrow(/DEMO_SEED_RESET_TOKEN/);
    expect(() => validateDemoSeedInvocation(["--reset"], "almost-correct")).toThrow(/DEMO_SEED_RESET_TOKEN/);
    expect(() => validateDemoSeedInvocation(["--reset"], DEMO_RESET_TOKEN)).not.toThrow();
  });

  it("refuses every database except the dedicated local demo target", () => {
    expect(DEMO_DATABASE_TARGET).toEqual({
      hostname: "127.0.0.1",
      port: "5433",
      database: "anajak_erp_demo",
    });
    expect(() =>
      validateDemoDatabaseUrl("postgresql://demo:demo@127.0.0.1:5433/anajak_erp_demo?schema=public"),
    ).not.toThrow();
    expect(() => validateDemoDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
    expect(() => validateDemoDatabaseUrl("not-a-url")).toThrow(/DATABASE_URL/);
    expect(() =>
      validateDemoDatabaseUrl("postgresql://demo:demo@localhost:5433/anajak_erp_demo"),
    ).toThrow(/127\.0\.0\.1:5433/);
    expect(() =>
      validateDemoDatabaseUrl("postgresql://demo:demo@127.0.0.1:5432/anajak_erp_demo"),
    ).toThrow(/127\.0\.0\.1:5433/);
    expect(() =>
      validateDemoDatabaseUrl("postgresql://demo:demo@db.example.com:5433/anajak_erp_demo"),
    ).toThrow(/127\.0\.0\.1:5433/);
  });

  it("preserves identity, configuration, stock mirror, and editable master tables", () => {
    expect(DEMO_SEED_PRESERVED_TABLES).toEqual(
      expect.arrayContaining([
        "_prisma_migrations",
        "users",
        "settings",
        "agent_api_keys",
        "products",
        "product_variants",
        "patterns",
        "packaging_options",
        "service_catalog",
      ]),
    );
    expect(
      buildDemoResetTableNames([
        ...DEMO_SEED_PRESERVED_TABLES,
        "orders",
        "customers",
        "audit_logs",
        "orders",
      ]),
    ).toEqual(["audit_logs", "customers", "orders"]);
  });
});

describe("demo seed scenario coverage", () => {
  it("keeps a coherent 10–14 order plan", () => {
    expect(() => assertDemoSeedPlan(DEMO_SEED_SCENARIOS)).not.toThrow();
    expect(DEMO_SEED_SCENARIOS).toHaveLength(14);
    expect(DEMO_SEED_SCENARIOS.map((scenario) => scenario.sequence)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
  });

  it("covers office status, station execution, exception, fulfillment, and finance", () => {
    const statuses = new Set(DEMO_SEED_SCENARIOS.map((scenario) => scenario.internalStatus));
    expect(statuses).toEqual(
      new Set([
        "INQUIRY",
        "DESIGNING",
        "PRODUCTION_QUEUE",
        "PRODUCING",
        "QUALITY_CHECK",
        "PACKING",
        "READY_TO_SHIP",
        "SHIPPED",
        "COMPLETED",
      ]),
    );

    const features = new Set(DEMO_SEED_SCENARIOS.flatMap((scenario) => scenario.features));
    for (const feature of [
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
    ] as const) {
      expect(features.has(feature)).toBe(true);
    }
  });

  it("pins customer-facing status at fulfillment boundaries", () => {
    expect(DEMO_SEED_SCENARIOS.find((scenario) => scenario.key === "ready-to-ship")).toMatchObject({
      internalStatus: "READY_TO_SHIP",
      customerStatus: "READY_TO_SHIP",
    });
    expect(DEMO_SEED_SCENARIOS.find((scenario) => scenario.key === "shipped")).toMatchObject({
      internalStatus: "SHIPPED",
      customerStatus: "SHIPPED",
    });
    expect(DEMO_SEED_SCENARIOS.find((scenario) => scenario.key === "completed")).toMatchObject({
      internalStatus: "COMPLETED",
      customerStatus: "COMPLETED",
    });
  });
});
