/**
 * จองสต๊อคฝั่ง Anajak Stock ตามออเดอร์ (FLOW-REDESIGN ก้อน 1 — เบสเคาะ 2026-06-12)
 *
 * กติกา:
 * - Stock เป็นเจ้าของตัวเลขจริง (คงเหลือ/จอง/หยิบได้) — ERP เป็นเจ้าของเหตุการณ์
 *   ยืนยันออเดอร์ → จองรายไซส์-สี (variant SKU) · ยกเลิก/ปิดงาน → ปลดจองส่วนที่เหลือ
 * - orderRef = orderNumber (คนคลังเห็นเลขออเดอร์ในแอป Stock ตรงกับใบงานจริง)
 * - การจองฝั่ง Stock เป็นแบบแทนที่ทั้งออเดอร์ (replace) — sync ซ้ำกี่ครั้งก็ได้ผลเท่าเดิม
 * - เรียก "นอก" $transaction เสมอ (HTTP ภายนอก ห้ามถือ lock DB) และห้าม throw —
 *   จองไม่สำเร็จไม่ block การเปลี่ยนสถานะ: บันทึก stockReservationError บนออเดอร์
 *   + แจ้งกระดิ่ง OWNER/MANAGER · ด่านพร้อมผลิตเป็นคนกั้นงานไม่ให้เข้าคิวช่าง
 */

import {
  getStockClientFromSettings,
  StockApiError,
  type StockApiClient,
  type ReserveLine,
} from "@/lib/stock-api";
import { createNotification } from "@/server/helpers";
import { addOrderRevision } from "@/server/services/order-status";
import type { ExtendedPrismaClient } from "@/lib/prisma";

// แจ้งปัญหาจอง/ปลดจองให้คนที่สั่งงานคลังได้: เจ้าของ + ผู้จัดการ
const NOTIFY_ROLES = ["OWNER", "MANAGER"] as const;

// ============================================================
// สร้างบรรทัดจองจากเนื้อออเดอร์ (pure — มี unit test)
// ============================================================

export interface ReservableVariant {
  size: string;
  color: string | null;
  quantity: number;
}

export interface ReservableProduct {
  itemSource: string | null;
  productId: string | null;
  description: string;
  variants: ReservableVariant[];
}

export interface MirrorVariant {
  sku: string;
  size: string;
  color: string;
}

export interface MirrorProduct {
  id: string;
  sku: string;
  name: string;
  variants: MirrorVariant[];
}

export interface BuildReserveLinesResult {
  lines: ReserveLine[];
  totalQty: number;
  // ปัญหาคุณภาพข้อมูล (เช่น หา variant ไม่เจอ) — จองต่อได้แต่ต้องโชว์ให้คนเห็น
  problems: string[];
}

// จับคู่ variant แบบเดียวกับด่านเช็คสต๊อคตอนเปิดงาน (order.create):
// size ตรงตัว · color ไม่ระบุ = จับตัวแรกที่ size ตรง
export function buildReserveLines(
  products: ReservableProduct[],
  mirror: MirrorProduct[]
): BuildReserveLinesResult {
  const mirrorById = new Map(mirror.map((p) => [p.id, p]));
  const qtyBySku = new Map<string, { qty: number; note?: string }>();
  const problems: string[] = [];

  for (const prod of products) {
    if (prod.itemSource !== "FROM_STOCK" || !prod.productId) continue;
    const db = mirrorById.get(prod.productId);
    if (!db) {
      problems.push(`ไม่พบสินค้า "${prod.description}" ในข้อมูล sync จาก Stock`);
      continue;
    }
    for (const v of prod.variants) {
      if (v.quantity <= 0) continue;
      const pv = db.variants.find(
        (mv) => mv.size === v.size && (!v.color || mv.color === v.color)
      );
      let sku = pv?.sku;
      let note: string | undefined;
      if (!sku) {
        // variant ไม่ตรง — จองระดับสินค้าไว้ก่อน (ดีกว่าไม่จองเลย) + จดปัญหาให้คนตามแก้
        sku = db.sku;
        note = `ไม่พบ variant ${v.size}${v.color ? `/${v.color}` : ""} — จองระดับสินค้า`;
        problems.push(`${db.name}: ไม่พบ variant ไซส์ ${v.size}${v.color ? ` สี ${v.color}` : ""}`);
      }
      const entry = qtyBySku.get(sku) ?? { qty: 0 };
      entry.qty += v.quantity;
      if (note) entry.note = note;
      qtyBySku.set(sku, entry);
    }
  }

  const lines: ReserveLine[] = [...qtyBySku.entries()].map(([sku, e]) => ({
    sku,
    qty: e.qty,
    ...(e.note ? { note: e.note } : {}),
  }));
  return {
    lines,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    problems,
  };
}

// ============================================================
// sync / release
// ============================================================

export type ReservationOutcome =
  | { status: "reserved"; lineCount: number; totalQty: number }
  | { status: "released" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

async function notifyReservationProblem(
  prisma: ExtendedPrismaClient,
  order: { id: string; orderNumber: string },
  title: string,
  message: string
) {
  const staff = await prisma.user.findMany({
    where: { role: { in: [...NOTIFY_ROLES] }, isActive: true },
    select: { id: true },
  });
  for (const user of staff) {
    await createNotification(prisma, {
      userId: user.id,
      type: "SYSTEM",
      title,
      message,
      link: `/orders/${order.id}`,
      entityType: "ORDER",
      entityId: order.id,
    });
  }
}

async function resolveClient(
  clientOverride: StockApiClient | null | undefined
): Promise<StockApiClient | null> {
  return clientOverride !== undefined ? clientOverride : getStockClientFromSettings();
}

/**
 * จอง/จองใหม่ตามเนื้อออเดอร์ปัจจุบัน (แทนที่ยอดจองเดิมทั้งออเดอร์) — เรียกหลังยืนยันออเดอร์
 * และหลังแก้รายการช่วงที่ยังไม่เริ่มผลิต · ออเดอร์ไม่มีของจากสต๊อคแล้ว = ปลดจองเดิมอัตโนมัติ
 */
export async function syncOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string },
  clientOverride?: StockApiClient | null
): Promise<ReservationOutcome> {
  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        stockReservedAt: true,
        items: {
          select: {
            products: {
              select: {
                itemSource: true,
                productId: true,
                description: true,
                variants: { select: { size: true, color: true, quantity: true } },
              },
            },
          },
        },
      },
    });

    const products = order.items.flatMap((it) => it.products);
    const fromStock = products.filter((p) => p.itemSource === "FROM_STOCK" && p.productId);

    // ไม่มีของจากสต๊อค: เคยจองไว้ → ปลดทิ้ง (รายการถูกแก้ออก) · ไม่เคย → ไม่ต้องทำอะไร
    if (fromStock.length === 0) {
      if (!order.stockReservedAt) return { status: "skipped", reason: "ไม่มีรายการจากสต๊อค" };
      return releaseOrderStockReservation(
        prisma,
        { orderId: params.orderId, changedBy: params.changedBy, reason: "รายการจากสต๊อคถูกแก้ออก" },
        clientOverride
      );
    }

    const client = await resolveClient(clientOverride);
    if (!client) {
      // มีของจากสต๊อคแต่ยังไม่ได้ต่อท่อ — จดบนออเดอร์ให้เห็น (ไม่แจ้งกระดิ่ง กัน spam ช่วงยังไม่ตั้งค่า)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stockReservationError:
            "ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ยังไม่ได้จองของ (ตั้งค่าที่ Settings → Stock)",
        },
      });
      return { status: "skipped", reason: "ยังไม่ได้ตั้งค่า Stock API" };
    }

    const mirror = await prisma.product.findMany({
      where: { id: { in: [...new Set(fromStock.map((p) => p.productId!))] } },
      select: {
        id: true,
        sku: true,
        name: true,
        variants: { select: { sku: true, size: true, color: true } },
      },
    });

    const built = buildReserveLines(fromStock, mirror);
    if (built.lines.length === 0) {
      const message = `จองสต๊อคไม่ได้ — ${built.problems.join(" · ") || "ไม่มีบรรทัดที่จองได้"}`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      return { status: "error", message };
    }

    try {
      await client.reserveForOrder({ orderRef: order.orderNumber, lines: built.lines });
    } catch (err) {
      const message =
        err instanceof StockApiError
          ? err.message
          : `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      await addOrderRevision(prisma, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `จองสต๊อคไม่สำเร็จ: ${message}`,
      });
      await notifyReservationProblem(
        prisma,
        order,
        `จองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
        message
      );
      return { status: "error", message };
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { stockReservedAt: new Date(), stockReservationError: null },
    });
    const problemSuffix = built.problems.length > 0 ? ` · หมายเหตุ: ${built.problems.join(" · ")}` : "";
    await addOrderRevision(prisma, {
      orderId: order.id,
      changedBy: params.changedBy,
      changeType: "STOCK",
      description: `จองสต๊อค ${built.lines.length} รายการ (${built.totalQty} ชิ้น)${problemSuffix}`,
    });
    return { status: "reserved", lineCount: built.lines.length, totalQty: built.totalQty };
  } catch (err) {
    // ห้าม throw — สถานะออเดอร์เปลี่ยนสำเร็จไปแล้ว อย่าทำให้ mutation ที่ commit แล้วล้ม
    console.error("syncOrderStockReservation error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/** ปลดจองทั้งออเดอร์ (ยกเลิก/ปิดงาน/รายการจากสต๊อคถูกแก้ออก) — ของที่เบิกไปแล้วไม่ได้รับผลกระทบ */
export async function releaseOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string; reason: string },
  clientOverride?: StockApiClient | null
): Promise<ReservationOutcome> {
  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        stockReservedAt: true,
        stockReservationError: true,
      },
    });

    // ไม่เคยจอง + ไม่มี error ค้าง = ไม่มีอะไรต้องปลด
    if (!order.stockReservedAt && !order.stockReservationError) {
      return { status: "skipped", reason: "ไม่มียอดจอง" };
    }

    const client = await resolveClient(clientOverride);
    if (!client) {
      if (order.stockReservedAt) {
        // เคยจองจริงแต่ตอนนี้ต่อท่อไม่ได้ — ยอดจองค้างฝั่ง Stock จะขวางงานอื่น ต้องมีคนตามแก้
        const message = "ปลดจองไม่ได้ — ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock (ยอดจองค้างอยู่ฝั่ง Stock)";
        await prisma.order.update({
          where: { id: order.id },
          data: { stockReservationError: message },
        });
        return { status: "error", message };
      }
      // มีแต่ error ค้าง (ไม่เคยจองสำเร็จ) — ล้างทิ้งได้เลย
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: null },
      });
      return { status: "released" };
    }

    try {
      await client.releaseReservations(order.orderNumber);
    } catch (err) {
      const message = `ปลดจองไม่สำเร็จ: ${err instanceof Error ? err.message : "unknown"} — ยอดจองค้างอยู่ฝั่ง Stock`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      await notifyReservationProblem(
        prisma,
        order,
        `ปลดจองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
        `${message} (${params.reason})`
      );
      return { status: "error", message };
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { stockReservedAt: null, stockReservationError: null },
    });
    if (order.stockReservedAt) {
      await addOrderRevision(prisma, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `ปลดจองสต๊อค — ${params.reason}`,
      });
    }
    return { status: "released" };
  } catch (err) {
    console.error("releaseOrderStockReservation error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
}
