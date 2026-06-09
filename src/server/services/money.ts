import { Prisma } from "@prisma/client";

// เครื่องมือคำนวณเงินฝั่ง server — เงินทุกเส้นทาง "คำนวณด้วย Decimal แล้วปัด 2 ตำแหน่งก่อนเขียน DB"
// (DB เก็บ Decimal(12,2) · ชั้นอ่านแปลงเป็น number ให้แล้วใน src/lib/prisma.ts result extension)

export type Money = Prisma.Decimal;

export const D = (value: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(value);

// ปัดเงิน 2 ตำแหน่งแบบ half-up (มาตรฐานเอกสารภาษี)
export const round2 = (value: Prisma.Decimal): Prisma.Decimal =>
  value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

// ค่าเงินจาก input ผู้ใช้ (zod number) — บังคับเหลือ 2 ตำแหน่งก่อนใช้คำนวณ/เขียน
export const moneyInput = (value: number): Prisma.Decimal => round2(D(value));

export const sumMoney = (values: number[]): Prisma.Decimal =>
  round2(values.reduce((acc, v) => acc.plus(v), D(0)));

// ผล aggregate (_sum/_avg) ไม่ผ่าน result extension — runtime เป็น Decimal เสมอ
// (type ระดับ TS อาจโชว์ number ตาม override ของ extension — เชื่อ runtime เป็นหลัก รับทั้งคู่)
export const aggToNumber = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : typeof value === "number" ? value : value.toNumber();
