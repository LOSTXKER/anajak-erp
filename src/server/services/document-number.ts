import type { PrismaTx } from "@/lib/prisma";

// เลขเอกสารรันต่อเนื่องผ่านตาราง DocumentSequence (ห้ามสุ่ม — กฎหมายใบกำกับภาษี)
// format คงเดิม: <PREFIX>-<YYMM>-<NNNN> เลขรีเซ็ตต่อชนิดเอกสารต่อเดือน

export type DocType =
  | "ORDER"
  | "QUOTATION"
  | "DEPOSIT_INVOICE"
  | "FINAL_INVOICE"
  | "RECEIPT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "BILLING_NOTE"
  | "PRINT_RUN";

const DOC_PREFIXES: Record<DocType, string> = {
  ORDER: "ORD",
  QUOTATION: "QT",
  DEPOSIT_INVOICE: "INV-D",
  FINAL_INVOICE: "INV-F",
  RECEIPT: "REC",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
  BILLING_NOTE: "BN",
  PRINT_RUN: "FR", // รอบพิมพ์ฟิล์ม (Film Run) — เลขอ้างบนป้ายฟิล์ม/หน้าจอช่างพิมพ์
};

export function currentPeriod(date = new Date()): string {
  // อิงเวลาไทยเสมอ — deploy บน host UTC แล้วเลขเดือนต้องไม่เพี้ยนช่วงรอยต่อเดือน
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "00";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${year}${month}`;
}

// ต้องเรียก "ในธุรกรรมเดียวกับการสร้างเอกสาร" เสมอ — upsert เป็น INSERT..ON CONFLICT
// ที่ล็อกแถว sequence จนกว่า transaction จะ commit: เลขไม่ชนกันข้าม request
// และถ้าธุรกรรม rollback เลขจะถูกคืน (ไม่เกิดรูเลข)
export async function nextDocumentNumber(tx: PrismaTx, docType: DocType): Promise<string> {
  const period = currentPeriod();
  const seq = await tx.documentSequence.upsert({
    where: { docType_period: { docType, period } },
    create: { docType, period, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return `${DOC_PREFIXES[docType]}-${period}-${seq.lastNumber.toString().padStart(4, "0")}`;
}

// ตาข่ายราคาถูกสำหรับ P2002 — ข้อจำกัดสำคัญ: ถ้าชนกับ "เลขเก่าในเดือนเดียวกัน"
// retry จะได้เลขเดิมซ้ำเสมอ (rollback คืนค่า sequence ด้วย — พิสูจน์กับ DB จริงแล้ว)
// เคสนั้นต้อง seed lastNumber ของเดือนนั้นให้ >= เลขสูงสุดที่มีอยู่ (แผน: P0.3 ถ้าเก็บข้อมูลเก่า
// — ตอนนี้ DB ไม่มีเอกสารเดือนปัจจุบัน ไม่มีทางชน)
export async function withDocNumberRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const isUniqueViolation =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
