/** Run only through run-local-demo.ts check. Every cleanup is scoped to IDs created here. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { validateDemoDatabaseUrl } from "@/lib/demo-seed-plan";
import type { Role, ProductionStepType } from "@prisma/client";

validateDemoDatabaseUrl(process.env.DATABASE_URL || "");
if (
  process.env.ANAJAK_ERP_DEMO_MODE !== "1" ||
  process.env.PRODUCTION_V2_ENABLED === "1"
)
  throw new Error("ต้องใช้ฐาน demo และปิด Production V2");
const marker = `OPS-UI-${Date.now()}`;
const ids = {
  orders: [] as string[],
  productions: [] as string[],
  steps: [] as string[],
  runs: [] as string[],
  jobs: [] as string[],
  receipts: [] as string[],
  customer: "",
  vendor: "",
};
let passed = 0;
const browserManifest =
  ".tmp-test/ui-complete-20260913/operations-fixture.json";
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed++;
  console.log(`PASS ${label}`);
}
async function rejects(
  label: string,
  operation: () => Promise<unknown>,
  pattern: RegExp,
) {
  await assert.rejects(operation, pattern);
  passed++;
  console.log(`PASS ${label}`);
}

async function main() {
  if (process.argv.includes("--cleanup-browser")) {
    const fixture = JSON.parse(readFileSync(browserManifest, "utf8")) as {
      marker: string;
      printProduction: string;
      outsourceProduction: string;
      jobId: string;
    };
    const productions = await prisma.production.findMany({
      where: {
        id: { in: [fixture.printProduction, fixture.outsourceProduction] },
      },
      select: {
        id: true,
        orderId: true,
        steps: { select: { id: true } },
        order: {
          select: { customerId: true, customer: { select: { name: true } } },
        },
      },
    });
    assert.ok(
      productions.length > 0 &&
        productions.every(
          (production) => production.order.customer.name === fixture.marker,
        ),
      "Fixture ownership must match before cleanup",
    );
    ids.productions = productions.map((production) => production.id);
    ids.orders = productions.map((production) => production.orderId);
    ids.steps = productions.flatMap((production) =>
      production.steps.map((step) => step.id),
    );
    ids.customer = productions[0]!.order.customerId;
    const jobs = await prisma.outsourceOrder.findMany({
      where: { productionStepId: { in: ids.steps } },
      select: { id: true, vendorId: true, vendor: { select: { name: true } } },
    });
    assert.ok(
      jobs.every((job) => job.vendor.name === fixture.marker),
      "Fixture vendor must match before cleanup",
    );
    ids.jobs = jobs.map((job) => job.id);
    ids.vendor = jobs[0]?.vendorId ?? "";
    await cleanup();
    console.log("Browser operations fixtures cleaned up");
    return;
  }
  const owner = await prisma.user.findFirstOrThrow({
    where: { role: "OWNER", isActive: true },
  });
  const actor = (role: Role, userId = owner.id) =>
    appRouter.createCaller({ prisma, userId, userRole: role });
  const boss = actor("OWNER");
  const worker = actor("PRODUCTION_STAFF");
  const sales = actor("SALES");
  const otherWorker = actor("PRODUCTION_STAFF", "ops-ui-another-worker");
  const customer = await prisma.customer.create({
    data: { name: marker, customerType: "INDIVIDUAL" },
  });
  ids.customer = customer.id;
  try {
    const vendor = await prisma.vendor.create({ data: { name: marker } });
    ids.vendor = vendor.id;
    const makeProduction = async (
      suffix: string,
      type: ProductionStepType,
      qty: number,
    ) => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `${marker}-${suffix}`,
          notes: marker,
          customerId: customer.id,
          createdById: owner.id,
          internalStatus: "PRODUCING",
          items: { create: { description: marker, totalQuantity: qty } },
          designs: {
            create: {
              versionNumber: 1,
              approvalStatus: "APPROVED",
              fileUrl: "/api/files/designs/operations-ui-fixture.pdf",
            },
          },
        },
      });
      ids.orders.push(order.id);
      const production = await prisma.production.create({
        data: {
          orderId: order.id,
          steps: {
            create: [
              {
                stepType: type,
                status: "PENDING",
                sortOrder: 0,
                qtyTotal: qty,
              },
              ...(type === "DTF_PRINT"
                ? [
                    {
                      stepType: "HEAT_PRESS" as const,
                      status: "PENDING" as const,
                      sortOrder: 1,
                      qtyTotal: qty,
                    },
                  ]
                : []),
            ],
          },
        },
        include: { steps: true },
      });
      ids.productions.push(production.id);
      ids.steps.push(...production.steps.map((step) => step.id));
      return {
        order,
        production,
        step: production.steps.find((step) => step.stepType === type)!,
      };
    };
    const print = await makeProduction("PRINT", "DTF_PRINT", 10);
    if (process.argv.includes("--browser")) {
      const outside = await makeProduction("OUTSOURCE", "EMBROIDERY", 10);
      const job = await boss.outsource.createOrder({
        productionStepId: outside.step.id,
        vendorId: vendor.id,
        description: marker,
        quantity: 10,
      });
      ids.jobs.push(job.id);
      writeFileSync(
        browserManifest,
        JSON.stringify(
          {
            marker,
            printOrder: print.order.orderNumber,
            printProduction: print.production.id,
            outsourceOrder: outside.order.orderNumber,
            outsourceProduction: outside.production.id,
            jobId: job.id,
          },
          null,
          2,
        ),
      );
      console.log(
        `Browser fixtures ready: ${browserManifest}. Run the same command with --cleanup-browser after browser QA.`,
      );
      await prisma.$disconnect();
      return;
    }
    const queue = await worker.printRun.queue();
    check(
      "DTF ที่ไฟล์พร้อมอยู่ในคิวและมีจำนวนเหลือจริง",
      queue.find((job) => job.stepId === print.step.id)?.remaining === 10,
    );
    await rejects(
      "ฝ่ายขายเปิดรอบไม่ได้",
      () =>
        sales.printRun.create({ items: [{ stepId: print.step.id, qty: 10 }] }),
      /สิทธิ์/,
    );
    const run = await worker.printRun.create({
      items: [{ stepId: print.step.id, qty: 10 }],
    });
    ids.runs.push(run.id);
    check(
      "ผู้สร้างมีคำสั่งรอบ legacy ที่หน้าเครื่องใช้",
      (await worker.printRun.list())
        .find((item) => item.id === run.id)
        ?.availableCommands.includes("markPrinted"),
    );
    check(
      "ช่างอื่นไม่มีคำสั่งรอบของคนอื่น",
      (await otherWorker.printRun.list()).find((item) => item.id === run.id)
        ?.availableCommands.length === 0,
    );
    await rejects(
      "ช่างอื่นสั่งปิดม้วนของคนอื่นไม่ได้",
      () => otherWorker.printRun.markPrinted({ runId: run.id }),
      /คนอื่น/,
    );
    await rejects(
      "ตัดแยกก่อนพิมพ์จบไม่ได้",
      () => worker.printRun.complete({ runId: run.id }),
      /พิมพ์จบ/,
    );
    await worker.printRun.markPrinted({ runId: run.id });
    await worker.printRun.complete({
      runId: run.id,
      extras: [{ itemId: run.items[0]!.id, extraQty: 3, label: marker }],
    });
    const step = await prisma.productionStep.findUniqueOrThrow({
      where: { id: print.step.id },
    });
    check(
      "ตัดแยกเสร็จจึงปิด DTF และนับครบ10",
      step.status === "COMPLETED" && step.qtyDone === 10,
    );
    await rejects(
      "กดจบรอบซ้ำไม่บวกยอดอีก",
      () => worker.printRun.complete({ runId: run.id }),
      /พิมพ์จบ|เสร็จ|สถานะ/,
    );
    check(
      "ยอดขั้นยัง10หลังคำสั่งซ้ำ",
      (
        await prisma.productionStep.findUniqueOrThrow({
          where: { id: print.step.id },
        })
      ).qtyDone === 10,
    );
    const film = (await worker.filmStock.list({ search: marker })).find(
      (item) => item.orderId === print.order.id,
    )!;
    check("ฟิล์มเผื่อเข้าคลัง3", film?.qty === 3);
    await rejects(
      "ฝ่ายขายตัดคลังไม่ได้",
      () => sales.filmStock.consume({ id: film.id, qty: 1 }),
      /สิทธิ์/,
    );
    await worker.filmStock.consume({ id: film.id, qty: 2, note: marker });
    await rejects(
      "ตัดคลังเกินของคงเหลือไม่ได้",
      () => worker.filmStock.consume({ id: film.id, qty: 2 }),
      /ไม่พอ/,
    );
    check(
      "คลังเหลือ1หลังตัด2และปฏิเสธคำสั่งเกิน",
      (await prisma.filmStock.findUniqueOrThrow({ where: { id: film.id } }))
        .qty === 1,
    );

    const outside = await makeProduction("OUTSOURCE", "EMBROIDERY", 10);
    await rejects(
      "ช่างสร้างใบร้านนอกแทนหัวหน้าไม่ได้",
      () =>
        worker.outsource.createOrder({
          productionStepId: outside.step.id,
          vendorId: vendor.id,
          description: marker,
          quantity: 10,
        }),
      /สิทธิ์/,
    );
    const job = await boss.outsource.createOrder({
      productionStepId: outside.step.id,
      vendorId: vendor.id,
      description: marker,
      quantity: 10,
    });
    ids.jobs.push(job.id);
    await worker.outsource.updateOrderStatus({ id: job.id, status: "SENT" });
    await rejects(
      "รับกลับโดยไม่มีใบตรวจนับไม่ได้",
      () =>
        worker.outsource.updateOrderStatus({
          id: job.id,
          status: "RECEIVED_BACK",
        }),
      /ใบตรวจนับ/,
    );
    const receiptCommand = {
      orderId: outside.order.id,
      outsourceOrderId: job.id,
      receiptType: "OUTSOURCE_RETURN" as const,
      idempotencyKey: randomUUID(),
      photoUrls: [],
      lines: [
        { description: marker, qtyExpected: 10, qtyCounted: 8, defectQty: 1 },
      ],
    };
    const receipt = await boss.goodsReceipt.create(receiptCommand);
    ids.receipts.push(receipt.id);
    const replay = await boss.goodsReceipt.create(receiptCommand);
    check(
      "กดใบตรวจนับซ้ำได้ใบเดิม ไม่สร้างซ้ำ",
      replay.id === receipt.id &&
        (await prisma.goodsReceipt.count({
          where: { outsourceOrderId: job.id },
        })) === 1,
    );
    await worker.outsource.updateOrderStatus({
      id: job.id,
      status: "RECEIVED_BACK",
    });
    await rejects(
      "ช่างตัดสิน QC ร้านนอกไม่ได้",
      () =>
        worker.outsource.updateOrderStatus({ id: job.id, status: "QC_PASSED" }),
      /ผู้จัดการ/,
    );
    await rejects(
      "หัวหน้าผ่านเต็ม10ไม่ได้เมื่อของดีรับจริง7",
      () =>
        boss.outsource.updateOrderStatus({ id: job.id, status: "QC_PASSED" }),
      /ของดี 7 จาก 10/,
    );
    check(
      "QC ที่ถูกปฏิเสธไม่บวกจำนวนขั้น",
      (
        await prisma.productionStep.findUniqueOrThrow({
          where: { id: outside.step.id },
        })
      ).qtyDone === 0,
    );
    const extraReceipt = await boss.goodsReceipt.create({
      ...receiptCommand,
      idempotencyKey: randomUUID(),
      lines: [
        {
          description: `${marker} รับเพิ่ม`,
          qtyExpected: 3,
          qtyCounted: 3,
          defectQty: 0,
        },
      ],
    });
    ids.receipts.push(extraReceipt.id);
    await boss.outsource.updateOrderStatus({
      id: job.id,
      status: "QC_PASSED",
      qcNotes: "ตรวจครบ10 ของเสียแยกแล้ว",
    });
    await rejects(
      "QC ผ่านซ้ำไม่บวกยอดอีก",
      () =>
        boss.outsource.updateOrderStatus({ id: job.id, status: "QC_PASSED" }),
      /เปลี่ยนเป็น/,
    );
    const passedStep = await prisma.productionStep.findUniqueOrThrow({
      where: { id: outside.step.id },
    });
    check(
      "รับหลายครั้งแล้ว QC ผ่าน นับเพียง10และปิดขั้น",
      passedStep.qtyDone === 10 && passedStep.status === "COMPLETED",
    );
    const dto = JSON.stringify({
      board: await boss.factory.board(),
      station: await worker.factory.stationQueue(),
      printQueue: await sales.printRun.queue(),
      runs: await sales.printRun.list(),
      outsource: await sales.outsource.listOrders({}),
    });
    check(
      "คิวและTVไม่มีช่องเงินแม้ OWNER",
      !/"(?:unitCost|totalCost|costPrice|totalAmount|shippingCost|basePrice)"/.test(
        dto,
      ),
    );
    console.log(`Operations UI: ${passed} checks passed`);
  } finally {
    if (!process.argv.includes("--browser")) await cleanup();
  }
}
async function cleanup() {
  // Browser-created runs still belong only to the fixture orders.
  const relatedRuns = await prisma.printRunItem.findMany({
    where: { orderId: { in: ids.orders } },
    select: { printRunId: true },
  });
  ids.runs = [
    ...new Set([...ids.runs, ...relatedRuns.map((item) => item.printRunId)]),
  ];
  const fixtureRuns = await prisma.printRun.findMany({
    where: { id: { in: ids.runs } },
    select: { items: { select: { orderId: true } } },
  });
  assert.ok(
    fixtureRuns.every((run) =>
      run.items.every((item) => ids.orders.includes(item.orderId)),
    ),
    "Refuse cleanup of a print run containing non-fixture orders",
  );
  const relatedReceipts = await prisma.goodsReceipt.findMany({
    where: { orderId: { in: ids.orders } },
    select: { id: true },
  });
  ids.receipts = [
    ...new Set([...ids.receipts, ...relatedReceipts.map((item) => item.id)]),
  ];
  const films = await prisma.filmStock.findMany({
    where: { orderId: { in: ids.orders } },
    select: { id: true },
  });
  const items = await prisma.printRunItem.findMany({
    where: { printRunId: { in: ids.runs } },
    select: { id: true },
  });
  const auditIds = [
    ...ids.orders,
    ...ids.productions,
    ...ids.steps,
    ...ids.runs,
    ...ids.jobs,
    ...ids.receipts,
    ...films.map((item) => item.id),
    ...items.map((item) => item.id),
    ids.customer,
    ids.vendor,
  ].filter(Boolean);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: auditIds } } });
  await prisma.notification.deleteMany({
    where: { entityId: { in: auditIds } },
  });
  await prisma.filmStock.deleteMany({
    where: { id: { in: films.map((item) => item.id) } },
  });
  await prisma.printRunItem.deleteMany({
    where: { printRunId: { in: ids.runs } },
  });
  await prisma.printRun.deleteMany({ where: { id: { in: ids.runs } } });
  await prisma.goodsReceipt.deleteMany({
    where: { orderId: { in: ids.orders } },
  });
  await prisma.outsourceOrder.deleteMany({ where: { id: { in: ids.jobs } } });
  await prisma.costEntry.deleteMany({ where: { orderId: { in: ids.orders } } });
  await prisma.production.deleteMany({
    where: { id: { in: ids.productions } },
  });
  await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  if (ids.vendor) await prisma.vendor.deleteMany({ where: { id: ids.vendor } });
  if (ids.customer)
    await prisma.customer.deleteMany({ where: { id: ids.customer } });
  if (process.argv.includes("--cleanup-browser"))
    rmSync(browserManifest, { force: true });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Operations verification failed",
  );
  process.exitCode = 1;
});
