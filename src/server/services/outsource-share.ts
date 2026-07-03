// ใบงานร้านนอกแบบแชร์เข้า LINE (Gate B14 — เบสเคาะ: คุยกับร้านผ่าน LINE ไม่พิมพ์กระดาษ)
//
// ร้านนอกเปิดผ่าน token ไม่ต้อง login → เห็น "เฉพาะสิ่งที่ต้องใช้ทำงาน":
// งานอะไร/จำนวน/ตารางไซซ์/ลาย (รูปแบบอนุมัติ + สเปคพิมพ์ + ไฟล์แนบ)/กำหนดรับกลับ
//
// **กฎเหล็กกันรั่ว**: select เฉพาะ field ที่ร้านควรเห็น — ห้ามแตะ ค่าจ้าง (unitCost/totalCost)/
// ราคาขายทุกชนิด (unitPrice/subtotal/totalAmount)/ชื่อ-ข้อมูลลูกค้า/qcNotes/สถานะภายใน
// เด็ดขาด (หน้านี้ public — ร้านนอกไม่ควรรู้ว่าลูกค้าปลายทางคือใคร)

import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { FILE_PROXY_PREFIX, withFileToken } from "@/lib/file-urls";
import type { PrismaTx } from "@/lib/prisma";

const SHARE_TOKEN_TTL_DAYS = 90; // read-only ความเสี่ยงต่ำ — อายุเดียวกับลิงก์สถานะลูกค้า

export function newShareToken(): string {
  return randomBytes(32).toString("hex");
}

export function shareTokenExpiry(): Date {
  return new Date(Date.now() + SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// โฟลเดอร์ไฟล์แนบของใบงานนี้เอง (dialog อัปโหลดที่ pathPrefix `outsource/<jobId>` bucket designs)
// หน้าแชร์ public เสิร์ฟ "เฉพาะไฟล์ในโฟลเดอร์นี้" เท่านั้น — กันคนแนบ proxy URL ของไฟล์เงิน/
// เอกสารอื่นในบัคเก็ต (payments/, wht/, quotations/) เข้าใบ outsource แล้วให้ร้านนอกเปิด
// (review B14 จับ BLOCKER: attachment.create รับ fileUrl อิสระ + gate เฉพาะ category PRINT_FILE)
export function outsourceFilePrefix(jobId: string): string {
  return `${FILE_PROXY_PREFIX}designs/outsource/${jobId}/`;
}

// ไฟล์เป็น "ของใบงานนี้จริง" ไหม — ต้องอยู่ใต้โฟลเดอร์ใบ + ส่วนท้ายเป็นชื่อไฟล์เดี่ยว
// **สำคัญ**: normalizeFileUrl ยุบ `../` ธรรมดา แต่ไม่ยุบ encoded `..%2f`/`%5c` (skeptic B14 จับ:
// `outsource/<jobId>/..%2Fpayments%2F...` ผ่าน startsWith เฉยๆ ได้ → เลี่ยงไป path ไฟล์เงิน)
// จึงปฏิเสธ tail ที่มี separator/encoded-separator/traversal/percent ทั้งหมด (ชื่อไฟล์จริง =
// `<ts>-<rand>.<ext>` ASCII ล้วน ไม่มีอักขระพวกนี้ — ดู file-upload.tsx/safeFileExt) · ใช้ทั้ง
// write (attachment.create) และ read (getByToken/allowlist) = โครงสร้างปิด ไม่พึ่งพฤติกรรม downstream
export function isOwnOutsourceFile(jobId: string, fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false;
  const prefix = outsourceFilePrefix(jobId);
  if (!fileUrl.startsWith(prefix)) return false;
  const tail = fileUrl.slice(prefix.length);
  return tail.length > 0 && !/[/\\%]|\.\./.test(tail);
}

/** หาใบงานจาก shareToken + ตรวจหมดอายุ + คืน payload ที่ sanitize แล้ว (public-safe) */
export async function getOutsourceShareByToken(
  prisma: Pick<PrismaTx, "outsourceOrder" | "attachment">,
  token: string
) {
  const job = await prisma.outsourceOrder.findUnique({
    where: { shareToken: token },
    select: {
      // ── ปลอดภัย (ไม่มีเงิน/ลูกค้า/QC ภายใน) ──
      id: true,
      description: true,
      quantity: true,
      sentAt: true,
      expectedBackAt: true,
      notes: true,
      shareTokenExpiresAt: true,
      vendor: { select: { name: true } },
      productionStep: {
        select: {
          production: {
            select: {
              order: {
                select: {
                  orderNumber: true,
                  // ตารางไซซ์ของทั้งออเดอร์ — ใบ outsource เก็บแค่จำนวนรวม
                  // (แบ่งส่งหลายรอบได้ — จำนวนใบนี้อาจน้อยกว่าตาราง หน้า UI มีหมายเหตุกำกับ)
                  items: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                      description: true,
                      totalQuantity: true,
                      products: {
                        orderBy: { sortOrder: "asc" },
                        select: {
                          description: true,
                          variants: {
                            orderBy: { size: "asc" },
                            select: { size: true, color: true, quantity: true },
                          },
                        },
                      },
                      // สเปคพิมพ์ — ห้ามคืน unitPrice (ราคาขายต่อจุดพิมพ์)
                      prints: {
                        orderBy: { position: "asc" },
                        select: {
                          position: true,
                          printType: true,
                          printSize: true,
                          colorCount: true,
                          width: true,
                          height: true,
                          designNote: true,
                          designImageUrl: true,
                        },
                      },
                    },
                  },
                  // แบบที่ลูกค้าอนุมัติล่าสุด (เฉพาะ APPROVED — เหมือน job-ticket/ลิงก์สถานะ)
                  designs: {
                    where: { approvalStatus: "APPROVED" },
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                    select: { versionNumber: true, fileUrl: true, thumbnailUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!job) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์ใบงานนี้" });
  }
  // fail-closed: ไม่มีวันหมดอายุ = ถือว่าหมดอายุ (มาตรฐานเดียวกับลิงก์สถานะลูกค้า)
  if (!job.shareTokenExpiresAt || job.shareTokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ลิงก์ใบงานหมดอายุแล้ว กรุณาติดต่อผู้ส่งงานเพื่อขอลิงก์ใหม่",
    });
  }

  // ไฟล์ลายที่ทีมแนบบนใบ outsource — ร้านต้องโหลดไฟล์จริงไปทำงาน
  // กรองเฉพาะไฟล์ในโฟลเดอร์ของใบนี้เอง + PRINT_FILE (ไฟล์อื่นในบัคเก็ตต้องไม่หลุดสู่ public)
  // DB startsWith เป็นด่านแรก · isOwnOutsourceFile ปิด encoded-traversal ที่ startsWith เลี่ยงได้
  const attachmentRows = await prisma.attachment.findMany({
    where: {
      entityType: "OUTSOURCE_ORDER",
      entityId: job.id,
      category: "PRINT_FILE",
      fileUrl: { startsWith: outsourceFilePrefix(job.id) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileType: true,
      notes: true,
      createdAt: true,
    },
  });
  const attachments = attachmentRows.filter((a) => isOwnOutsourceFile(job.id, a.fileUrl));

  const order = job.productionStep.production.order;
  const design = order.designs[0] ?? null;

  return {
    orderNumber: order.orderNumber,
    description: job.description,
    quantity: job.quantity,
    sentAt: job.sentAt,
    expectedBackAt: job.expectedBackAt,
    notes: job.notes,
    vendorName: job.vendor.name,
    orderTotalQuantity: order.items.reduce((s, it) => s + it.totalQuantity, 0),
    items: order.items.map((it) => ({
      description: it.description,
      totalQuantity: it.totalQuantity,
      products: it.products.map((p) => ({
        description: p.description,
        variants: p.variants,
      })),
      prints: it.prints.map((pr) => ({
        position: pr.position,
        printType: pr.printType,
        printSize: pr.printSize,
        colorCount: pr.colorCount,
        width: pr.width,
        height: pr.height,
        designNote: pr.designNote,
        designImageUrl: withFileToken(pr.designImageUrl, token, "os"),
      })),
    })),
    approvedDesign: design
      ? {
          versionNumber: design.versionNumber,
          imageUrl: withFileToken(design.thumbnailUrl || design.fileUrl, token, "os"),
          fileUrl: withFileToken(design.fileUrl, token, "os"),
        }
      : null,
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: withFileToken(a.fileUrl, token, "os"),
      fileType: a.fileType,
      notes: a.notes,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * รายการ URL ไฟล์ที่ลิงก์แชร์ใบนี้เปิดได้ (ใช้ทั้ง /api/files proxy และ verify script —
 * ที่เดียวกัน กัน drift): ไฟล์แนบบนใบ + แบบอนุมัติ + รูปลายในสเปคพิมพ์ของออเดอร์นั้น
 * คืน null เมื่อ token ไม่ถูกต้อง/หมดอายุ (fail-closed)
 */
export async function allowedShareFileUrls(
  prisma: Pick<PrismaTx, "outsourceOrder" | "attachment">,
  token: string
): Promise<string[] | null> {
  const job = await prisma.outsourceOrder.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      shareTokenExpiresAt: true,
      productionStep: {
        select: {
          production: {
            select: {
              order: {
                select: {
                  // take:1 ให้ตรง getOutsourceShareByToken (หน้าโชว์แบบล่าสุดใบเดียว) —
                  // allowlist ต้องไม่กว้างกว่าที่หน้าโชว์ (skeptic B14: designs เดิมเปิดทุกเวอร์ชัน)
                  designs: {
                    where: { approvalStatus: "APPROVED" },
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                    select: { fileUrl: true, thumbnailUrl: true },
                  },
                  items: {
                    select: { prints: { select: { designImageUrl: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!job || !job.shareTokenExpiresAt || job.shareTokenExpiresAt < new Date()) {
    return null;
  }
  // ตรง select ของ getOutsourceShareByToken เป๊ะ — allowlist ต้องไม่กว้างกว่าที่หน้าโชว์
  const attachmentRows = await prisma.attachment.findMany({
    where: {
      entityType: "OUTSOURCE_ORDER",
      entityId: job.id,
      category: "PRINT_FILE",
      fileUrl: { startsWith: outsourceFilePrefix(job.id) },
    },
    select: { fileUrl: true },
  });
  const attachments = attachmentRows.filter((a) => isOwnOutsourceFile(job.id, a.fileUrl));
  const order = job.productionStep.production.order;
  return [
    ...attachments.map((a) => a.fileUrl),
    ...order.designs.flatMap((d) => [d.fileUrl, d.thumbnailUrl]),
    ...order.items.flatMap((it) => it.prints.map((p) => p.designImageUrl)),
  ].filter((u): u is string => !!u);
}
