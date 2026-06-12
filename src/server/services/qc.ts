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
import { QC_DEFECT_REASONS, qcReasonLabel } from "@/lib/qc";
import {
  transitionOrder,
  advanceOrderForward,
  reopenProductionsForRework,
} from "@/server/services/order-status";
import { getGarmentPickState } from "@/server/services/garment-pick";
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
  const spareAvailable = pick.lines.reduce(
    (s, l) => s + Math.max(0, l.issued - l.returned - l.needed),
    0
  );

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
  for (const d of params.defects) {
    if (!Number.isInteger(d.qty) || d.qty <= 0) badRequest("จำนวนของเสียต้องเป็นจำนวนเต็มมากกว่า 0");
    if (!(QC_DEFECT_REASONS as readonly string[]).includes(d.reason)) {
      badRequest(`ไม่รู้จักสาเหตุของเสีย: ${d.reason}`);
    }
  }
  if (!Number.isInteger(params.qtyGood) || params.qtyGood < 0) {
    badRequest("จำนวนของดีต้องเป็นจำนวนเต็มตั้งแต่ 0");
  }
  const qtyDefect = params.defects.reduce((s, d) => s + d.qty, 0);
  if (params.qtyGood === 0 && qtyDefect === 0) badRequest("ยังไม่ได้นับอะไรเลย");

  // เสื้อสำรอง อ่านนอก tx (read-only — HTTP ไป Stock ไม่มีในเส้นนี้)
  const pick = await getGarmentPickState(prisma, params.orderId);
  const spareAvailable = pick.lines.reduce(
    (s, l) => s + Math.max(0, l.issued - l.returned - l.needed),
    0
  );

  const record = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: { id: true, orderNumber: true, internalStatus: true },
    });
    // ตรวจนับเกิดที่ด่านตรวจเท่านั้น — ที่อื่นคือกดผิดจังหวะ (เช่น ยังผลิตไม่จบ)
    if (order.internalStatus !== "QUALITY_CHECK") {
      badRequest("บันทึกผลตรวจได้เฉพาะงานที่อยู่ขั้นตรวจคุณภาพ");
    }

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

    if (qtyDefect > 0) {
      // มีของเสีย → ถอยกลับผลิต + เปิดงานแก้อัตโนมัติ (วนกลับมาตรวจรอบใหม่เมื่อแก้จบ)
      const reason = `QC พบของเสีย ${qtyDefect} ตัว (${[
        ...new Set(created.defects.map((d) => qcReasonLabel(d.reason))),
      ].join("/")})`;
      await transitionOrder(tx, {
        orderId: params.orderId,
        to: "PRODUCING",
        changedBy: params.userId,
        reason,
      });
      await reopenProductionsForRework(tx, { orderId: params.orderId, reason });
    } else if (params.qtyGood > 0) {
      // ดีล้วนครบ → เด้งเข้าแพ็คเอง (ครบ → แพ็ค ตาม flow doc)
      await advanceOrderForward(tx, {
        orderId: params.orderId,
        target: "PACKING",
        changedBy: params.userId,
        onlyFrom: ["QUALITY_CHECK"],
        reason: `QC ผ่าน ${params.qtyGood} ตัว — เข้าคิวแพ็ค`,
      });
    }

    return created;
  });

  // กระดิ่งนอก tx — แจ้งพังต้องไม่ล้มผลตรวจที่บันทึกแล้ว
  if (qtyDefect > 0) {
    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: params.orderId },
        select: { orderNumber: true },
      });
      const reasons = [...new Set(record.defects.map((d) => qcReasonLabel(d.reason)))].join("/");
      const spareNote =
        spareAvailable >= qtyDefect
          ? `เสื้อสำรองพอ (เหลือ ${spareAvailable} ตัว) — แก้ได้เลย`
          : `เสื้อสำรองไม่พอ (เหลือ ${spareAvailable}/${qtyDefect} ตัว) — เช็คของ/คุยลูกค้า`;
      const admins = await prisma.user.findMany({
        where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await createNotification(prisma, {
          userId: admin.id,
          type: "QC_DEFECT",
          title: `QC ${order.orderNumber}: ของเสีย ${qtyDefect} ตัว (${reasons})`,
          message: `งานถอยกลับผลิตพร้อมขั้นงานแก้แล้ว · ${spareNote}`,
          link: `/orders/${params.orderId}`,
        });
      }
    } catch (err) {
      console.error("qc defect notification error:", err);
    }
  }

  return { record, qtyDefect, spareAvailable };
}
