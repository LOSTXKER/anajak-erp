import { describe, expect, it } from "vitest";
import {
  buildProductionControlView,
  summarizeGarmentControl,
  type GarmentControlEvidence,
  type ProductionControlStep,
} from "@/lib/production-control";

function step(
  id: string,
  stepType: string,
  status: string,
  sortOrder: number,
  patch: Partial<ProductionControlStep> = {},
): ProductionControlStep {
  return {
    id,
    stepType,
    status,
    sortOrder,
    qtyDone: 0,
    qtyTotal: 1,
    ...patch,
  };
}

function knownGarments(
  lines: Parameters<typeof summarizeGarmentControl>[0],
): GarmentControlEvidence {
  return { kind: "known", summary: summarizeGarmentControl(lines) };
}

describe("production control projection", () => {
  it("ทำให้เสื้อขาดเป็น attention และให้รีดร้อนรอเงื่อนไขโดยไม่สร้าง action ปลอม", () => {
    const garment = knownGarments([
      {
        sku: "CVC-BLACK-FREE",
        productName: "Anajak Oversize CVC",
        size: "FREE",
        color: "ดำ",
        needed: 1,
        issued: 0,
        returned: 0,
      },
    ]);
    const result = buildProductionControlView(
      [
        step("pick", "GARMENT_PICK", "IN_PROGRESS", 1),
        step("print", "DTF_PRINT", "COMPLETED", 2, { qtyDone: 1 }),
        step("press", "HEAT_PRESS", "PENDING", 3),
      ],
      garment,
    );

    expect(result.overallLabel).toBe("ต้องจัดการ");
    expect(result.attention?.step?.id).toBe("pick");
    expect(result.attention?.blocker).toBe("ยังไม่ได้เบิกเสื้อ 1 ตัว");
    expect(result.rows.find((row) => row.step.id === "press")).toMatchObject({
      statusLabel: "รอเงื่อนไข",
      station: "heat-press",
    });
  });

  it("ยก FAILED ขึ้นก่อน shortage และใช้หมายเหตุจริงเป็นเหตุผล", () => {
    const garment = knownGarments([
      {
        sku: "ONE",
        productName: "เสื้อ",
        size: "M",
        color: null,
        needed: 1,
        issued: 0,
        returned: 0,
      },
    ]);
    const result = buildProductionControlView(
      [
        step("pick", "GARMENT_PICK", "PENDING", 1),
        step("press", "HEAT_PRESS", "FAILED", 2, { notes: "อุณหภูมิไม่คงที่" }),
      ],
      garment,
    );

    expect(result.attention).toMatchObject({
      kind: "step",
      tone: "danger",
      blocker: "อุณหภูมิไม่คงที่",
    });
  });

  it("FAILED หลายรอบแสดงเหตุที่ยังเปิดล่าสุด ไม่ยก history เก่ามาบัง", () => {
    const result = buildProductionControlView(
      [
        step("press", "HEAT_PRESS", "FAILED", 1, {
          notes: [
            "[แจ้งปัญหาจากสถานี] แรงดันตก",
            "[แก้ปัญหาแล้ว] เปลี่ยนวาล์ว",
            "[แจ้งปัญหาจากสถานี] อุณหภูมิแกว่ง",
          ].join("\n"),
        }),
      ],
      { kind: "not-applicable" },
    );

    expect(result.attention).toMatchObject({
      blocker: "อุณหภูมิแกว่ง",
      detail: "อุณหภูมิแกว่ง",
    });
    expect(result.attention?.blocker).not.toContain("แรงดันตก");
  });

  it("ไม่ส่ง CUSTOM rework ที่ไม่มี target เข้า Station แบบเดาเอง", () => {
    const result = buildProductionControlView(
      [step("rework", "CUSTOM", "PENDING", 1, { customStepName: "งานแก้ (QC ไม่ผ่าน)" })],
      { kind: "not-applicable" },
    );

    expect(result.rows[0]).toMatchObject({
      station: null,
      stationExecutable: false,
      statusLabel: "ต้องจัดเส้นทาง",
      blocker: "งานแก้นี้ยังไม่ได้ระบุจุดทำงาน",
    });
  });

  it("คงความพร้อมเสื้อของใบเก่าที่ไม่มี GARMENT_PICK เป็น unknown ไม่เดาเป็นพร้อมหรือขาด", () => {
    const reason = "ใบเก่านี้ไม่มีขั้นเตรียมเสื้อ จึงต้องตรวจเสื้อจริงก่อนเริ่มงาน";
    const result = buildProductionControlView(
      [
        step("print", "DTF_PRINT", "COMPLETED", 1, { qtyDone: 1 }),
        step("press", "HEAT_PRESS", "PENDING", 2),
      ],
      { kind: "unknown", reason },
    );

    expect(result.garmentReadiness).toMatchObject({
      status: "unknown",
      statusLabel: "ยังไม่ทราบ",
      detail: reason,
    });
    expect(result.attention).toMatchObject({
      kind: "garment-readiness",
      step: null,
      blocker: "ยังยืนยันความพร้อมเสื้อไม่ได้",
      detail: reason,
    });
    expect(result.rows.find((row) => row.step.id === "press")).toMatchObject({
      statusLabel: "รอตรวจเสื้อ",
      blocker: reason,
      requiresAttention: true,
    });
    expect(result.overallLabel).toBe("ต้องจัดการ");
    expect(result.attention?.blocker).not.toContain("ยังไม่ได้เบิก");
  });

  it("ไม่ยกการรอขั้นก่อนหน้าหรือเงื่อนไขตามปกติเป็น exception ของหัวหน้า", () => {
    const result = buildProductionControlView(
      [
        step("pick", "GARMENT_PICK", "COMPLETED", 1, { qtyDone: 1 }),
        step("print", "DTF_PRINT", "PENDING", 2),
        step("press", "HEAT_PRESS", "PENDING", 3),
      ],
      knownGarments([
        {
          sku: "READY",
          productName: "เสื้อพร้อม",
          size: "M",
          color: "ดำ",
          needed: 1,
          issued: 1,
          returned: 0,
        },
      ]),
    );

    expect(result.attention).toBeNull();
    expect(result.overallLabel).toBe("รอดำเนินการ");
    expect(result.rows.find((row) => row.step.id === "press")).toMatchObject({
      tone: "neutral",
      statusLabel: "รอเงื่อนไข",
      requiresAttention: false,
    });
  });

  it("ยกร้านนอกที่เลยกำหนดรับกลับเป็น attention ก่อนสถานะ IN_PROGRESS ทั่วไป", () => {
    const result = buildProductionControlView(
      [
        step("embroidery", "EMBROIDERY", "IN_PROGRESS", 1, {
          qtyDone: 0,
          qtyTotal: 30,
          assignedTo: { id: "owner-1", name: "พี่ก้อย" },
          outsourceOrders: [
            {
              status: "IN_PROGRESS",
              expectedBackAt: new Date("2026-08-20T12:00:00+07:00"),
            },
          ],
        }),
      ],
      { kind: "not-applicable" },
      new Date("2026-08-21T12:00:00+07:00"),
    );

    expect(result.rows[0]).toMatchObject({
      tone: "warning",
      statusLabel: "เลยกำหนดรับกลับ",
      blocker: "ร้านนอกเลยกำหนดรับกลับ 1 วัน",
      ownerLabel: "พี่ก้อย",
      requiresAttention: true,
    });
    expect(result.attention).toMatchObject({
      kind: "step",
      blocker: "ร้านนอกเลยกำหนดรับกลับ 1 วัน",
    });
    expect(result.overallLabel).toBe("ต้องจัดการ");
  });

  it("ไม่แจ้งเลยกำหนดรับกลับซ้ำเมื่อใบร้านนอกถูกรับกลับแล้ว", () => {
    const result = buildProductionControlView(
      [
        step("embroidery", "EMBROIDERY", "IN_PROGRESS", 1, {
          outsourceOrders: [
            {
              status: "RECEIVED_BACK",
              expectedBackAt: new Date("2026-08-18T12:00:00+07:00"),
            },
          ],
        }),
      ],
      { kind: "not-applicable" },
      new Date("2026-08-21T12:00:00+07:00"),
    );

    expect(result.rows[0]).toMatchObject({
      statusLabel: "รอตรวจรับ",
      blocker: "รับกลับแล้ว รอตรวจ QC",
      requiresAttention: false,
    });
    expect(result.attention).toBeNull();
  });

  it("ตรวจทุกใบร้านนอกและยกใบที่เลยกำหนดนานที่สุดแม้ใบล่าสุดไม่มีกำหนด", () => {
    const result = buildProductionControlView(
      [
        step("embroidery", "EMBROIDERY", "IN_PROGRESS", 1, {
          outsourceOrders: [
            { status: "IN_PROGRESS", expectedBackAt: null },
            {
              status: "SENT",
              expectedBackAt: new Date("2026-08-18T12:00:00+07:00"),
            },
            {
              status: "COMPLETED",
              expectedBackAt: new Date("2026-08-20T12:00:00+07:00"),
            },
          ],
        }),
      ],
      { kind: "not-applicable" },
      new Date("2026-08-21T12:00:00+07:00"),
    );

    expect(result.rows[0]).toMatchObject({
      statusLabel: "เลยกำหนดรับกลับ",
      blocker: "ร้านนอกเลยกำหนดรับกลับ 3 วัน",
      requiresAttention: true,
    });
  });

  it("สรุปฟิล์มพร้อมเมื่อทุก DTF step เสร็จเท่านั้น", () => {
    const partial = buildProductionControlView(
      [
        step("print-a", "DTF_PRINT", "COMPLETED", 1, { qtyDone: 1 }),
        step("print-b", "DTF_PRINT", "PENDING", 2),
      ],
      { kind: "not-applicable" },
    );
    const complete = buildProductionControlView(
      [
        step("print-a", "DTF_PRINT", "COMPLETED", 1, { qtyDone: 1 }),
        step("print-b", "DTF_PRINT", "COMPLETED", 2, { qtyDone: 1 }),
      ],
      { kind: "not-applicable" },
    );

    expect(partial.dtfReadiness).toMatchObject({
      status: "waiting",
      statusLabel: "ยังไม่พร้อม",
    });
    expect(complete.dtfReadiness).toMatchObject({
      status: "ready",
      statusLabel: "เสร็จ",
    });
  });

  it("ให้ FAILED จริงมาก่อน data gap ของเสื้อ", () => {
    const result = buildProductionControlView(
      [step("failed", "HEAT_PRESS", "FAILED", 1, { notes: "เครื่องหยุด" })],
      { kind: "unknown", reason: "ยังไม่มีหลักฐานเสื้อ" },
    );

    expect(result.attention).toMatchObject({
      kind: "step",
      tone: "danger",
      blocker: "เครื่องหยุด",
    });
  });
});
