/**
 * กำไรขั้นต้นโดยประมาณตอนตีราคา (FLOW-REDESIGN ก้อน 2 ชิ้น 5b · doc หัวข้อ 6)
 *
 * "เข็มทิศตอนตั้งราคา" เท่านั้น — กำไรจริงทางบัญชีคิดรายเดือนนอกระบบ
 * ห้ามบันทึกผลลงออเดอร์/ห้ามต่อยอดเป็น job costing (มติ 2026-06-12)
 *
 * ต้นทุน 3 ก้อนที่ประมาณได้:
 * ① เสื้อ = costPrice ของ variant/product ที่ sync จาก Stock (ทุนซื้อจริงล่าสุด)
 *    · เสื้อลูกค้าส่งมา (CUSTOMER_PROVIDED) = 0 (ไม่ใช่ทุนเรา)
 *    · เสื้อโรงเย็บ (CUSTOM_MADE) = ตามบิลร้าน ไม่อยู่ในเรต — นับแยกบอกผู้ใช้
 * ② ฟิล์ม+หมึก+ผง = ขนาดลาย × จำนวนตัวของรายการ × เรตต่อเมตรวิ่ง
 * ③ ค่าแรง+โสหุ้ย = เหมาต่อชิ้น × จำนวนรวม
 * (ค่าจ้างร้านนอกอื่นๆ ตามบิลจริง — ไม่อยู่ในตัวประมาณนี้)
 *
 * ผู้เรียกต้อง gate role การเงิน (OWNER/MANAGER/ACCOUNTANT) — ตัวเลขทุนห้ามรั่วถึงขาย/ช่าง
 */

import { COST_RATES_KEY, parseCostRates, costRatesConfigured, estimateFilmCost, estimateLaborOverhead } from "@/lib/cost-rates";
import type { ExtendedPrismaClient } from "@/lib/prisma";

export interface MarginEstimateInput {
  /** ฐานรายได้ก่อน VAT (รายการ+ค่าธรรมเนียม−ส่วนลด) */
  revenue: number;
  items: Array<{
    products: Array<{
      productId?: string | null;
      itemSource?: string | null;
      variants: Array<{ size: string; color: string; quantity: number }>;
    }>;
    prints: Array<{ widthCm?: number | null; heightCm?: number | null }>;
  }>;
}

export interface MarginEstimate {
  configured: boolean; // เรตยังไม่ตั้ง = คำนวณไม่ได้ (UI ชวนไปตั้ง)
  garmentCost: number;
  filmCost: number;
  laborOverheadCost: number;
  totalCost: number;
  marginAmount: number;
  marginPct: number | null; // null เมื่อ revenue = 0
  totalQty: number;
  // ความไม่สมบูรณ์ — บอกตรงๆ ว่าตัวเลขขาดอะไร (ห้ามโชว์เลขมั่วเงียบๆ)
  unknownCostPieces: number; // เสื้อที่ไม่รู้ทุน (ยังไม่ sync/ไม่ผูกสินค้า)
  customMadePieces: number; // เสื้อโรงเย็บ — ทุนตามบิลร้าน ไม่รวมในตัวเลข
  printsWithoutSize: number; // ลายที่ไม่ได้กรอกขนาด — ค่าฟิล์มส่วนนี้ไม่รวม
}

export async function estimateOrderMargin(
  prisma: ExtendedPrismaClient,
  input: MarginEstimateInput
): Promise<MarginEstimate> {
  const setting = await prisma.setting.findUnique({ where: { key: COST_RATES_KEY } });
  const rates = parseCostRates(setting?.value);
  const configured = costRatesConfigured(rates);

  const productIds = [
    ...new Set(
      input.items
        .flatMap((it) => it.products.map((p) => p.productId))
        .filter((id): id is string => !!id)
    ),
  ];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      costPrice: true,
      variants: { select: { size: true, color: true, costPrice: true } },
    },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const norm = (s: string) => s.trim().toLowerCase();

  let garmentCost = 0;
  let filmCost = 0;
  let totalQty = 0;
  let unknownCostPieces = 0;
  let customMadePieces = 0;
  let printsWithoutSize = 0;

  for (const item of input.items) {
    let itemQty = 0;
    for (const line of item.products) {
      const lineQty = line.variants.reduce((s, v) => s + Math.max(0, v.quantity), 0);
      itemQty += lineQty;

      if (line.itemSource === "CUSTOMER_PROVIDED") continue; // เสื้อลูกค้า — ทุนเรา 0
      if (line.itemSource === "CUSTOM_MADE") {
        customMadePieces += lineQty; // โรงเย็บ — ตามบิลร้าน นับแยกบอกผู้ใช้
        continue;
      }
      const product = line.productId ? productById.get(line.productId) : undefined;
      if (!product) {
        unknownCostPieces += lineQty;
        continue;
      }
      for (const v of line.variants) {
        const qty = Math.max(0, v.quantity);
        if (qty === 0) continue;
        const variant = product.variants.find(
          (pv) => norm(pv.size) === norm(v.size) && norm(pv.color ?? "") === norm(v.color)
        );
        const cost = Number(variant?.costPrice ?? 0) || Number(product.costPrice ?? 0);
        if (cost > 0) garmentCost += cost * qty;
        else unknownCostPieces += qty;
      }
    }
    totalQty += itemQty;

    for (const print of item.prints) {
      const c = estimateFilmCost(
        { widthCm: print.widthCm ?? null, heightCm: print.heightCm ?? null },
        itemQty,
        rates
      );
      if (c === null) printsWithoutSize += 1;
      else filmCost += c;
    }
  }

  const laborOverheadCost = estimateLaborOverhead(totalQty, rates);
  const totalCost = garmentCost + filmCost + laborOverheadCost;
  const marginAmount = input.revenue - totalCost;
  const marginPct = input.revenue > 0 ? (marginAmount / input.revenue) * 100 : null;

  return {
    configured,
    garmentCost,
    filmCost,
    laborOverheadCost,
    totalCost,
    marginAmount,
    marginPct,
    totalQty,
    unknownCostPieces,
    customMadePieces,
    printsWithoutSize,
  };
}
