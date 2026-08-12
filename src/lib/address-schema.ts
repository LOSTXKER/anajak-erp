import { z } from "zod";

// ด่านที่อยู่ฝั่ง server — ก่อนหน้านี้ไม่มีเลยสักบรรทัด (เบสสั่งเก็บ 2026-08-12)
// กติกาทั้งหมดอยู่ฝั่งจอ (hooks/use-order-shipping.ts) ซึ่งข้ามได้ด้วยการยิง API ตรง
// และ import จาก Anajak Stock / เครื่องมือภายในก็ไม่ผ่านจอเลย
//
// เจตนา: **กันข้อมูลพัง ไม่ใช่กันคนทำงาน** — ที่อยู่ไทยเขียนได้หลายแบบ ห้ามบังคับรูปแบบ
// ตัด whitespace หัวท้าย · จำกัดความยาวกันข้อความหลุดมาทั้งหน้า · ไปรษณีย์ต้อง 5 หลักจริง
// (ช่องที่ผิดรูปจะไปโผล่บนใบส่งของและใบกำกับ ซึ่งแก้ทีหลังยากกว่าตอนกรอก)

/** ช่องที่อยู่ทั่วไป (บรรทัดที่อยู่ · ตำบล · อำเภอ · จังหวัด) */
export const addressLine = (max = 200) =>
  z.string().trim().max(max, `ยาวเกิน ${max} ตัวอักษร`);

/** รหัสไปรษณีย์ไทย 5 หลัก — ว่างได้ (ลูกค้าแชทมาทีหลัง) แต่ถ้ากรอกต้องถูกรูป */
export const postalCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");

/** ช่องที่อยู่ที่ล้างค่าได้ — "" และ null แปลงเป็น null ทั้งคู่ (ฐานข้อมูลจะได้ไม่มี "" ปน) */
export const nullableAddressLine = (max = 200) =>
  addressLine(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : v === undefined ? undefined : null));

export const nullablePostalCode = z
  .union([postalCode, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : v === undefined ? undefined : null));

/** ช่องที่อยู่ที่ยังไม่รองรับการล้างค่า (input เดิมเป็น optional ล้วน — ไม่เปลี่ยนสัญญา) */
export const optionalAddressLine = (max = 200) => addressLine(max).optional();

export const optionalPostalCode = z
  .union([postalCode, z.literal("")])
  .optional();
