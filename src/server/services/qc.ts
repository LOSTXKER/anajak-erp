/**
 * QC เชิงนับ (FLOW-REDESIGN ก้อน 3) — นับของจุดที่ 2: ตรวจก่อนแพ็ค
 *
 * flow ตามแบบ (doc หัวข้อ 4): ผลิตครบ → ออเดอร์เด้ง QUALITY_CHECK เอง →
 * ตรวจ+นับ "ดีกี่ตัว เสียกี่ตัว" (ของเสียกรอก ไซส์×ลาย×สาเหตุ×รูป — เฉพาะตอนมีของเสีย)
 * → มีของเสีย: ถอยกลับผลิต + งานแก้อัตโนมัติ (reopenProductionsForRework เดิม)
 *   + เช็คเสื้อสำรอง (เบิกเผื่อไว้) ไม่พอ = กระดิ่งแอดมินคุยลูกค้า → วนกลับตรวจรอบใหม่
 * → ดีล้วนครบ: เด้งเข้าแพ็คเอง (สถานะเด้งเองตามเหตุการณ์ — pattern เดิมของระบบ)
 *
 * กติกา: ไม่มีเงินใน flow นี้ · ห้ามเพิ่มงานกรอกหน้างาน (ของดีล้วน = กดบันทึกเดียวจบ)
 */

import { badRequest } from "@/server/errors";
import { createNotification } from "@/server/helpers";
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
import type { ExtendedPrismaClient } from "@/lib/prisma";

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
  qtyGood: number;
  defects: Array<{
    qty: number;
    size?: string;
    color?: string;
    printLabel?: string;
    reason: string;
    photoUrls?: string[];
    note?: string;
  }>;
  notes?: string;
  userId: string;
}

export async function createQcRecord(prisma: ExtendedPrismaClient, params: CreateQcRecordParams) {
  const qtyDefect = assertValidQcCounts(params);

  // เสื้อสำรอง อ่านนอก tx (read-only — HTTP ไป Stock ไม่มีในเส้นนี้)
  const pick = await getGarmentPickState(prisma, params.orderId);
  const spareAvailable = spareAvailableOf(pick.lines);

  const result = await prisma.$transaction(async (tx) => {
    // lock แถวออเดอร์ — สองคนตรวจพร้อมกันต้องต่อคิว (ไม่งั้นผลฝั่งช้าทับ/สถานะแข่งกัน)
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${params.orderId} FOR UPDATE`;
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
    // ตรวจนับเกิดที่ด่านตรวจเท่านั้น — ที่อื่นคือกดผิดจังหวะ (เช่น ยังผลิตไม่จบ)
    if (order.internalStatus !== "QUALITY_CHECK") {
      // เคสจริง: อีกจอเพิ่งกดเข้าแพ็คตัดหน้าระหว่างกรอกของเสีย — บอกทางแก้ตรงๆ
      // (ฟอร์มฝั่ง UI ไม่ล้างตอน error — ถอยสถานะแล้วกดบันทึกซ้ำได้เลย)
      if (order.internalStatus === "PACKING") {
        badRequest(
          "งานเพิ่งถูกกดเข้าแพ็คโดยอีกจอ — ถ้ายังมีของต้องบันทึก ถอยสถานะออเดอร์กลับ \"ตรวจคุณภาพ\" แล้วกดบันทึกซ้ำ (ข้อมูลที่กรอกไว้ยังอยู่)"
        );
      }
      badRequest("บันทึกผลตรวจได้เฉพาะงานที่อยู่ขั้นตรวจคุณภาพ");
    }

    // นับครบหรือยัง — ตรวจได้หลายรอบ (รอบแรกดีบางส่วน → ตรวจต่อ · เสียกลับมาแก้แล้วตรวจซ้ำ)
    const totalExpected = order.items.reduce(
      (s, it) => s + it.products.reduce((ps, p) => ps + p.variants.reduce((vs, v) => vs + v.quantity, 0), 0),
      0
    );
    const checkedGood = order.qcRecords.reduce((s, r) => s + r.qtyGood, 0);
    assertQcNotOverCount({ totalExpected, checkedGood, qtyGood: params.qtyGood });

    const created = await tx.qcRecord.create({
      data: {
        orderId: params.orderId,
        qtyGood: params.qtyGood,
        qtyDefect,
        notes: params.notes,
        checkedById: params.userId,
        defects: {
          create: params.defects.map((d) => ({
            qty: d.qty,
            size: d.size,
            color: d.color,
            printLabel: d.printLabel,
            reason: d.reason,
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

    // กติกาเลือกทาง (ของเสีย→REWORK/รอของ · ดีครบ→PACK · ดีบางส่วน→STAY) อยู่ qc-count.ts
    const move = qcNextMove({
      qtyGood: params.qtyGood,
      qtyDefect,
      totalExpected,
      checkedGood,
      hasFromStock: pick.lines.length > 0,
      spareAvailable,
    });

    if (move === "HOLD_FOR_STOCK" || move === "REWORK") {
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

    return { created, reworkOpened, heldForStock, movedToPacking };
  });
  const { created: record, reworkOpened, heldForStock, movedToPacking } = result;

  // กระดิ่งนอก tx — แจ้งพังต้องไม่ล้มผลตรวจที่บันทึกแล้ว
  if (qtyDefect > 0) {
    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: params.orderId },
        select: { orderNumber: true },
      });
      const reasons = [...new Set(record.defects.map((d) => qcReasonLabel(d.reason)))].join("/");
      const statusNote = heldForStock
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

  return { record, qtyDefect, spareAvailable, reworkOpened, heldForStock, movedToPacking };
}
