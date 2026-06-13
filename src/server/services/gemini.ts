// Gemini client (FLOW-REDESIGN ก้อน 4 — preflight DTF) — server only
//
// เรียก REST ตรง (ไม่ลง SDK — เลียน pattern HTTP ภายนอกของ stock-api) · ผลเป็น JSON โครงสร้าง
// ปิด thinking (thinkingBudget 0) — งานดูรูปง่ายๆ ไม่ต้องคิดยาว เร็วขึ้น+ถูกลง
// key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) — ห้าม import จาก client

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export interface GeminiPreflightResult {
  verdict: "GREEN" | "YELLOW" | "RED";
  hasVisibleBackground: boolean; // เห็นพื้นหลังทึบที่ควรเป็นพื้นโปร่งไหม
  lowQuality: boolean; // เบลอ/แตก/ความละเอียดต่ำ
  summary: string; // สรุปสั้นภาษาไทย
  warnings: string[]; // คำเตือนภาษาไทย (เทคนิคล้วน)
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["GREEN", "YELLOW", "RED"] },
    hasVisibleBackground: { type: "boolean" },
    lowQuality: { type: "boolean" },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "hasVisibleBackground", "lowQuality", "summary", "warnings"],
};

// เบสเคาะ 2026-06-14: ตรวจ "เทคนิคพื้นฐาน" เท่านั้น — ห้ามวิจารณ์เนื้อหา/ลวดลาย/สไตล์/
// ตัวหนังสือ/ลายน้ำ/ความเหมาะสม (ลูกค้าอาจตั้งใจออกแบบแบบนั้น) · ดูแค่ความคม + พื้นโปร่ง
const PROMPT = `คุณคือตัวช่วยตรวจ "คุณภาพทางเทคนิค" ของไฟล์ภาพสำหรับพิมพ์ DTF/DTG เท่านั้น

**ห้ามเด็ดขาด: ห้ามวิจารณ์เนื้อหา/ลวดลาย/สไตล์/ตัวหนังสือ/ลายน้ำ/ตัวการ์ตูน/ความสวยงาม/
ความเหมาะสมของภาพ** — ลูกค้าอาจตั้งใจออกแบบแบบนั้นอยู่แล้ว ไม่ใช่หน้าที่เราไปตัดสิน

ดูแค่ 2 เรื่องพื้นฐานทางเทคนิค:
1. lowQuality: true ถ้าภาพเบลอ/แตก/เป็นเหลี่ยมพิกเซล/ความละเอียดต่ำเกินไปสำหรับพิมพ์
2. hasVisibleBackground: true ถ้ามีพื้นหลังเป็นสีทึบ (ขาว/ดำ/สี) เต็มกรอบภาพ ที่งาน DTF/DTG ควรเป็นพื้นโปร่ง

ตอบ JSON:
- verdict: GREEN = คมชัดและพื้นโอเค, YELLOW = มีจุดเทคนิคควรระวัง, RED = เทคนิคไม่พร้อมพิมพ์ชัดเจน
- summary: สรุปสั้น 1 ประโยคภาษาไทย (เรื่องเทคนิคเท่านั้น)
- warnings: คำเตือน "ทางเทคนิค" สั้นๆ ภาษาไทย เฉพาะ 2 เรื่องข้างบน (ไม่มี = [] · ห้ามพูดถึงเนื้อหาภาพ)
ถ้าภาพคมชัดและพื้นไม่มีปัญหา = GREEN warnings ว่าง · อย่าเดาเกินภาพ`;

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
    summary: String(parsed.summary ?? ""),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}
