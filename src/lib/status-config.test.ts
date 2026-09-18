import { describe, expect, it } from "vitest";
import {
  PAYMENT_LABEL_TO_STATUS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  STEP_STATUS_LABELS,
} from "./status-config";

/* คำและโทนที่หลายจอใช้ร่วมกัน — ล็อกไว้เพราะเป็นจุดที่เคยแตกเป็นคนละชุดมาแล้ว
   (ตารางออเดอร์เคยสะกด "บางส่วน" ส้ม ขณะหน้าการเงิน/ลิงก์ลูกค้าเขียน "ชำระบางส่วน" ฟ้า) */

describe("สถานะการชำระ — ค่าที่ server ส่ง → คำและโทนบนจอ", () => {
  it("แปลงได้ครบทุกค่าที่ order.list ส่งออกมา", () => {
    // ค่าเหล่านี้ตรงกับ paymentLabel ใน src/server/routers/order.ts
    // "none" (ยังไม่มีบิล) จงใจไม่มีในแผนที่ — PayTag ใช้ความว่างนั้นตัดสินว่าไม่ต้องขึ้นป้าย
    for (const label of ["paid", "partial", "unpaid", "overdue"] as const) {
      const key = PAYMENT_LABEL_TO_STATUS[label];
      expect(key, `ค่า "${label}" ต้องมีในแผนที่`).toBeDefined();
      expect(PAYMENT_STATUS_LABELS[key]).toBeTruthy();
      expect(PAYMENT_STATUS_VARIANTS[key]).toBeTruthy();
    }
    expect(PAYMENT_LABEL_TO_STATUS).not.toHaveProperty("none");
  });

  it("ใบที่เลยกำหนดจ่ายได้โทนแรง ไม่ปนกับใบที่แค่ยังไม่จ่าย", () => {
    // เดิมคอลัมน์นี้ไม่มีทางแยกสองเรื่องนี้ออกจากกันเลย เพราะ server ส่งแค่ unpaid
    expect(PAYMENT_STATUS_VARIANTS.OVERDUE).toBe("destructive");
    expect(PAYMENT_STATUS_VARIANTS.UNPAID).not.toBe("destructive");
    expect(PAYMENT_STATUS_LABELS.OVERDUE).not.toBe(PAYMENT_STATUS_LABELS.UNPAID);
  });
});

describe("สถานะขั้นผลิต — คำชุดเดียวของทุกจอ", () => {
  it("FAILED และ ON_HOLD ใช้คำที่เบสเคาะ และไม่ซ้ำกัน", () => {
    // ก่อนหน้านี้ FAILED ถูกเรียก 4 ชื่อ ช่างเดินจากจอทีวีมาเปิดใบผลิตแล้วอ่านคนละคำ
    expect(STEP_STATUS_LABELS.FAILED).toBe("ติดปัญหา");
    expect(STEP_STATUS_LABELS.ON_HOLD).toBe("พักไว้");
    const words = Object.values(STEP_STATUS_LABELS);
    expect(new Set(words).size, "คำสถานะขั้นต้องไม่ซ้ำกัน").toBe(words.length);
  });
});
