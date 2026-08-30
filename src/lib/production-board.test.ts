import { describe, expect, it } from "vitest";
import {
  bucketOf,
  buildBoardColumns,
  buildProductionBoard,
  filterBoardJobs,
  sortBoardJobs,
  STATION_QUEUE,
  type BoardOrderLike,
  type BoardStepLike,
} from "./production-board";

// เวลาอ้างอิงทุกเคส: 15 ส.ค. 2026 09:00 เวลาไทย (= 02:00Z)
const NOW = new Date("2026-08-15T02:00:00.000Z");

let seq = 0;
function step(over: Partial<BoardStepLike> & { stepType: string }): BoardStepLike {
  seq += 1;
  return {
    id: `step-${seq}`,
    status: "PENDING",
    sortOrder: seq,
    customStepName: null,
    qtyDone: 0,
    qtyTotal: null,
    assignedTo: null,
    ...over,
  };
}

function order(
  over: Partial<BoardOrderLike<BoardStepLike>> & { id: string },
): BoardOrderLike<BoardStepLike> {
  return {
    orderNumber: `ORD-${over.id}`,
    deadline: "2026-08-20T03:00:00.000Z",
    priority: "NORMAL",
    internalStatus: "PRODUCING",
    customerName: "ลูกค้า ก",
    totalQuantity: 10,
    productions: [],
    ...over,
  };
}

const OPTS = { now: NOW, showBlocked: true } as const;

describe("bucketOf — ใช้ปฏิทินไทย ไม่ใช่ UTC ของเครื่อง", () => {
  it("เที่ยงคืนครึ่งของไทย (17:30Z วันก่อน) ยังนับเป็นวันนี้", () => {
    // 2026-08-15 00:30 +07 = 2026-08-14T17:30Z — ถ้าเทียบด้วย UTC จะกลายเป็น "เลยกำหนด"
    expect(bucketOf("2026-08-14T17:30:00.000Z", NOW)).toBe("today");
  });

  it("แยก เลยกำหนด / วันนี้ / พรุ่งนี้ / ใน 7 วัน / หลังจากนั้น / ไม่กำหนด", () => {
    expect(bucketOf("2026-08-14T03:00:00.000Z", NOW)).toBe("late");
    expect(bucketOf("2026-08-15T10:00:00.000Z", NOW)).toBe("today");
    expect(bucketOf("2026-08-16T03:00:00.000Z", NOW)).toBe("tomorrow");
    expect(bucketOf("2026-08-21T03:00:00.000Z", NOW)).toBe("week");
    expect(bucketOf("2026-09-01T03:00:00.000Z", NOW)).toBe("later");
    expect(bucketOf(null, NOW)).toBe("none");
  });
});

describe("buildProductionBoard — จุดงาน", () => {
  it("sortOrder เท่ากันเลือก id ต่ำสุดให้ตรง server current-lane guard", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "equal-sort",
          productions: [
            {
              id: "p1",
              steps: [
                step({ id: "step-z", stepType: "DTF_PRINT", sortOrder: 1 }),
                step({ id: "step-a", stepType: "DTF_PRINT", sortOrder: 1 }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );

    expect(board.jobs[0]?.spots[0]?.step?.id).toBe("step-a");
  });

  it("งานผสมโผล่ทุกสายที่ค้างอยู่ และนับจุดงานมากกว่าจำนวนออเดอร์", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "mix",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "GARMENT_PICK", status: "COMPLETED" }),
                step({ stepType: "EMBROIDERY" }),
                step({ stepType: "DTF_PRINT" }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );
    expect(board.totalJobs).toBe(1);
    expect(board.totalSpots).toBe(2);
    expect(board.jobs[0]!.stationKeys.sort()).toEqual(["lane:DTF", "lane:EMBROIDERY"]);
  });

  it("PACKAGING เก่าไม่กลับมาเป็นเลนแพ็กก่อน QC และใบที่ผลิตจริงครบถูกส่งไปจุดกู้เข้า QC", () => {
    const notReady = buildProductionBoard(
      [
        order({
          id: "pack-wait",
          productions: [
            {
              id: "p1",
              steps: [step({ stepType: "DTF_PRINT" }), step({ stepType: "PACKAGING" })],
            },
          ],
        }),
      ],
      OPTS,
    );
    expect(notReady.jobs[0]!.stationKeys).toEqual(["lane:DTF"]);
    expect(notReady.jobs[0]!.stationKeys).not.toContain("lane:PACK");

    const ready = buildProductionBoard(
      [
        order({
          id: "pack-ready",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "DTF_PRINT", status: "COMPLETED" }),
                step({ stepType: "PACKAGING" }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );
    expect(ready.jobs[0]!.stationKeys).toEqual(["legacy:qc"]);
    expect(ready.jobs[0]!.spots[0]).toMatchObject({
      productionId: "p1",
      step: null,
      ready: false,
    });
    expect(ready.jobs[0]!.spots[0]!.waitingOn.join(" ")).toContain("ส่งเข้า QC");

    const packOnly = buildProductionBoard(
      [
        order({
          id: "pack-only",
          productions: [
            { id: "legacy-only", steps: [step({ stepType: "PACKAGING" })] },
          ],
        }),
      ],
      OPTS,
    );
    expect(packOnly.jobs[0]!.stationKeys).toEqual(["legacy:qc"]);
    expect(packOnly.exceptions[0]).toMatchObject({
      orderId: "pack-only",
      reasons: [{ label: "รอส่งเข้า QC", tone: "amber" }],
    });
  });

  it("คิวรีดที่ยังไม่พร้อมบอกว่ารออะไร และไม่ถูกทำเป็นงานที่ลงมือได้", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "press",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "DTF_PRINT", status: "COMPLETED" }),
                step({ stepType: "EMBROIDERY" }),
                step({ stepType: "HEAT_PRESS" }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );
    const press = board.jobs[0]!.spots.find((s) => s.stationKey === "lane:DTF")!;
    expect(press.ready).toBe(false);
    expect(press.waitingOn.join(" ")).toContain("รอเสื้อ");
    expect(board.exceptions[0]!.reasons.some((r) => r.label === "รีดร้อนยังไม่พร้อม")).toBe(
      true,
    );
  });
});

describe("buildProductionBoard — คิวรอเปิดใบผลิตและสิทธิ์", () => {
  const blocked = order({
    id: "blocked",
    internalStatus: "CONFIRMED",
    productions: [],
    readiness: {
      ready: false,
      checks: [{ label: "ยังไม่รับมัดจำ", ok: false, waitingOn: "รอการเงิน" }],
    },
  });

  it("หัวหน้าเห็นงานติดด่านพร้อมเหตุผลและข้ามด่านได้", () => {
    const board = buildProductionBoard([blocked], OPTS);
    expect(board.jobs).toHaveLength(1);
    expect(board.exceptions[0]!.skippable).toBe(true);
    expect(board.exceptions[0]!.waitingOn).toEqual(["รอการเงิน"]);
  });

  it("ช่างไม่เห็นงานติดด่านเลย — จอหน้างานมีแต่งานที่ลงมือได้", () => {
    const board = buildProductionBoard([blocked], { now: NOW, showBlocked: false });
    expect(board.jobs).toHaveLength(0);
    expect(board.exceptions).toHaveLength(0);
  });

  it("ไม่หยิบ detail ของ readiness มาแสดง (มีตัวเลขเงินอยู่ข้างใน)", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "money",
          internalStatus: "CONFIRMED",
          readiness: {
            ready: false,
            checks: [
              {
                label: "ยังไม่รับมัดจำ",
                ok: false,
                waitingOn: "รอการเงิน",
              },
            ],
          },
        }),
      ],
      OPTS,
    );
    expect(JSON.stringify(board)).not.toContain("฿");
  });
});

describe("buildProductionBoard — งานที่ต้องแก้ก่อน", () => {
  it("ยุบหลายเหตุผลของออเดอร์เดียวเป็นแถวเดียว และแดงมาก่อนเหลือง", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "amber",
          deadline: "2026-09-01T03:00:00.000Z",
          internalStatus: "CONFIRMED",
          readiness: { ready: false, checks: [{ label: "แบบยังไม่อนุมัติ", ok: false }] },
        }),
        order({
          id: "red",
          deadline: "2026-08-10T03:00:00.000Z",
          productions: [
            { id: "p1", steps: [step({ stepType: "DTF_PRINT", status: "FAILED" })] },
          ],
        }),
      ],
      OPTS,
    );
    expect(board.exceptions.map((e) => e.orderId)).toEqual(["red", "amber"]);
    expect(board.exceptions[0]!.reasons.map((r) => r.label).sort()).toEqual([
      "มีปัญหา",
      "เลยกำหนด",
    ]);
  });
});

describe("rail — บอกว่างานเดินถึงไหนทั้งเส้น", () => {
  it("สายที่ใบนี้ไม่ใช้ขึ้นเป็น na ไม่ใช่ 'ยังไม่ถึง'", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "dtf-only",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "GARMENT_PICK", status: "COMPLETED" }),
                step({ stepType: "DTF_PRINT", status: "COMPLETED" }),
                step({ stepType: "HEAT_PRESS", status: "IN_PROGRESS" }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );
    const rail = Object.fromEntries(board.jobs[0]!.rail.map((p) => [p.key, p.state]));
    expect(rail).toMatchObject({
      prep: "done",
      film: "done",
      press: "now",
      outsource: "na",
      qc: "wait",
      pack: "wait",
    });
  });

  it("ออเดอร์ที่ผ่านด่านผลิตแล้ว ขั้นผลิตถือว่าจบและ QC/แพ็คเดินตามสถานะจริง", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "packing",
          internalStatus: "PACKING",
          productions: [
            { id: "p1", steps: [step({ stepType: "DTF_PRINT", status: "PENDING" })] },
          ],
        }),
      ],
      OPTS,
    );
    const rail = Object.fromEntries(board.jobs[0]!.rail.map((p) => [p.key, p.state]));
    expect(rail).toMatchObject({ film: "done", qc: "done", pack: "now" });
    expect(board.jobs[0]!.stationKeys).toEqual(["post:pack"]);
  });
});

describe("ตัวกรองสายงานและคำค้น", () => {
  const orders = [
    order({
      id: "a",
      orderNumber: "ORD-2608-0001",
      customerName: "ร้านกาแฟ Roast Lab",
      productions: [{ id: "p1", steps: [step({ stepType: "DTF_PRINT" })] }],
    }),
    order({
      id: "b",
      orderNumber: "ORD-2608-0002",
      customerName: "ชมรมศิษย์เก่า",
      productions: [{ id: "p2", steps: [step({ stepType: "EMBROIDERY" })] }],
    }),
  ];

  it("กรองตามสายและค้นหาชื่อลูกค้าได้", () => {
    const board = buildProductionBoard(orders, OPTS);
    expect(filterBoardJobs(board.jobs, board.stations, "lane:DTF", "")).toHaveLength(1);
    expect(filterBoardJobs(board.jobs, board.stations, "", "roast")).toHaveLength(1);
    expect(filterBoardJobs(board.jobs, board.stations, "lane:DTF", "ชมรม")).toHaveLength(0);
  });

  it("สายที่ไม่มีอยู่จริงใน URL ถือว่าไม่ได้กรอง — ไม่ทำให้จอว่างเปล่าโดยไม่มีเหตุผล", () => {
    const board = buildProductionBoard(orders, OPTS);
    expect(filterBoardJobs(board.jobs, board.stations, "lane:SILKSCREEN", "")).toHaveLength(2);
  });

  it("แถบสายงานโชว์เฉพาะสายที่มีงาน และเรียงตามทางเดินงาน", () => {
    const board = buildProductionBoard(
      [
        ...orders,
        order({ id: "q", internalStatus: "CONFIRMED", productions: [] }),
        order({ id: "s", internalStatus: "READY_TO_SHIP", productions: [] }),
      ],
      OPTS,
    );
    expect(board.stations.map((s) => s.key)).toEqual([
      STATION_QUEUE,
      "lane:DTF",
      "lane:EMBROIDERY",
      "post:ship",
    ]);
  });
});

describe("บอร์ดคอลัมน์ตามสถานี", () => {
  it("งานผสมโผล่ทุกคอลัมน์ที่มันค้างอยู่ — ไม่ยุบเหลือคอลัมน์เดียว", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "mix",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "GARMENT_PICK", status: "COMPLETED" }),
                step({ stepType: "EMBROIDERY" }),
                step({ stepType: "DTF_PRINT" }),
              ],
            },
          ],
        }),
      ],
      OPTS,
    );
    const columns = buildBoardColumns(board.jobs, board.stations);
    const byKey = Object.fromEntries(columns.map((c) => [c.station.key, c.cards.length]));
    expect(byKey).toEqual({ "lane:DTF": 1, "lane:EMBROIDERY": 1 });
  });

  it("การ์ดในคอลัมน์เรียงตามกำหนดส่ง งานที่ต้องส่งก่อนอยู่บนสุด", () => {
    const board = buildProductionBoard(
      [
        order({
          id: "later",
          orderNumber: "ORD-LATER",
          deadline: "2026-09-01T03:00:00.000Z",
          productions: [{ id: "p1", steps: [step({ stepType: "DTF_PRINT" })] }],
        }),
        order({
          id: "soon",
          orderNumber: "ORD-SOON",
          deadline: "2026-08-16T03:00:00.000Z",
          productions: [{ id: "p2", steps: [step({ stepType: "DTF_PRINT" })] }],
        }),
      ],
      OPTS,
    );
    const dtf = buildBoardColumns(board.jobs, board.stations).find(
      (c) => c.station.key === "lane:DTF",
    )!;
    expect(dtf.cards.map((c) => c.job.order.orderNumber)).toEqual(["ORD-SOON", "ORD-LATER"]);
  });

  it("คอลัมน์เรียงตามทางเดินงานจริง ไม่ใช่ตามตัวอักษร", () => {
    const board = buildProductionBoard(
      [
        order({ id: "q", internalStatus: "CONFIRMED", productions: [] }),
        order({
          id: "emb",
          productions: [{ id: "p1", steps: [step({ stepType: "EMBROIDERY" })] }],
        }),
        order({ id: "ship", internalStatus: "READY_TO_SHIP", productions: [] }),
        order({
          id: "prep",
          productions: [{ id: "p2", steps: [step({ stepType: "GARMENT_PICK" })] }],
        }),
      ],
      OPTS,
    );
    expect(buildBoardColumns(board.jobs, board.stations).map((c) => c.station.key)).toEqual([
      STATION_QUEUE,
      "lane:PREP",
      "lane:EMBROIDERY",
      "post:ship",
    ]);
  });
});

describe("เรียงและกรองบอร์ด", () => {
  const mine = { id: "u1", name: "ช่างต้น" };
  const orders = [
    order({
      id: "a",
      orderNumber: "ORD-0001",
      deadline: "2026-08-30T03:00:00.000Z",
      priority: "URGENT",
      productions: [{ id: "p1", steps: [step({ stepType: "DTF_PRINT", assignedTo: mine })] }],
    }),
    order({
      id: "b",
      orderNumber: "ORD-0009",
      deadline: "2026-08-16T03:00:00.000Z",
      priority: "NORMAL",
      productions: [{ id: "p2", steps: [step({ stepType: "EMBROIDERY" })] }],
    }),
    order({
      id: "c",
      orderNumber: "ORD-0005",
      deadline: "2026-09-20T03:00:00.000Z",
      priority: "NORMAL",
      productions: [
        {
          id: "p3",
          steps: [
            step({ stepType: "DTF_PRINT", status: "COMPLETED" }),
            step({ stepType: "EMBROIDERY" }),
            step({ stepType: "HEAT_PRESS" }),
          ],
        },
      ],
    }),
  ];
  const board = buildProductionBoard(orders, { ...OPTS, viewerId: "u1" });
  const nums = (jobs: readonly { order: { orderNumber: string } }[]) =>
    jobs.map((job) => job.order.orderNumber);

  it("เรียงตามกำหนดส่ง ด่วนก่อน และเลขงานล่าสุดได้ต่างกันจริง", () => {
    expect(nums(sortBoardJobs(board.jobs, "due"))).toEqual(["ORD-0009", "ORD-0001", "ORD-0005"]);
    expect(nums(sortBoardJobs(board.jobs, "urgent"))[0]).toBe("ORD-0001");
    expect(nums(sortBoardJobs(board.jobs, "newest"))).toEqual([
      "ORD-0009",
      "ORD-0005",
      "ORD-0001",
    ]);
  });

  it("ค่าเรียงที่ไม่รู้จักตกกลับกำหนดส่ง ไม่ใช่สลับมั่ว", () => {
    expect(nums(sortBoardJobs(board.jobs, "อะไรก็ไม่รู้"))).toEqual(
      nums(sortBoardJobs(board.jobs, "due")),
    );
  });

});

describe("งานของฉัน", () => {
  it("เก็บเฉพาะขั้นที่คน login ถืออยู่และยังไม่เสร็จ", () => {
    const mine = { id: "u1", name: "ช่างต้น" };
    const board = buildProductionBoard(
      [
        order({
          id: "own",
          productions: [
            {
              id: "p1",
              steps: [
                step({ stepType: "DTF_PRINT", assignedTo: mine, status: "IN_PROGRESS" }),
                step({ stepType: "HEAT_PRESS", assignedTo: mine, status: "COMPLETED" }),
                step({ stepType: "EMBROIDERY", assignedTo: { id: "u2", name: "อื่น" } }),
              ],
            },
          ],
        }),
      ],
      { now: NOW, showBlocked: true, viewerId: "u1" },
    );
    expect(board.myWork).toHaveLength(1);
    expect(board.myWork[0]!.stepName).toBe("พิมพ์ฟิล์ม DTF");
  });
});
