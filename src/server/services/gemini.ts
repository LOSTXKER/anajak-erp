// Gemini client (FLOW-REDESIGN ก้อน 4 — preflight DTF) — server only
//
// เรียก REST ตรง (ไม่ลง SDK — เลียน pattern HTTP ภายนอกของ stock-api) · ผลเป็น JSON โครงสร้าง
// ปิด thinking (thinkingBudget 0) — งานดูรูปง่ายๆ ไม่ต้องคิดยาว เร็วขึ้น+ถูกลง
// key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) — ห้าม import จาก client

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

export interface GeminiPreflightResult {
  verdict: "GREEN" | "YELLOW" | "RED";
  hasVisibleBackground: boolean; // เห็นพื้นหลังทึบที่ควรเป็นพื้นโปร่งไหม
  lowQuality: boolean; // เบลอ/แตก/ความละเอียดต่ำ
  textTooSmall: boolean; // ตัวอักษรเล็กเสี่ยงหายตอนพิมพ์
  summary: string; // สรุปสั้นภาษาไทย
  warnings: string[]; // คำเตือนภาษาไทย
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["GREEN", "YELLOW", "RED"] },
    hasVisibleBackground: { type: "boolean" },
    lowQuality: { type: "boolean" },
    textTooSmall: { type: "boolean" },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "hasVisibleBackground", "lowQuality", "textTooSmall", "summary", "warnings"],
};

const PROMPT = `คุณคือผู้ตรวจไฟล์งานพิมพ์ DTF/DTG ของโรงงานสกรีนเสื้อ Anajak
ดูรูป/ไฟล์นี้แล้วประเมินความพร้อมสำหรับนำไปพิมพ์ลงเสื้อ ตอบเป็น JSON ภาษาไทยตาม schema:
- verdict: GREEN = พร้อมพิมพ์, YELLOW = พิมพ์ได้แต่มีข้อควรระวัง, RED = ไม่ควรพิมพ์ตามนี้
- hasVisibleBackground: true ถ้าเห็นพื้นหลังเป็นสีทึบ (ขาว/ดำ/สี) ที่งาน DTF/DTG ควรเป็นพื้นโปร่ง
- lowQuality: true ถ้าภาพเบลอ แตก เป็นเหลี่ยมพิกเซล หรือความละเอียดดูต่ำ
- textTooSmall: true ถ้ามีตัวอักษร/เส้นเล็กมากที่เสี่ยงหาย/เลอะตอนพิมพ์
- summary: สรุปสั้น 1 ประโยคภาษาไทย
- warnings: รายการคำเตือนภาษาไทยสั้นๆ (ไม่มีให้เป็น [])
ประเมินตามสิ่งที่เห็นจริง อย่าเดาเกินภาพ`;

/** ส่งรูป (base64) ให้ Gemini ประเมินความพร้อมพิมพ์ — throw ถ้าเรียกไม่สำเร็จ (caller จัดการ) */
export async function geminiPreflightImage(
  base64: string,
  mimeType: string
): Promise<GeminiPreflightResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ไม่ถูกตั้งค่า");

  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0,
    },
  };

  const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ตอบ ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini ไม่คืนผลลัพธ์");

  const parsed = JSON.parse(text) as GeminiPreflightResult;
  // กันค่าเพี้ยน — บังคับ shape ขั้นต่ำ
  return {
    verdict: parsed.verdict === "RED" || parsed.verdict === "YELLOW" ? parsed.verdict : "GREEN",
    hasVisibleBackground: !!parsed.hasVisibleBackground,
    lowQuality: !!parsed.lowQuality,
    textTooSmall: !!parsed.textTooSmall,
    summary: String(parsed.summary ?? ""),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}
