import type { PrismaTx } from "@/lib/prisma";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";

/* สำเนาคู่สัญญา ณ วันออกเอกสาร (เบสสั่ง 2026-08-12)
 *
 * ปัญหาที่ปิดด้วยไฟล์นี้: ใบเสนอราคา/ใบแจ้งหนี้+ใบกำกับ/ใบวางบิล เก็บแค่ `customerId`
 * แล้วหน้าพิมพ์ join สดทุกครั้งที่กดพิมพ์ · ข้อมูลผู้ซื้อ (ชื่อ/บริษัท/เลขภาษี/สาขา/
 * ที่อยู่) และหัวกระดาษฝั่งเรา (Setting.company_profile แถวเดียวทั้งระบบ) แก้ทับได้
 * ตลอดเวลา → พิมพ์ใบเก่าซ้ำได้ข้อมูลปัจจุบัน ไม่ตรงต้นฉบับที่ลูกค้าถือและที่ยื่น
 * สรรพากรไปแล้ว · ใบกำกับภาษีเต็มรูปบังคับให้สำเนาตรงต้นฉบับ (ม.86/4)
 *
 * ใช้ที่จุดสร้างเอกสารทั้ง 3 จุด (billing.create · quotation.create · billingNote.create)
 * — อ่านใน $transaction เดียวกับการสร้าง เพื่อให้ได้ค่าล่าสุดและล้มพร้อมกันถ้ามีปัญหา
 *
 * ⚠️ ค่าที่ได้เป็น "ของตาย" — ห้ามเขียนโค้ดอัปเดตให้ตาม Customer/Setting ภายหลัง
 * (ยกเว้นใบเสนอราคาที่ยังเป็นร่าง ดู refreshQuotationParty ที่ quotation router)
 */

/** ช่อง snapshot ที่ทั้ง 3 ตารางมีเหมือนกันเป๊ะ */
export interface DocumentPartySnapshot {
  buyerName: string | null;
  buyerCompany: string | null;
  buyerTaxId: string | null;
  buyerBranchNumber: string | null;
  buyerPhone: string | null;
  buyerAddress: string | null;
  buyerSubDistrict: string | null;
  buyerDistrict: string | null;
  buyerProvince: string | null;
  buyerPostalCode: string | null;
  sellerName: string | null;
  sellerAddress: string | null;
  sellerTaxId: string | null;
  sellerBranch: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
}

const orNull = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** อ่านคู่สัญญา ณ ตอนนี้จากฐานข้อมูล แล้วคืนชุดค่าพร้อมเขียนลงเอกสาร
 *  ที่อยู่ผู้ซื้อ = ที่อยู่ออกใบกำกับ · ไม่มีก็ถอยไปที่อยู่ผู้ติดต่อ (กติกาเดียวกับ
 *  หน้าพิมพ์เดิมและด่านเตือนใน lib/customer-gaps.ts — ตัดสินใจ ณ ตอนออกใบครั้งเดียว) */
export async function buildDocumentPartySnapshot(
  tx: PrismaTx,
  customerId: string,
): Promise<DocumentPartySnapshot> {
  const [customer, setting] = await Promise.all([
    tx.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: {
        name: true,
        company: true,
        taxId: true,
        branchNumber: true,
        phone: true,
        address: true,
        billingAddress: true,
        billingSubDistrict: true,
        billingDistrict: true,
        billingProvince: true,
        billingPostalCode: true,
      },
    }),
    tx.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } }),
  ]);

  const seller = parseCompanyProfile(setting?.value);

  // มีที่อยู่ออกใบกำกับ (ช่องไหนก็ได้) = ใช้ชุดนั้นทั้งชุด · ไม่มีเลยจึงถอยไปที่อยู่ผู้ติดต่อ
  // ห้ามผสมสองชุด — ที่อยู่ครึ่งบิลครึ่งผู้ติดต่อคือที่อยู่ที่ไม่มีอยู่จริง
  const hasBilling = Boolean(
    orNull(customer.billingAddress) ||
      orNull(customer.billingSubDistrict) ||
      orNull(customer.billingDistrict) ||
      orNull(customer.billingProvince) ||
      orNull(customer.billingPostalCode),
  );

  return {
    buyerName: orNull(customer.name),
    buyerCompany: orNull(customer.company),
    buyerTaxId: orNull(customer.taxId),
    buyerBranchNumber: orNull(customer.branchNumber),
    buyerPhone: orNull(customer.phone),
    buyerAddress: hasBilling ? orNull(customer.billingAddress) : orNull(customer.address),
    buyerSubDistrict: hasBilling ? orNull(customer.billingSubDistrict) : null,
    buyerDistrict: hasBilling ? orNull(customer.billingDistrict) : null,
    buyerProvince: hasBilling ? orNull(customer.billingProvince) : null,
    buyerPostalCode: hasBilling ? orNull(customer.billingPostalCode) : null,
    sellerName: orNull(seller.name),
    sellerAddress: orNull(seller.address),
    sellerTaxId: orNull(seller.taxId),
    sellerBranch: orNull(seller.branch),
    sellerPhone: orNull(seller.phone),
    sellerEmail: orNull(seller.email),
  };
}
