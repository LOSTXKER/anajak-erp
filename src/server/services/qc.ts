/**
 * QC เชิงนับ (FLOW-REDESIGN ก้อน 3) — นับของจุดที่ 2: ตรวจก่อนแพ็ค
 *
 * flow ตามแบบ (doc หัวข้อ 4): ผลิตครบ → ออเดอร์เด้ง QUALITY_CHECK เอง →
 * ตรวจ+นับ "ดีกี่ตัว เสียกี่ตัว" (ของเสียกรอก ไซส์×ลาย×สาเหตุ×รูป — เฉพาะตอนมีของเสีย)
 * → ของดียังไม่ครบและมีของเสีย: ถอยกลับผลิต + งานแก้อัตโนมัติ (reopenProductionsForRework เดิม)
 *   + เช็คเสื้อสำรอง (เบิกเผื่อไว้) ไม่พอ = กระดิ่งแอดมินคุยลูกค้า → วนกลับตรวจรอบใหม่
 * → ของดีครบ: เด้งเข้าแพ็คเอง แม้พบของเสียเพิ่มจากเสื้อเผื่อ (ยังเก็บ defect ไว้ทำสถิติ)
 *
 * กติกา: ไม่มีเงินใน flow นี้ · ห้ามเพิ่มงานกรอกหน้างาน (ของดีล้วน = กดบันทึกเดียวจบ)
 */

import { createHash } from "node:crypto";
import { badRequest, conflict, internal } from "@/server/errors";
import { createAuditLog, createNotification } from "@/server/helpers";
import { qcReasonLabel } from "@/lib/qc";
// สูตรตัดสินล้วน (validate/นับเกิน/สำรอง/ทางไปต่อ) แยกไป qc-count.ts — unit test ได้ไม่ต้องมี DB
import {
  spareAvailableOf,
  assertValidQcCounts,
  assertQcNotOverCount,
  qcNextMove,
} from "@/server/services/qc-count";
import {
  transitionOrder,
  advanceOrderForward,
  reopenProductionsForRework,
} from "@/server/services/order-status";
import { getGarmentPickState } from "@/server/services/garment-pick";
import { promoteOrderArtworks } from "@/server/services/artwork";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import type { QualityDisposition } from "@prisma/client";
import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
  type SpecializedQuantityOutput,
} from "@/server/services/manufacturing-operation-adapter";
import { assertProductionV2ApiEnabled } from "@/server/services/production-v2-gate";

// ============================================================
// บริบทก่อนตรวจ — ยอดคาดต่อไซส์ + ลายของงาน + เสื้อสำรองที่เบิกเผื่อไว้
// ============================================================

export async function getQcContext(prisma: ExtendedPrismaClient, orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      internalStatus: true,
      items: {
        select: {
          products: {
            select: {
              id: true,
              description: true,
              itemSource: true,
              variants: { select: { size: true, color: true, quantity: true } },
            },
          },
          prints: { select: { position: true, printType: true } },
        },
      },
      qcRecords: { select: { qtyGood: true, qtyDefect: true } },
    },
  });

  // แถวนับต่อไซส์/สี — ยอดคาดจากเนื้อออเดอร์ (เหมือนใบตรวจรับของเข้า)
  const lines = order.items.flatMap((it) =>
    it.products.flatMap((p) =>
      p.variants
        .filter((v) => v.quantity > 0)
        .map((v) => ({
          description: p.description,
          size: v.size,
          color: v.color,
          qtyExpected: v.quantity,
        }))
    )
  );

  // ลายของงาน — ให้เลือกตอนระบุว่าชิ้นเสียเป็นลายไหน (งานหลายลายชี้ตัวปัญหาได้)
  const printLabels = [
    ...new Set(
      order.items.flatMap((it) =>
        it.prints.map((pr) => `${pr.position}${pr.printType ? ` (${pr.printType})` : ""}`)
      )
    ),
  ];

  // เสื้อสำรอง = เบิกเผื่อเกินที่ต้องใช้ (FROM_STOCK — ก้อน 1/3: default เผื่อ 3%)
  const pick = await getGarmentPickState(prisma, orderId);
  const spareAvailable = spareAvailableOf(pick.lines);

  const checkedGood = order.qcRecords.reduce((s, r) => s + r.qtyGood, 0);
  const checkedDefect = order.qcRecords.reduce((s, r) => s + r.qtyDefect, 0);

  return {
    orderNumber: order.orderNumber,
    internalStatus: order.internalStatus,
    lines,
    printLabels,
    spareAvailable,
    checkedGood,
    checkedDefect,
    totalExpected: lines.reduce((s, l) => s + l.qtyExpected, 0),
  };
}

// ============================================================
// บันทึกผลตรวจ — ดีล้วนเด้งแพ็ค · มีของเสียถอยกลับผลิต+งานแก้+กระดิ่ง
// ============================================================

export interface CreateQcRecordParams {
  orderId: string;
  idempotencyKey: string;
  operationJobId?: string;
  expectedRevision?: number;
  canSupervise?: boolean;
  qtyGood: number;
  quantityLines?: Array<{ quantityLineId: string; qtyGood: number }>;
  defects: Array<{
    quantityLineId?: string;
    qty: number;
    size?: string;
    color?: string;
    printLabel?: string;
    reason: string;
    photoUrls?: string[];
    note?: string;
    disposition?: QualityDisposition;
  }>;
  notes?: string;
  userId: string;
}

interface QcStoredOutcome {
  requestFingerprint: string;
  spareAvailable: number;
  reworkOpened: boolean;
  heldForStock: boolean;
  movedToPacking: boolean;
}

function qcRecordIdForRequest(orderId: string, idempotencyKey: string) {
  return `qc_${createHash("sha256")
    .update(`${orderId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function qcRequestFingerprint(params: CreateQcRecordParams) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        orderId: params.orderId,
        operationJobId: params.operationJobId ?? null,
        expectedRevision: params.expectedRevision ?? null,
        qtyGood: params.qtyGood,
        quantityLines: params.quantityLines ?? [],
        defects: params.defects.map((defect) => ({
          quantityLineId: defect.quantityLineId ?? null,
          qty: defect.qty,
          size: defect.size ?? null,
          color: defect.color ?? null,
          printLabel: defect.printLabel ?? null,
          reason: defect.reason,
          photoUrls: defect.photoUrls ?? [],
          note: defect.note ?? null,
          disposition: defect.disposition ?? null,
        })),
        notes: params.notes ?? null,
        userId: params.userId,
      })
    )
    .digest("hex");
}

function readQcStoredOutcome(value: unknown): QcStoredOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.requestFingerprint !== "string" ||
    typeof candidate.spareAvailable !== "number" ||
    typeof candidate.reworkOpened !== "boolean" ||
    typeof candidate.heldForStock !== "boolean" ||
    typeof candidate.movedToPacking !== "boolean"
  ) {
    return null;
  }
  return {
    requestFingerprint: candidate.requestFingerprint,
    spareAvailable: candidate.spareAvailable,
    reworkOpened: candidate.reworkOpened,
    heldForStock: candidate.heldForStock,
    movedToPacking: candidate.movedToPacking,
  };
}

/**
 * QC defect อาจ reopen ใบผลิตและสร้างขั้นงานแก้ จึงต้องใช้ global lock order เดียวกับ
 * production writers: step → production → order. Query แรกอ่านเฉพาะ ID สำหรับหาแถว
 * ที่ต้อง lock; ห้ามนำ snapshot นี้ไปตัดสินสถานะหรือผล QC หลัง lock
 */
async function lockQcProductionChain(tx: PrismaTx, orderId: string) {
  // QC defect สร้าง step งานแก้ จึงต้อง serialize topology ก่อน snapshot/row locks
  // เหมือน Goods Receipt และ production writers ทุกตัว
  await lockProductionTopology(tx, orderId);
  const productionRefs = await tx.production.findMany({
    where: { orderId },
    select: { id: true, steps: { select: { id: true } } },
  });
  const stepIds = [
    ...new Set(productionRefs.flatMap((production) => production.steps.map((step) => step.id))),
  ].sort();
  const productionIds = [...new Set(productionRefs.map((production) => production.id))].sort();

  for (const stepId of stepIds) {
    await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${stepId} FOR UPDATE`;
  }
  for (const productionId of productionIds) {
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${productionId} FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;

  // อ่านเจ้าของ flow หลัง lock เท่านั้น: ใบผลิต V2 ต้องบันทึก QC ผ่าน FINAL_QC
  // Operation Job เพื่อให้ revision, quantity, event และ rework อยู่ใน transaction เดียวกัน
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      productionCompletionOwnerId: true,
      productions: {
        select: {
          workOrderNumber: true,
          completionOwnerStepId: true,
        },
      },
    },
  });
}

function hasProductionV2Owner(owner: Awaited<ReturnType<typeof lockQcProductionChain>>) {
  return Boolean(owner.productionCompletionOwnerId) || owner.productions.some(
    (production) =>
      production.workOrderNumber !== null || production.completionOwnerStepId !== null,
  );
}

export async function createQcRecord(prisma: ExtendedPrismaClient, params: CreateQcRecordParams) {
  if (params.operationJobId) assertProductionV2ApiEnabled();
  const qtyDefect = assertValidQcCounts(params);
  if (params.operationJobId) {
    if (
      params.qtyGood > 0 &&
      (!params.quantityLines?.length ||
        params.quantityLines.reduce((sum, line) => sum + line.qtyGood, 0) !==
          params.qtyGood)
    ) {
      badRequest("QC V2 ต้องแจกจำนวนดีลง quantity line ให้ตรงกับยอดรวม");
    }
    if (params.defects.some((defect) => !defect.quantityLineId)) {
      badRequest("QC V2 ต้องระบุ quantity line ของของเสียทุกบรรทัด");
    }
  }
  const recordId = qcRecordIdForRequest(params.orderId, params.idempotencyKey);
  const requestFingerprint = qcRequestFingerprint(params);

  const result = await prisma.$transaction(async (tx) => {
    // สองคนตรวจพร้อมกันต้องต่อคิว และ defect path ต้องไม่กลับลำดับ lock กับ production writer
    const productionOwner = await lockQcProductionChain(tx, params.orderId);
    if (!params.operationJobId && hasProductionV2Owner(productionOwner)) {
      badRequest(
        "งานนี้ต้องบันทึกผลตรวจจากงาน Final QC ในโหมดสถานี",
      );
    }

    // retry หลัง response หลุดต้องจบตรงนี้ก่อนเช็กสถานะ/ยอดสะสม: รอบแรกอาจพางานออกจาก
    // QUALITY_CHECK ไปแล้ว แต่ผลสำเร็จเดิมยังต้องตอบซ้ำได้โดยไม่เพิ่มยอด/audit/notification
    const replay = await tx.qcRecord.findUnique({
      where: { id: recordId },
      include: { defects: true },
    });
    if (replay) {
      const audit = await tx.auditLog.findFirst({
        where: {
          action: "CREATE",
          entityType: "QC_RECORD",
          entityId: replay.id,
        },
        select: { newValue: true },
      });
      const stored = readQcStoredOutcome(audit?.newValue);
      if (!stored) {
        internal("พบผล QC เดิมแต่ไม่พบข้อมูลยืนยันคำขอ กรุณาแจ้งผู้ดูแลระบบ");
      }
      if (stored.requestFingerprint !== requestFingerprint) {
        conflict("คำขอบันทึก QC นี้ถูกใช้กับข้อมูลคนละชุดแล้ว กรุณากดบันทึกเป็นรอบใหม่");
      }
      return {
        created: replay,
        spareAvailable: stored.spareAvailable,
        reworkOpened: stored.reworkOpened,
        heldForStock: stored.heldForStock,
        movedToPacking: stored.movedToPacking,
        alreadyRecorded: true,
      };
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        internalStatus: true,
        items: {
          select: { products: { select: { variants: { select: { quantity: true } } } } },
        },
        qcRecords: { select: { qtyGood: true } },
        productions: { select: { id: true } },
      },
    });
    const operation = params.operationJobId
      ? await loadSpecializedOperation(tx, {
          operationJobId: params.operationJobId,
          expectedRevision:
            params.expectedRevision ??
            badRequest("คำสั่ง Production V2 ต้องระบุ expectedRevision"),
          actorId: params.userId,
          canSupervise: params.canSupervise === true,
          requiredWorkCenterCode: "FINAL_QC",
          orderId: params.orderId,
        })
      : null;
    if (operation && params.defects.some((defect) => !defect.disposition)) {
      badRequest("ของที่ไม่ผ่าน QC ต้องเลือก Hold, Rework หรือ Scrap ทุกบรรทัด");
    }
    if (operation) {
      const evidenceQuantityLineIds = [
        ...(params.quantityLines ?? []).map((line) => line.quantityLineId),
        ...params.defects.flatMap((defect) =>
          defect.quantityLineId ? [defect.quantityLineId] : [],
        ),
      ];
      const uniqueQuantityLineIds = [...new Set(evidenceQuantityLineIds)];
      if (uniqueQuantityLineIds.length > 0) {
        const scopedLines = await tx.operationQuantity.findMany({
          where: {
            productionStepId: operation.id,
            id: { in: uniqueQuantityLineIds },
          },
          select: {
            id: true,
            qtyPlanned: true,
            qtyGood: true,
          },
        });
        if (scopedLines.length !== uniqueQuantityLineIds.length) {
          badRequest("quantity line ของผล QC ไม่ได้อยู่ใน Operation Job นี้");
        }
        const inspectedByLine = new Map<string, number>();
        for (const line of params.quantityLines ?? []) {
          inspectedByLine.set(
            line.quantityLineId,
            (inspectedByLine.get(line.quantityLineId) ?? 0) + line.qtyGood,
          );
        }
        for (const defect of params.defects) {
          if (!defect.quantityLineId) continue;
          inspectedByLine.set(
            defect.quantityLineId,
            (inspectedByLine.get(defect.quantityLineId) ?? 0) + defect.qty,
          );
        }
        const scopedLineById = new Map(
          scopedLines.map((line) => [line.id, line]),
        );
        for (const [quantityLineId, inspectedQty] of inspectedByLine) {
          const line = scopedLineById.get(quantityLineId)!;
          const remaining = Math.max(0, line.qtyPlanned - line.qtyGood);
          if (inspectedQty > remaining) {
            badRequest(
              "จำนวนดีและของเสียที่ตรวจรวมกันเกินจำนวนคงเหลือของ quantity line",
            );
          }
        }
      }
    }
    // ตรวจนับเกิดที่ด่านตรวจเท่านั้น — ที่อื่นคือกดผิดจังหวะ (เช่น ยังผลิตไม่จบ)
    if (!operation && order.internalStatus !== "QUALITY_CHECK") {
      // เคสจริง: อีกจอเพิ่งกดเข้าแพ็คตัดหน้าระหว่างกรอกของเสีย — บอกทางแก้ตรงๆ
      // (ฟอร์มฝั่ง UI ไม่ล้างตอน error — ถอยสถานะแล้วกดบันทึกซ้ำได้เลย)
      if (order.internalStatus === "PACKING") {
        badRequest(
          "งานเพิ่งถูกกดเข้าแพ็คโดยอีกจอ — ถ้ายังมีของต้องบันทึก ถอยสถานะออเดอร์กลับ \"ตรวจคุณภาพ\" แล้วกดบันทึกซ้ำ (ข้อมูลที่กรอกไว้ยังอยู่)"
        );
      }
      badRequest("บันทึกผลตรวจได้เฉพาะงานที่อยู่ขั้นตรวจคุณภาพ");
    }

    // อ่านยอดเบิก/คืนสดหลัง order lock — issue/return ของออเดอร์เดียวกันใช้ lock นี้เช่นกัน
    // จึงไม่ตัดสิน REWORK/รอของจาก snapshot ก่อน transaction
    const pick = await getGarmentPickState(tx, params.orderId);
    const spareAvailable = spareAvailableOf(pick.lines);

    // นับครบหรือยัง — ตรวจได้หลายรอบ (รอบแรกดีบางส่วน → ตรวจต่อ · เสียกลับมาแก้แล้วตรวจซ้ำ)
    const totalExpected = order.items.reduce(
      (s, it) => s + it.products.reduce((ps, p) => ps + p.variants.reduce((vs, v) => vs + v.quantity, 0), 0),
      0
    );
    const checkedGood = order.qcRecords.reduce((s, r) => s + r.qtyGood, 0);
    if (!operation) {
      assertQcNotOverCount({ totalExpected, checkedGood, qtyGood: params.qtyGood });
    }

    const created = await tx.qcRecord.create({
      data: {
        id: recordId,
        orderId: params.orderId,
        productionStepId: operation?.id,
        qtyGood: params.qtyGood,
        qtyDefect,
        notes: params.notes,
        checkedById: params.userId,
        defects: {
          create: params.defects.map((d) => ({
            ...(operation && d.quantityLineId
              ? { operationQuantityId: d.quantityLineId }
              : {}),
            qty: d.qty,
            size: d.size,
            color: d.color,
            printLabel: d.printLabel,
            reason: d.reason,
            disposition: d.disposition,
            photoUrls: d.photoUrls ?? [],
            note: d.note,
          })),
        },
      },
      include: { defects: true },
    });

    let reworkOpened = false;
    let heldForStock = false;
    let movedToPacking = false;

    // กติกาเลือกทาง (ดียังไม่ครบ+เสีย→REWORK/รอของ · ดีครบ→PACK · ดีบางส่วน→STAY)
    // อยู่ qc-count.ts เพื่อให้เส้นบันทึกกับ manual recovery ยึดความหมายเดียวกัน
    const move = operation
      ? "STAY"
      : qcNextMove({
          qtyGood: params.qtyGood,
          qtyDefect,
          totalExpected,
          checkedGood,
          hasFromStock: pick.lines.length > 0,
          spareAvailable,
        });

    if (operation) {
      const qtyScrap = created.defects.reduce(
        (sum, defect) =>
          sum + (defect.disposition === "SCRAP" ? defect.qty : 0),
        0,
      );
      const qtyRework = created.defects.reduce(
        (sum, defect) =>
          sum + (defect.disposition === "REWORK" ? defect.qty : 0),
        0,
      );
      const hasBlockingDefect = created.defects.some(
        (defect) =>
          defect.disposition === "HOLD" || defect.disposition === "REWORK",
      );
      const eventInput = {
        operation,
        commandId: `qc-record:${recordId}`,
        actorId: params.userId,
        eventType: "QC_RECORDED" as const,
        ...(hasBlockingDefect ? { nextState: "BLOCKED" as const } : {}),
        payload: { qcRecordId: created.id, qtyDefect },
      };
      if (params.qtyGood + qtyScrap + qtyRework > 0) {
        const quantityOutputById = new Map<string, SpecializedQuantityOutput>();
        for (const line of params.quantityLines ?? []) {
          quantityOutputById.set(line.quantityLineId, {
            quantityLineId: line.quantityLineId,
            qtyGood: line.qtyGood,
            qtyScrap: 0,
            qtyRework: 0,
          });
        }
        params.defects.forEach((defect) => {
          if (defect.disposition !== "SCRAP" && defect.disposition !== "REWORK") return;
          const quantityLineId = defect.quantityLineId!;
          const current = quantityOutputById.get(quantityLineId) ?? {
            quantityLineId,
            qtyGood: 0,
            qtyScrap: 0,
            qtyRework: 0,
          };
          if (defect.disposition === "SCRAP") current.qtyScrap += defect.qty;
          if (defect.disposition === "REWORK") current.qtyRework += defect.qty;
          quantityOutputById.set(quantityLineId, current);
        });
        await recordSpecializedOperationOutput(tx, {
          ...eventInput,
          delta: { qtyGood: params.qtyGood, qtyScrap, qtyRework },
          quantityLines: [...quantityOutputById.values()],
        });
      } else {
        await recordSpecializedOperationEvent(tx, eventInput);
      }
      for (const defect of created.defects) {
        const blocksJob =
          defect.disposition === "HOLD" || defect.disposition === "REWORK";
        await tx.productionException.create({
          data: {
            productionId: operation.productionId,
            productionStepId: operation.id,
            workCenterId: operation.workCenterId,
            sourceQcDefectId: defect.id,
            code: `QC_DEFECT:${defect.id}`,
            title: `QC ไม่ผ่าน: ${qcReasonLabel(defect.reason)}`,
            description: defect.note,
            severity: blocksJob ? "CRITICAL" : "WARNING",
            blocksJob,
            disposition: defect.disposition,
            raisedById: params.userId,
          },
        });
      }
    } else if (move === "HOLD_FOR_STOCK" || move === "REWORK") {
      heldForStock = move === "HOLD_FOR_STOCK";
      const reason = `QC พบของเสีย ${qtyDefect} ตัว (${[
        ...new Set(created.defects.map((d) => qcReasonLabel(d.reason))),
      ].join("/")})${heldForStock ? " — เสื้อสำรองไม่พอ รอของ" : ""}`;
      await transitionOrder(tx, {
        orderId: params.orderId,
        to: heldForStock ? "ON_HOLD" : "PRODUCING",
        changedBy: params.userId,
        reason,
      });
      // เปิดงานแก้เฉพาะออเดอร์ที่มีใบผลิตจริง — ไม่มีใบ (เช่น งานสต๊อคล้วน) reopen เป็น
      // no-op เงียบ ห้ามไปบอกผู้ใช้ว่า "เปิดขั้นงานแก้แล้ว" ทั้งที่ไม่มีอะไรเกิด
      if (order.productions.length > 0) {
        await reopenProductionsForRework(tx, { orderId: params.orderId, reason });
        reworkOpened = true;
      }
    } else if (move === "PACK") {
      await advanceOrderForward(tx, {
        orderId: params.orderId,
        target: "PACKING",
        changedBy: params.userId,
        onlyFrom: ["QUALITY_CHECK"],
        reason: `QC ผ่านครบ ${checkedGood + params.qtyGood} ตัว — เข้าคิวแพ็ค`,
      });
      movedToPacking = true;
      // QC ผ่านครบ = "ลายพิมพ์ผ่านจริง" → เข้าคลังลายลูกค้า (ก้อน 4 ชิ้น 2)
      // อยู่ใน tx เดียวกัน — แถวออเดอร์ lock อยู่แล้ว กัน promote ชนกัน
      await promoteOrderArtworks(tx, { orderId: params.orderId });
    }

    // audit เป็นหลักฐาน durable ของผลตอบกลับสำหรับ retry และต้อง commit/rollback พร้อมผล QC
    // ห้ามย้ายออกนอก transaction เพราะ response/audit fail หลัง QC commit จะชวนให้ผู้ใช้กดนับซ้ำ
    await createAuditLog(tx, {
      userId: params.userId,
      action: "CREATE",
      entityType: "QC_RECORD",
      entityId: created.id,
      newValue: {
        orderId: params.orderId,
        operationJobId: operation?.id ?? null,
        qtyGood: params.qtyGood,
        qtyDefect,
        requestFingerprint,
        spareAvailable,
        reworkOpened,
        heldForStock,
        movedToPacking,
      },
    });

    return {
      created,
      spareAvailable,
      reworkOpened,
      heldForStock,
      movedToPacking,
      alreadyRecorded: false,
    };
  });
  const {
    created: record,
    spareAvailable,
    reworkOpened,
    heldForStock,
    movedToPacking,
    alreadyRecorded,
  } = result;

  // กระดิ่งนอก tx — แจ้งพังต้องไม่ล้มผลตรวจที่บันทึกแล้ว
  // replay key เดิมไม่ส่งซ้ำ เพราะผลสำเร็จรอบแรกทำ best-effort ไปแล้ว
  if (!alreadyRecorded && qtyDefect > 0) {
    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: params.orderId },
        select: { orderNumber: true },
      });
      const reasons = [...new Set(record.defects.map((d) => qcReasonLabel(d.reason)))].join("/");
      const statusNote = params.operationJobId
        ? "บันทึกผลและ disposition แล้ว งานที่ Hold/Rework ถูกบล็อกไว้ให้หัวหน้าจัดการ"
        : movedToPacking
          ? `ของดีครบตามยอดแล้ว · ของเสีย ${qtyDefect} ตัวเป็นของนอกยอดสั่ง/เสื้อเผื่อ จึงเข้าแพ็คต่อ`
          : heldForStock
            ? `เสื้อสำรองไม่พอ (เหลือ ${spareAvailable}/${qtyDefect} ตัว) — งานพักรอของ คุยลูกค้า/สั่งเพิ่มแล้วปลดพัก`
            : reworkOpened
              ? `งานถอยกลับผลิตพร้อมขั้นงานแก้แล้ว · เสื้อสำรองเหลือ ${spareAvailable} ตัว`
              : `งานถอยกลับผลิตแล้ว แต่ยังไม่มีใบผลิต — เปิดใบผลิตสำหรับงานแก้ที่หน้า /production`;
      const admins = await prisma.user.findMany({
        where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await createNotification(prisma, {
          userId: admin.id,
          type: "QC_DEFECT",
          title: `QC ${order.orderNumber}: ของเสีย ${qtyDefect} ตัว (${reasons})`,
          message: statusNote,
          link: `/orders/${params.orderId}`,
        });
      }
    } catch (err) {
      console.error("qc defect notification error:", err);
    }
  }

  return {
    record,
    qtyDefect,
    spareAvailable,
    reworkOpened,
    heldForStock,
    movedToPacking,
    alreadyRecorded,
  };
}
