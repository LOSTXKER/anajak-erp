// คลังลายต่อลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 2)
// promote ลายเข้าคลังเมื่อ "QC ผ่านครบ → PACKING" — จุดเดียวที่ครอบทุก printType
// (รวม outsource DTG/สกรีน/ปัก ~30% ที่ไม่ผ่าน PrintRun) และสเปกพิสูจน์แล้วว่าพิมพ์ผ่านจริง
// ตามนิยาม design doc "ลายทุกตัวที่เคยพิมพ์ผ่าน" · เส้นเปลี่ยนสถานะมือ QC→PACKING
// ก็ต้อง promote (order.updateStatus) — ห้ามมีทางที่ลายหายเงียบ
import type { Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTx } from "@/lib/prisma";
import { buildArtworkName } from "@/lib/artwork";

/** หา-หรือ-สร้างลายแบบกัน race — สองออเดอร์ของลูกค้าเดียวกัน promote พร้อมกันได้
 * (unique [customerId, imageUrl] กันข้อมูลซ้ำ แต่ create ฝั่งแพ้จะเด้ง P2002 —
 * ต้อง catch แล้วอ่านแถวของฝั่งชนะ ไม่งั้นล้มทั้ง tx ของ QC) */
async function findOrCreateArtwork(
  tx: PrismaTx,
  data: {
    customerId: string;
    imageUrl: string;
    name: string;
    position: string | null;
    printType: string | null;
    printSize: string | null;
    widthCm: number | null;
    heightCm: number | null;
    colorCount: number | null;
    sourceOrderId: string;
  }
): Promise<{ id: string; created: boolean }> {
  const where = {
    customerId_imageUrl: { customerId: data.customerId, imageUrl: data.imageUrl },
  };
  const existing = await tx.customerArtwork.findUnique({ where, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  try {
    const created = await tx.customerArtwork.create({
      data: { ...data, sourceOrderId: data.sourceOrderId },
      select: { id: true },
    });
    return { id: created.id, created: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      const winner = await tx.customerArtwork.findUnique({ where, select: { id: true } });
      if (winner) return { id: winner.id, created: false };
    }
    throw e;
  }
}

/**
 * เรียกใน transaction เดียวกับ QC ผ่าน (แถวออเดอร์ถูก lock FOR UPDATE แล้ว —
 * กันสองรอบตรวจของออเดอร์เดียว promote ชนกัน)
 *
 * กติกา: dedupe ด้วย imageUrl (proxy URL เสถียร — duplicate ออเดอร์แชร์ URL เดิม)
 * · ลายที่ไม่มีรูป = ระบุตัวตนไม่ได้ ข้าม (เพิ่มมือจากหน้าลูกค้าได้)
 * · ลายที่ผูกคลังแล้ว (มาจากสั่งซ้ำ) ไม่สร้างซ้ำ · idempotent — เรียกซ้ำได้
 */
export async function promoteOrderArtworks(
  tx: PrismaTx,
  params: { orderId: string }
): Promise<{ created: number; linked: number }> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: params.orderId },
    select: {
      id: true,
      customerId: true,
      items: {
        select: {
          prints: {
            select: {
              id: true,
              artworkId: true,
              designImageUrl: true,
              position: true,
              printType: true,
              printSize: true,
              width: true,
              height: true,
              colorCount: true,
            },
          },
        },
      },
    },
  });

  const prints = order.items.flatMap((it) => it.prints);
  let created = 0;
  let linked = 0;

  for (const print of prints) {
    if (print.artworkId || !print.designImageUrl) continue;

    const artwork = await findOrCreateArtwork(tx, {
      customerId: order.customerId,
      imageUrl: print.designImageUrl,
      name: buildArtworkName(print),
      position: print.position,
      printType: print.printType,
      printSize: print.printSize,
      widthCm: print.width,
      heightCm: print.height,
      colorCount: print.colorCount,
      sourceOrderId: order.id,
    });
    if (artwork.created) created++;
    await tx.orderItemPrint.update({
      where: { id: print.id },
      data: { artworkId: artwork.id },
    });
    linked++;
  }

  // ฟิล์มเผื่อของออเดอร์นี้เกิดก่อนลายเข้าคลัง (ปิดรอบพิมพ์มาก่อน QC) — ย้อนผูกให้
  // เฉพาะเคสไม่กำกวมจริง: "ทุกลาย" ของออเดอร์ resolve เป็นคลังเดียวกัน — ลายที่ยัง
  // ไม่ผูก (เช่น ไม่มีรูป) ก็เป็นลายจริงที่ฟิล์มอาจเป็นของมัน = กำกวม ปล่อย null
  const soleArtworkId = await resolveSoleOrderArtworkId(tx, order.id);
  if (soleArtworkId) {
    await tx.filmStock.updateMany({
      where: { orderId: order.id, artworkId: null },
      data: { artworkId: soleArtworkId },
    });
  }

  return { created, linked };
}

/**
 * หา artworkId ของออเดอร์แบบไม่กำกวมสำหรับผูกฟิล์ม — คืน id เฉพาะเมื่อ
 * "ทุกลาย" ของออเดอร์ผูกคลังแล้วและชี้ลายเดียวกัน · มีลายใดยังไม่ผูก
 * (ลายไม่มีรูป/ยังไม่ผ่าน QC) = กำกวม คืน null
 */
export async function resolveSoleOrderArtworkId(
  tx: PrismaTx,
  orderId: string
): Promise<string | null> {
  const prints = await tx.orderItemPrint.findMany({
    where: { orderItem: { orderId } },
    select: { artworkId: true },
  });
  if (prints.length === 0 || prints.some((p) => !p.artworkId)) return null;
  const ids = new Set(prints.map((p) => p.artworkId as string));
  return ids.size === 1 ? [...ids][0] : null;
}

/**
 * กรอง artworkId ที่ client ส่งมากับรายการลาย (echo จากฟอร์ม) — เก็บเฉพาะตัวที่
 * (1) มีจริง (2) เป็นลายของลูกค้าเจ้าของออเดอร์ (3) รูปลายตรงกับรูปบนแถว
 * (identity ของลาย = รูป — เปลี่ยน/ลบรูปแล้วลิงก์เดิมต้องหลุด ไม่งั้นลายใหม่
 * ไม่เข้าคลัง+ฟิล์ม/สถิติเกาะลายผิด) · ตัวที่ไม่ผ่านถูกตัดเงียบ (เป็น hint ไม่ใช่คำสั่ง)
 */
export async function sanitizeArtworkLinks<
  T extends { prints: { artworkId?: string | null; designImageUrl?: string | null }[] },
>(
  prisma: PrismaClient | PrismaTx | Prisma.TransactionClient,
  customerId: string,
  items: T[]
): Promise<void> {
  const ids = [
    ...new Set(
      items.flatMap((it) => it.prints.map((p) => p.artworkId)).filter((v): v is string => !!v)
    ),
  ];
  if (ids.length === 0) return;
  const valid = await prisma.customerArtwork.findMany({
    where: { id: { in: ids }, customerId },
    select: { id: true, imageUrl: true },
  });
  const imageById = new Map(valid.map((a) => [a.id, a.imageUrl]));
  for (const item of items) {
    for (const print of item.prints) {
      if (!print.artworkId) continue;
      const artworkImage = imageById.get(print.artworkId);
      if (artworkImage === undefined || artworkImage !== (print.designImageUrl ?? null)) {
        print.artworkId = undefined;
      }
    }
  }
}
