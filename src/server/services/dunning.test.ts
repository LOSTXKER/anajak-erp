import { describe, it, expect } from "vitest";
import { buildDunningDraft } from "./dunning";

describe("buildDunningDraft", () => {
  const ourCompany = { name: "Anajak Print", phone: "081-234-5678" };

  it("รวมยอดถูก + นับใบ + วันเกินสูงสุด + โทน firm", () => {
    const d = buildDunningDraft({
      customerName: "สมชาย",
      company: "บริษัท เอ จำกัด",
      ourCompany,
      tone: "firm",
      invoices: [
        { invoiceNumber: "INV-001", orderNumber: "ORD-001", outstanding: 1000, dueDate: new Date("2026-05-01"), daysOverdue: 44 },
        { invoiceNumber: "INV-002", orderNumber: "ORD-002", outstanding: 500.5, dueDate: new Date("2026-06-01"), daysOverdue: 13 },
      ],
    });
    expect(d.totalOutstanding).toBe(1500.5);
    expect(d.invoiceCount).toBe(2);
    expect(d.maxDaysOverdue).toBe(44);
    expect(d.text).toContain("เรียน บริษัท เอ จำกัด");
    expect(d.text).toContain("INV-001");
    expect(d.text).toContain("(ออเดอร์ ORD-001)");
    expect(d.text).toContain("เลยกำหนด 44 วัน");
    expect(d.text).toContain("รวมค้างชำระ 1,500.50 บาท (2 ใบ)");
    expect(d.text).toContain("Anajak Print");
    expect(d.text).toContain("โทร 081-234-5678");
  });

  it("ไม่มี company → ใช้ชื่อผู้ติดต่อ 'คุณ{name}'", () => {
    const d = buildDunningDraft({
      customerName: "สมหญิง",
      company: null,
      ourCompany,
      invoices: [{ invoiceNumber: "INV-9", orderNumber: null, outstanding: 200, dueDate: null, daysOverdue: 0 }],
    });
    expect(d.text).toContain("เรียน คุณสมหญิง");
    expect(d.text).not.toContain("(ออเดอร์"); // orderNumber null → ไม่มีวงเล็บออเดอร์
  });

  it("ยังไม่เกินกำหนด (daysOverdue<=0) → ไม่ขึ้น 'เลยกำหนด' + โทน gentle default", () => {
    const d = buildDunningDraft({
      customerName: "ก",
      company: null,
      ourCompany,
      invoices: [{ invoiceNumber: "INV-1", orderNumber: null, outstanding: 100, dueDate: new Date("2026-07-01"), daysOverdue: 0 }],
    });
    expect(d.text).not.toContain("เลยกำหนด");
    expect(d.text).toContain("เพื่อความสะดวกในการตรวจสอบ"); // gentle intro
    expect(d.maxDaysOverdue).toBe(0);
  });

  it("ร้านเราไม่มีชื่อ/เบอร์ → ไม่มี signature ต่อท้าย (จบที่ประโยคปิด)", () => {
    const d = buildDunningDraft({
      customerName: "ข",
      company: null,
      ourCompany: { name: null, phone: null },
      invoices: [{ invoiceNumber: "INV-1", orderNumber: null, outstanding: 100, dueDate: null, daysOverdue: 0 }],
    });
    expect(d.text).not.toContain("โทร"); // ไม่มีเบอร์ร้าน
    expect(d.text.trim().endsWith("ค่ะ")).toBe(true); // จบที่ประโยคปิด ไม่มี signature ตามท้าย
    expect(d.text).not.toMatch(/\n\n\n/); // signature ว่างถูกกรองออก ไม่มีบรรทัดเปล่าซ้อน
  });

  it("กรอง outstanding <= 0 ออก ไม่นับ/ไม่โผล่ในข้อความ", () => {
    const d = buildDunningDraft({
      customerName: "ค",
      company: null,
      ourCompany,
      invoices: [
        { invoiceNumber: "INV-1", orderNumber: null, outstanding: 0, dueDate: null, daysOverdue: 0 },
        { invoiceNumber: "INV-2", orderNumber: null, outstanding: 300, dueDate: null, daysOverdue: 2 },
      ],
    });
    expect(d.invoiceCount).toBe(1);
    expect(d.totalOutstanding).toBe(300);
    expect(d.text).not.toContain("INV-1");
    expect(d.text).toContain("INV-2");
  });

  it("ไม่รั่วคำที่เป็นข้อมูลภายใน", () => {
    const d = buildDunningDraft({
      customerName: "ง",
      company: "X",
      ourCompany,
      invoices: [{ invoiceNumber: "INV-1", orderNumber: "O-1", outstanding: 100, dueDate: null, daysOverdue: 1 }],
    });
    for (const banned of ["ต้นทุน", "วงเงิน", "กำไร", "creditLimit", "exposure", "margin", "cost"]) {
      expect(d.text).not.toContain(banned);
    }
  });
});
