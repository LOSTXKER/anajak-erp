import { Building2, User } from "lucide-react";

import { InfoChip } from "@/components/ui/info-chip";

/* ประเภทลูกค้า — คำและป้ายชุดเดียวของทั้งเว็บ

   เดิมคำนี้ถูกเขียนมือ 6 จุดจนได้ 5 หน้าตากับ 3 สำนวน: ตารางเดสก์ท็อปเป็นข้อความเทา
   "บุคคลธรรมดา" · การ์ดจอแคบหน้าเดียวกันตัดเหลือ "บุคคล" · dropdown เป็น "[นิติบุคคล]" —
   ลูกค้ารายเดียวกันจึงอ่านเป็นคนละเรื่องเมื่อสลับหน้า · คำต้นทางยกมาจากตัวเลือกในฟอร์มลูกค้า
   (customer-form-fields) ซึ่งเป็นคำที่คนคีย์เห็นตอนเลือกเอง — ที่อื่นต้องพูดตามนั้น

   ประเภทลูกค้าไม่ใช่ "สถานะ" แต่เป็นตัวตนที่เปลี่ยนวิธีออกบิล (เลขภาษี · หัก ณ ที่จ่าย)
   เบสเคาะ 2026-09-18 ว่าต้องมีป้ายทั้งสองประเภท ไม่ใช่ขึ้นเฉพาะนิติบุคคลแบบเดิม:
   นิติบุคคล = โทนฟ้าให้สะดุดตาก่อนออกบิล · บุคคลธรรมดา = เทา เห็นว่ามีคำตอบแล้วก็พอ */
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "บุคคลธรรมดา",
  CORPORATE: "นิติบุคคล",
};

export function customerTypeLabel(type: string | null | undefined): string {
  if (!type) return "";
  return CUSTOMER_TYPE_LABELS[type] ?? type;
}

/** ป้ายประเภทลูกค้า — หน้าตา `.chip` ของชุดกลางผ่าน InfoChip (ไม่วาดเอง จะได้ไม่แตกอีก) */
export function CustomerTypeChip({
  type,
  size = "md",
  className,
}: {
  type: string | null | undefined;
  /** ใหญ่ขึ้นเมื่อยืนคู่หัวเรื่องหน้า — ที่อื่นใช้ค่าเริ่มต้น */
  size?: "md" | "lg";
  className?: string;
}) {
  const label = customerTypeLabel(type);
  if (!label) return null;
  const corporate = type === "CORPORATE";
  return (
    <InfoChip
      icon={corporate ? Building2 : User}
      tone={corporate ? "info" : "neutral"}
      size={size}
      className={className}
    >
      {/* คำว่า "นิติบุคคล" ลอยเดี่ยวในลิสต์ไม่บอกว่าเป็นค่าของอะไร — ไอคอนช่วยได้เฉพาะคนที่เห็นจอ */}
      <span className="sr-only">ประเภทลูกค้า </span>
      {label}
    </InfoChip>
  );
}
