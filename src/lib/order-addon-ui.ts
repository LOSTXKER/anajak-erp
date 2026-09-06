import { CUSTOM_ADDON_TYPE } from "@/types/order-form";

/**
 * ช่อง "ส่วนเสริม" ในฟอร์มออเดอร์เหลือช่องเดียว (เบสเคาะ 2026-09-06): ดรอปดาวน์ชื่อจากแค็ตตาล็อก
 * + ตัวเลือก "อื่นๆ (พิมพ์เอง)" — รหัสประเภท (addonType) ตามแค็ตตาล็อกไปเอง คนใช้ไม่เห็น
 * ไฟล์นี้คือกติกาว่าแถวส่วนเสริมที่บันทึกไว้ (type + name) ควรโชว์เป็นตัวเลือกไหนในดรอปดาวน์
 */
export const CUSTOM_ADDON_OPTION = "__custom__";

export interface AddonCatalogOption {
  id: string;
  type: string;
  name: string;
}

/** ค่าที่ดรอปดาวน์ต้องโชว์: id ในแค็ตตาล็อก / "อื่นๆ" เมื่อเป็นของพิมพ์เองหรือแค็ตตาล็อกเปลี่ยนไปแล้ว / "" เมื่อยังว่าง */
export function addonSelectValue(
  addon: { addonType: string; name: string },
  catalog: readonly AddonCatalogOption[],
): string {
  if (addon.addonType && addon.addonType !== CUSTOM_ADDON_TYPE) {
    const match = catalog.find((c) => c.type === addon.addonType && c.name === addon.name);
    if (match) return match.id;
  }
  if (addon.addonType || addon.name.trim()) return CUSTOM_ADDON_OPTION;
  return "";
}
