// ป้ายชนิดเอกสารบิล — แหล่งเดียวทั้งระบบ (เดิมนิยามซ้ำ 6 ไฟล์ ป้ายไม่ตรงกัน:
// "บิลมัดจำ" / "มัดจำ" / "ใบแจ้งหนี้ (มัดจำ)" / "ใบแจ้งหนี้มัดจำ" แล้วแต่หน้า)
// หัวเอกสารพิมพ์ทางการของใบกำกับ (title + subtitle อังกฤษ เช่น "ใบเสร็จรับเงิน /
// ใบกำกับภาษี — RECEIPT / TAX INVOICE") อยู่ print/invoice — คนละความหมาย ไม่รวมที่นี่
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  QUOTATION: "ใบเสนอราคา",
  DEPOSIT_INVOICE: "ใบแจ้งหนี้มัดจำ",
  FINAL_INVOICE: "ใบแจ้งหนี้ส่วนที่เหลือ",
  RECEIPT: "ใบเสร็จรับเงิน",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

// ป้ายฝั่งที่ลูกค้าเห็น (หน้า /status + เอกสารพิมพ์) — ตรงหัวเอกสารจริงใน print/invoice:
// FINAL_INVOICE ใช้กับใบเต็มจำนวนที่ไม่มีมัดจำด้วย — "ส่วนที่เหลือ" จะหลอกลูกค้าว่า
// เคยมีงวดมัดจำมาก่อน · ป้ายภายใน (ตารางบิล/การ์ดออเดอร์) คงแบบละเอียดไว้ให้ทีมแยกงวดออก
export const INVOICE_TYPE_LABELS_CUSTOMER: Record<string, string> = {
  ...INVOICE_TYPE_LABELS,
  DEPOSIT_INVOICE: "ใบแจ้งหนี้ (มัดจำ)",
  FINAL_INVOICE: "ใบแจ้งหนี้",
};
