// แชร์ข้อความ+ลิงก์เข้า LINE (Gate B14 — ใบงานร้านนอก LINE-friendly)
// ใช้ LINE share scheme มาตรฐาน: มือถือเปิดแอปให้เลือกห้องแชท · เดสก์ท็อปเปิด LINE เว็บ/แอป
// ไม่ต้องมี LINE API/token ใดๆ — แค่เปิด URL (กติกา build: manual ก่อน API เสมอ)

export function buildLineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** ข้อความสรุปใบงานสำหรับวางในแชท — ร้านอ่านรู้เรื่องโดยไม่ต้องกดลิงก์ก่อน */
export function buildJobShareText(params: {
  description: string;
  quantity: number;
  dueText: string | null; // วันที่ format แล้ว (ฝั่ง caller คุมโซนเวลา/รูปแบบ)
  url: string;
}): string {
  const lines = [
    `ใบงาน: ${params.description} — ${params.quantity} ชิ้น`,
    params.dueText ? `กำหนดส่งคืน: ${params.dueText}` : null,
    `รายละเอียด+ไฟล์ลาย: ${params.url}`,
  ];
  return lines.filter((l): l is string => !!l).join("\n");
}
