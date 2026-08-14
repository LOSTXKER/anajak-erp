import { describe, expect, it } from "vitest";
import {
  buildRedesignProductionModel,
  redesignProductionActionHref,
  selectRedesignProductionTarget,
  type RedesignProductionOrderInput,
  type RedesignProductionRunInput,
  type RedesignProductionStepInput,
} from "@/lib/redesign-production";

const NOW = "2026-08-14T12:00:00.000Z";

function step(
  overrides: Partial<RedesignProductionStepInput> = {},
): RedesignProductionStepInput {
  return {
    id: "step-1",
    stepType: "DTF_PRINT",
    status: "PENDING",
    sortOrder: 1,
    assignedTo: null,
    ...overrides,
  };
}

function production(
  id: string,
  steps: readonly RedesignProductionStepInput[] = [],
  status = "IN_PROGRESS",
): RedesignProductionRunInput {
  return { id, status, steps };
}

function order(
  overrides: Partial<RedesignProductionOrderInput> = {},
): RedesignProductionOrderInput {
  return {
    id: "order-1",
    orderNumber: "ORD-0001",
    title: "เสื้อทีม",
    customerName: "ลูกค้าทดสอบ",
    deadline: "2026-08-20T00:00:00.000Z",
    priority: "NORMAL",
    internalStatus: "PRODUCING",
    blindShip: false,
    totalQuantity: 20,
    productions: [],
    readiness: null,
    ...overrides,
  };
}

function build(
  orders: readonly RedesignProductionOrderInput[],
  options: { viewerId?: string | null; showBlocked?: boolean } = {},
) {
  return buildRedesignProductionModel(orders, {
    viewerId: options.viewerId,
    showBlocked: options.showBlocked ?? true,
    now: NOW,
  });
}

describe("safe production target", () => {
  it("เปิดตรงได้เฉพาะเมื่อมีใบผลิต active เดียว และ fail closed เมื่อกำกวมหรือปิดหมด", () => {
    const oneActive = [
      production("production-closed", [], "COMPLETED"),
      production("production-active"),
    ];
    const ambiguous = [production("production-a"), production("production-b")];
    const completedOnly = [production("production-only", [], "COMPLETED")];

    expect(selectRedesignProductionTarget(oneActive)).toBe("production-active");
    expect(selectRedesignProductionTarget(ambiguous)).toBeNull();
    expect(selectRedesignProductionTarget(completedOnly)).toBeNull();
    expect(
      redesignProductionActionHref(
        order({ id: "order/ambiguous", productions: ambiguous }),
      ),
    ).toBe("/orders/order%2Fambiguous?tab=production");
    expect(
      redesignProductionActionHref(order({ productions: oneActive })),
    ).toBe("/production/production-active");
  });
});

describe("production lane cards", () => {
  it("ไม่ปล่อยการ์ด PACK จนกว่าทุกขั้นนอก PACK จะเสร็จ", () => {
    const pendingPrint = step({ id: "print", stepType: "DTF_PRINT" });
    const pendingPack = step({
      id: "pack",
      stepType: "PACKAGING",
      sortOrder: 2,
    });
    const blocked = build([
      order({ productions: [production("production-1", [pendingPrint, pendingPack])] }),
    ]);

    expect(blocked.cards.map((card) => card.sectionKey)).toEqual(["lane:DTF"]);

    const released = build([
      order({
        productions: [
          production("production-1", [
            { ...pendingPrint, status: "COMPLETED" },
            pendingPack,
          ]),
        ],
      }),
    ]);

    expect(released.cards).toHaveLength(1);
    expect(released.cards[0]).toMatchObject({
      sectionKey: "lane:PACK",
      productionId: "production-1",
      stepId: "pack",
      actionHref: "/production/production-1",
    });
  });

  it("ไม่นับ HEAT_PRESS ที่ยังรอเสื้อเป็นงานที่ทำต่อได้ และบอกเหตุผลใน exception", () => {
    const model = build(
      [
        order({
          id: "order-press-gated",
          orderNumber: "ORD-PRESS-GATED",
          productions: [
            production("production-press-gated", [
              step({
                id: "garment",
                stepType: "GARMENT_PICK",
                status: "PENDING",
                sortOrder: 1,
              }),
              step({
                id: "film",
                stepType: "DTF_PRINT",
                status: "COMPLETED",
                sortOrder: 2,
              }),
              step({
                id: "press",
                stepType: "HEAT_PRESS",
                status: "PENDING",
                sortOrder: 3,
                assignedTo: { id: "viewer-me", name: "มีนา" },
              }),
            ]),
          ],
        }),
      ],
      { viewerId: "viewer-me" },
    );

    expect(model.cards.map((card) => card.stepId)).toEqual(["garment"]);
    expect(model.myWork).toEqual([]);
    expect(model.exceptions).toEqual([
      expect.objectContaining({
        orderId: "order-press-gated",
        reasons: [
          expect.objectContaining({
            kind: "blocked",
            label: "รีดร้อนยังไม่พร้อม",
          }),
        ],
        waitingOn: ["รอเสื้อ — เตรียมเสื้อ/งานร้านนอกยังไม่จบ"],
        actionHref: "/production/production-press-gated",
      }),
    ]);
  });

  it("คงงานผสมเป็นหลาย lane card และใช้ productionId จาก loop จริงทุกใบ", () => {
    const mixed = order({
      id: "order-mixed",
      orderNumber: "ORD-MIXED",
      productions: [
        production("production-mixed", [
          step({ id: "dtf", stepType: "DTF_PRINT", sortOrder: 1 }),
          step({ id: "embroider", stepType: "EMBROIDERY", sortOrder: 2 }),
          step({ id: "pack", stepType: "PACKAGING", sortOrder: 3 }),
        ]),
        production("production-prep", [
          step({ id: "pick", stepType: "GARMENT_PICK" }),
        ]),
      ],
    });

    const model = build([mixed]);
    const laneCards = model.cards.filter((card) => card.sectionKind === "lane");

    expect(laneCards).toHaveLength(3);
    expect(
      laneCards.map((card) => ({
        section: card.sectionKey,
        productionId: card.productionId,
        href: card.actionHref,
      })),
    ).toEqual(expect.arrayContaining([
      {
        section: "lane:PREP",
        productionId: "production-prep",
        href: "/production/production-prep",
      },
      {
        section: "lane:DTF",
        productionId: "production-mixed",
        href: "/production/production-mixed",
      },
      {
        section: "lane:EMBROIDERY",
        productionId: "production-mixed",
        href: "/production/production-mixed",
      },
    ]));
    expect(model.lanes.filter((lane) => lane.kind === "lane")).toEqual([
      expect.objectContaining({ key: "lane:PREP", count: 1 }),
      expect.objectContaining({ key: "lane:DTF", count: 1 }),
      expect.objectContaining({
        key: "lane:EMBROIDERY",
        count: 1,
        isOutsource: true,
      }),
    ]);
  });

  it("เรียงงานที่ลงมือได้ตาม deadline ก่อน แล้วใช้ priority ตัดสินเมื่อวันเท่ากัน", () => {
    const cardOrder = (
      id: string,
      deadline: string,
      priority: string,
    ) =>
      order({
        id,
        orderNumber: id,
        deadline,
        priority,
        productions: [
          production(`production-${id}`, [step({ id: `step-${id}` })]),
        ],
      });

    const model = build([
      cardOrder("late-urgent", "2026-08-18T00:00:00.000Z", "URGENT"),
      cardOrder("same-low", "2026-08-16T00:00:00.000Z", "LOW"),
      cardOrder("same-high", "2026-08-16T00:00:00.000Z", "HIGH"),
    ]);

    expect(model.cards.map((card) => card.orderId)).toEqual([
      "same-high",
      "same-low",
      "late-urgent",
    ]);
  });
});

describe("queues and exceptions", () => {
  const privateDetail = "ยอดค้าง 42,000 บาท — ห้ามหลุดออกภาพรวม";
  const blockedOrder = order({
    id: "order-blocked",
    orderNumber: "ORD-BLOCKED",
    internalStatus: "PRODUCTION_QUEUE",
    deadline: "2026-08-10T00:00:00.000Z",
    productions: [
      production("production-failed", [
        step({ id: "failed-a", status: "FAILED" }),
        step({ id: "failed-b", status: "FAILED", sortOrder: 2 }),
      ]),
    ],
    readiness: {
      ready: false,
      checks: [
        {
          label: "เงื่อนไขชำระเงิน",
          ok: false,
          waitingOn: "รอฝ่ายขาย/การเงิน",
          detail: privateDetail,
        },
        {
          label: "เงื่อนไขชำระเงิน",
          ok: false,
          waitingOn: "รอฝ่ายขาย/การเงิน",
          detail: privateDetail,
        },
      ],
    },
  });

  it("ยุบ failed + overdue + blocked เป็น exception เดียวและ dedupe เหตุผล", () => {
    const model = build([blockedOrder], { showBlocked: true });

    expect(model.exceptions).toHaveLength(1);
    expect(model.exceptions[0]).toMatchObject({
      orderId: "order-blocked",
      reasons: [
        { kind: "failed", label: "มีขั้นตอนล้มเหลว" },
        { kind: "overdue", label: "เลยกำหนด" },
        { kind: "blocked", label: "เงื่อนไขชำระเงิน" },
      ],
      waitingOn: ["รอฝ่ายขาย/การเงิน"],
      actionHref: "/redesign/orders/order-blocked",
    });
    expect(model.blockedQueue[0]?.blockers).toEqual(["เงื่อนไขชำระเงิน"]);
  });

  it("ส่งออกเฉพาะ readiness label + waitingOn และไม่คัดลอก detail", () => {
    const model = build([blockedOrder], { showBlocked: true });
    const serialized = JSON.stringify(model);

    expect(serialized).toContain("เงื่อนไขชำระเงิน");
    expect(serialized).toContain("รอฝ่ายขาย/การเงิน");
    expect(serialized).not.toContain(privateDetail);
    expect(serialized).not.toContain("42,000");
  });

  it("ซ่อนทั้ง blocked queue และ exception ของงานติดด่านเมื่อ showBlocked=false", () => {
    const model = build([blockedOrder], { showBlocked: false });

    expect(model.readyQueue).toEqual([]);
    expect(model.blockedQueue).toEqual([]);
    expect(model.exceptions).toEqual([]);
  });

  it("แยกคิวพร้อมจากคิวติดด่านโดยไม่เอางานเดียวกันไปอยู่สองกอง", () => {
    const ready = order({
      id: "order-ready",
      orderNumber: "ORD-READY",
      internalStatus: "DESIGN_APPROVED",
      productions: [],
      readiness: { ready: true, checks: [] },
    });
    const model = build([blockedOrder, ready], { showBlocked: true });

    expect(model.readyQueue.map((item) => item.orderId)).toEqual(["order-ready"]);
    expect(model.blockedQueue.map((item) => item.orderId)).toEqual([
      "order-blocked",
    ]);
    expect(model.readyQueue[0]?.createHref).toBe(
      "/production?create=order-ready",
    );
  });
});

describe("my work and post-production actions", () => {
  it("งานของฉันลิงก์ใบผลิตจาก loop โดยตรง แม้ออเดอร์มีหลายใบผลิต", () => {
    const model = build(
      [
        order({
          id: "order-multi-production",
          productions: [
            production("production-a", [
              step({
                id: "other-person",
                assignedTo: { id: "viewer-other", name: "คนอื่น" },
              }),
            ]),
            production("production-b", [
              step({
                id: "my-step",
                stepType: "HEAT_PRESS",
                customStepName: "รีดหน้าอก",
                assignedTo: { id: "viewer-me", name: "มีนา" },
              }),
              step({
                id: "my-completed-step",
                status: "COMPLETED",
                sortOrder: 2,
                assignedTo: { id: "viewer-me", name: "มีนา" },
              }),
            ]),
          ],
        }),
      ],
      { viewerId: "viewer-me" },
    );

    expect(model.myWork).toEqual([
      {
        key: "my-step",
        orderId: "order-multi-production",
        orderNumber: "ORD-0001",
        productionId: "production-b",
        stepId: "my-step",
        stepName: "รีดหน้าอก",
        status: "PENDING",
        actionHref: "/production/production-b",
      },
    ]);
  });

  it("post cards พาไป canonical tab ตามงาน และไม่เดาใบผลิตเมื่อกำกวม", () => {
    const model = build([
      order({
        id: "order-qc",
        internalStatus: "QUALITY_CHECK",
        productions: [production("production-qc")],
      }),
      order({
        id: "order-packing",
        internalStatus: "PACKING",
        productions: [production("production-packing")],
      }),
      order({
        id: "order-ready-to-ship",
        internalStatus: "READY_TO_SHIP",
        productions: [production("production-ready")],
      }),
      order({
        id: "order-qc-ambiguous",
        internalStatus: "QUALITY_CHECK",
        productions: [production("production-qc-a"), production("production-qc-b")],
      }),
      order({
        id: "order-qc-completed-only",
        internalStatus: "QUALITY_CHECK",
        productions: [production("production-done", [], "COMPLETED")],
      }),
    ]);
    const postCards = model.cards.filter((card) => card.sectionKind === "post");
    const cardOf = (orderId: string) =>
      postCards.find((card) => card.orderId === orderId);

    expect(cardOf("order-qc")).toMatchObject({
      productionId: "production-qc",
      actionHref: "/orders/order-qc?tab=production",
    });
    expect(cardOf("order-packing")?.actionHref).toBe(
      "/orders/order-packing?tab=production",
    );
    expect(cardOf("order-ready-to-ship")?.actionHref).toBe(
      "/orders/order-ready-to-ship?tab=delivery",
    );
    expect(cardOf("order-qc-ambiguous")).toMatchObject({
      productionId: null,
      actionHref: "/orders/order-qc-ambiguous?tab=production",
    });
    expect(cardOf("order-qc-completed-only")?.productionId).toBeNull();
    expect(
      model.lanes
        .filter((lane) => lane.kind === "post")
        .map((lane) => ({ key: lane.key, count: lane.count })),
    ).toEqual([
      { key: "post:QUALITY_CHECK", count: 3 },
      { key: "post:PACKING", count: 1 },
      { key: "post:READY_TO_SHIP", count: 1 },
    ]);
  });
});

describe("kanban source cap", () => {
  it("ยกธง capReached เมื่อข้อมูลชนเพดาน 200 แถวพอดี", () => {
    const orders = Array.from({ length: 200 }, (_, index) =>
      order({
        id: `order-${index}`,
        orderNumber: `ORD-${index}`,
        internalStatus: "READY_TO_SHIP",
      }),
    );

    expect(build(orders.slice(0, 199))).toMatchObject({
      totalOrders: 199,
      capReached: false,
    });
    expect(build(orders)).toMatchObject({
      totalOrders: 200,
      capReached: true,
    });
  });
});
