// คลังลายต่อลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 2) — helper pure ใช้ร่วม server/UI

export const ARTWORK_POSITION_LABELS: Record<string, string> = {
  FRONT: "หน้า",
  BACK: "หลัง",
  SLEEVE_L: "แขนซ้าย",
  SLEEVE_R: "แขนขวา",
  COLLAR: "ปก",
  POCKET: "กระเป๋า",
  OTHER: "อื่นๆ",
};

export interface ArtworkNameSource {
  position?: string | null;
  printType?: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 * ตั้งชื่อลายอัตโนมัติตอน promote เข้าคลัง — คนแก้ชื่อทีหลังได้
 * รูปแบบ: "หน้า · DTF · 21×29.7 ซม." (ส่วนไหนไม่มีข้อมูลก็ละไว้)
 */
export function buildArtworkName(src: ArtworkNameSource): string {
  const parts: string[] = [];
  const pos = src.position ? ARTWORK_POSITION_LABELS[src.position] ?? src.position : null;
  if (pos) parts.push(pos);
  if (src.printType) parts.push(src.printType);
  if (src.width && src.height && src.width > 0 && src.height > 0) {
    parts.push(`${src.width}×${src.height} ซม.`);
  }
  return parts.length > 0 ? parts.join(" · ") : "ลายไม่ระบุชื่อ";
}

/** สเปกรีดของลายครบหรือยัง — ใช้โชว์ gap badge (ไม่บังคับกรอก) */
export function artworkSpecGaps(artwork: {
  widthCm?: number | null;
  heightCm?: number | null;
  heatTempC?: number | null;
  heatPressSec?: number | null;
}): string[] {
  const gaps: string[] = [];
  if (!artwork.widthCm || !artwork.heightCm) gaps.push("ขนาดลาย");
  if (!artwork.heatTempC) gaps.push("อุณหภูมิรีด");
  if (!artwork.heatPressSec) gaps.push("เวลารีด");
  return gaps;
}
