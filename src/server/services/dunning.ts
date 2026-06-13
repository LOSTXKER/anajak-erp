/**
 * ร่างข้อความทวงหนี้ (FLOW-REDESIGN ก้อน 5 — MCP tool "ลูกหนี้ + ร่างทวง")
 *
 * pure function ล้วน: รับยอดค้างรายใบของลูกค้า → คืน "ข้อความร่าง" สุภาพ ให้คน "กดส่งเอง"
 * **ไม่ส่งเอง ไม่แตะ DB ไม่ยิง LINE/SMS** — ตรงหลักเบส "นับ/เตือนให้เห็น แล้วให้คนตัดสิน"
 * (memory: bes-prefers-surface-over-autoenforce · ระบบ overdue เดิมก็แค่ตั้งสถานะ+เด้งกระดิ่งทีม
 *  ไม่เคยยิงหาลูกค้า — tool นี้คือส่วนต่อขยายที่เข้ากับสถาปัตยกรรมเดิม)
 *
 * **ห้ามใส่ข้อมูลภายในลงข้อความ**: creditLimit/exposure/segment/rfmScore/ต้นทุน/notes ภายใน
 * ใส่เฉพาะ: เลขใบ + เลขออเดอร์ + ยอดค้าง + วันครบกำหนด + จำนวนวันเกิน + ชื่อ/โทรร้านเราตอนลงท้าย
 * (memory: bes-keeps-customer-surface-minimal)
 */

export type DunningTone = "gentle" | "firm";

export interface DunningInvoiceLine {
  invoiceNumber: string;
  orderNumber: string | null;
  outstanding: number; // ยอดค้างต่อใบ (> 0)
  dueDate: Date | null;
  daysOverdue: number; // > 0 = เลยกำหนดมาแล้วกี่วัน · <= 0 = ยังไม่ครบ/ครบวันนี้
}

export interface DunningCompany {
  name: string | null;
  phone: string | null;
}

export interface DunningInput {
  customerName: string; // ชื่อผู้ติดต่อ (Customer.name)
  company: string | null; // ชื่อบริษัทลูกค้า (Customer.company) — นิติบุคคล
  invoices: DunningInvoiceLine[];
  ourCompany: DunningCompany; // ร้านเรา (CompanyProfile) สำหรับลงท้าย
  tone?: DunningTone; // default "gentle"
}

export interface DunningDraft {
  text: string;
  totalOutstanding: number;
  invoiceCount: number;
  maxDaysOverdue: number;
}

const fmtBaht = (n: number): string =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// วันที่แบบไทย (พ.ศ. อัตโนมัติจาก th-TH) อิง Asia/Bangkok — ให้ตรงกับนิยามวันทั้งระบบ
const fmtThaiDate = (d: Date | null): string => {
  if (!d) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
};

// ปัดเศษเงินรวม 2 ตำแหน่ง — number บวกกันอาจเพี้ยน floating-point
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * ร่างข้อความทวงหนี้ — คืน string พร้อมก๊อปส่ง (LINE/อีเมล) · null-safe ทุก field
 */
export function buildDunningDraft(input: DunningInput): DunningDraft {
  const tone: DunningTone = input.tone ?? "gentle";
  const lines = input.invoices.filter((inv) => inv.outstanding > 0);

  const totalOutstanding = round2(lines.reduce((s, inv) => s + inv.outstanding, 0));
  const invoiceCount = lines.length;
  const maxDaysOverdue = lines.reduce((m, inv) => Math.max(m, inv.daysOverdue), 0);

  // คำขึ้นต้น: นิติบุคคล = "เรียน {บริษัท}" · บุคคล = "เรียน คุณ{ชื่อ}"
  const greetingName = input.company?.trim()
    ? input.company.trim()
    : `คุณ${input.customerName.trim()}`;

  const intro =
    tone === "firm"
      ? "ทางร้านขอติดตามยอดค้างชำระที่เลยกำหนดแล้ว ดังรายการต่อไปนี้ค่ะ"
      : "ทางร้านขอแจ้งยอดค้างชำระเพื่อความสะดวกในการตรวจสอบ ดังรายการต่อไปนี้ค่ะ";

  const itemLines = lines.map((inv) => {
    const orderPart = inv.orderNumber ? ` (ออเดอร์ ${inv.orderNumber})` : "";
    const duePart =
      inv.daysOverdue > 0
        ? ` · ครบกำหนด ${fmtThaiDate(inv.dueDate)} (เลยกำหนด ${inv.daysOverdue} วัน)`
        : inv.dueDate
          ? ` · ครบกำหนด ${fmtThaiDate(inv.dueDate)}`
          : "";
    return `• ใบ ${inv.invoiceNumber}${orderPart} — ค้าง ${fmtBaht(inv.outstanding)} บาท${duePart}`;
  });

  const totalLine = `รวมค้างชำระ ${fmtBaht(totalOutstanding)} บาท (${invoiceCount} ใบ)`;

  const closing =
    tone === "firm"
      ? "รบกวนดำเนินการชำระภายในเร็ววัน หากชำระเรียบร้อยแล้วขออภัยในความไม่สะดวกค่ะ"
      : "หากชำระเรียบร้อยแล้วขออภัยในความไม่สะดวก และขอบคุณสำหรับความไว้วางใจค่ะ";

  // ลงท้าย: ชื่อร้าน + โทร (ข้ามบรรทัดที่ค่าว่าง — ไม่พ่นบรรทัดเปล่า)
  const signatureParts: string[] = [];
  if (input.ourCompany.name?.trim()) signatureParts.push(input.ourCompany.name.trim());
  if (input.ourCompany.phone?.trim()) signatureParts.push(`โทร ${input.ourCompany.phone.trim()}`);
  const signature = signatureParts.length > 0 ? `— ${signatureParts.join(" · ")}` : "";

  const blocks = [
    `เรียน ${greetingName}`,
    intro,
    itemLines.join("\n"),
    totalLine,
    closing,
    signature,
  ].filter((b) => b.length > 0);

  return {
    text: blocks.join("\n\n"),
    totalOutstanding,
    invoiceCount,
    maxDaysOverdue,
  };
}
