import { describe, expect, it } from "vitest";
import { parseFactoryScan } from "@/lib/factory-scan";

describe("parseFactoryScan", () => {
  it("รับเลขออเดอร์จากเครื่องสแกนและตัด CRLF", () => {
    expect(parseFactoryScan(" \r\nord-2608-0041\r\n ")).toEqual({
      ok: true,
      target: {
        kind: "order-number",
        orderNumber: "ORD-2608-0041",
        station: null,
      },
    });
  });

  it.each([
    ["/production/prod-1", { kind: "production", productionId: "prod-1", station: null }],
    ["/orders/order-1", { kind: "order", orderId: "order-1", station: null }],
    [
      "/factory/station?station=qc&productionId=prod-2",
      { kind: "production", productionId: "prod-2", station: "qc" },
    ],
    [
      "/factory/station?station=final-pack&orderId=order-2",
      { kind: "order", orderId: "order-2", station: "final-pack" },
    ],
    [
      "/factory/station?station=prep&orderNumber=ORD-2608-0042",
      { kind: "order-number", orderNumber: "ORD-2608-0042", station: "prep" },
    ],
  ])("รับเส้นทาง ERP ที่อนุญาต: %s", (value, target) => {
    expect(parseFactoryScan(value)).toEqual({ ok: true, target });
  });

  it("รับ QR แบบ URL เต็มเมื่อ origin ตรงกับ ERP", () => {
    expect(
      parseFactoryScan("https://erp.anajak.test/production/prod-3", {
        allowedOrigins: ["https://erp.anajak.test"],
      }),
    ).toEqual({
      ok: true,
      target: { kind: "production", productionId: "prod-3", station: null },
    });
  });

  it.each([
    ["https://evil.example/production/prod-1", "external-url"],
    ["\\\\evil.example/production/prod-1", "external-url"],
    ["/\\\\evil.example/production/prod-1", "external-url"],
    ["https://factory-scan.invalid/production/prod-1", "external-url"],
    ["/customers/customer-1", "unsupported"],
    ["/factory/station?station=unknown&orderId=order-1", "unsupported"],
    ["/factory/station?productionId=prod-1&orderId=order-1", "ambiguous"],
    ["/factory/station?orderId=order-1&orderId=order-2", "ambiguous"],
    ["/factory/station?station=qc", "missing-context"],
    ["/production/%E0%A4%A", "unsupported"],
    ["AN-2608-0041", "unsupported"],
    ["\r\n", "empty"],
  ])("ปฏิเสธ input ที่ห้ามเดา: %s", (value, reason) => {
    expect(
      parseFactoryScan(value, { allowedOrigins: ["https://erp.anajak.test"] }),
    ).toEqual({ ok: false, reason });
  });
});
