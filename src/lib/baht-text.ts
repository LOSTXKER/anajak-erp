// แปลงจำนวนเงินเป็นตัวอักษรไทย ("หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์")
// ใช้บนเอกสารเงินทุกใบ (ใบเสนอราคา/แจ้งหนี้/เสร็จ/ใบกำกับภาษี)

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// อ่านเลขจำนวนเต็มช่วง 0..999,999 ตามหลักไวยากรณ์ไทย (เอ็ด/ยี่สิบ/ไม่อ่านศูนย์)
// hasPreceding = มีก้อนหลักล้านนำหน้า (1,000,001 → "หนึ่งล้านเอ็ด" ไม่ใช่ "หนึ่งล้านหนึ่ง")
function readBelowMillion(num: number, hasPreceding = false): string {
  if (num === 0) return "";
  let text = "";
  const str = num.toString();
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const digit = Number(str[i]);
    const position = len - i - 1; // 0 = หลักหน่วย
    if (digit === 0) continue;

    if (position === 0) {
      // หลักหน่วย: "เอ็ด" เมื่อมีหลักอื่น/ก้อนล้านนำหน้า (11→สิบเอ็ด, 101→หนึ่งร้อยเอ็ด)
      text += digit === 1 && (len > 1 || hasPreceding) ? "เอ็ด" : DIGITS[digit];
    } else if (position === 1) {
      // หลักสิบ: 1x→"สิบ", 2x→"ยี่สิบ"
      if (digit === 1) text += "สิบ";
      else if (digit === 2) text += "ยี่สิบ";
      else text += DIGITS[digit] + "สิบ";
    } else {
      text += DIGITS[digit] + POSITIONS[position];
    }
  }
  return text;
}

// อ่านจำนวนเต็มทุกขนาด — แบ่งเป็นก้อนละ 6 หลักคั่นด้วย "ล้าน" (1,000,000² = ล้านล้าน)
// ใช้ number ได้ปลอดภัย: เงินในระบบสูงสุด Decimal(12,2) = 10^12 สตางค์ ต่ำกว่า 2^53 มาก
function readInteger(num: number): string {
  if (num === 0) return DIGITS[0];
  const chunks: number[] = [];
  let rest = num;
  while (rest > 0) {
    chunks.unshift(rest % 1_000_000);
    rest = Math.floor(rest / 1_000_000);
  }
  let text = "";
  for (let i = 0; i < chunks.length; i++) {
    text += readBelowMillion(chunks[i], i > 0);
    if (i < chunks.length - 1) text += "ล้าน";
  }
  return text;
}

export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return "";

  const negative = amount < 0;
  // ปัด 2 ตำแหน่งด้วยเลขจำนวนเต็มสตางค์ กัน float เพี้ยน (เงินใน DB เป็น 2 ตำแหน่งอยู่แล้ว)
  const totalSatang = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;

  let text = readInteger(baht) + "บาท";
  if (satang === 0) {
    text += "ถ้วน";
  } else {
    text += readBelowMillion(satang) + "สตางค์";
  }
  return (negative ? "ลบ" : "") + text;
}
