// Gemini client (FLOW-REDESIGN ก้อน 4 — preflight DTF) — server only
//
// เรียก REST ตรง (ไม่ลง SDK — เลียน pattern HTTP ภายนอกของ stock-api) · ผลเป็น JSON โครงสร้าง
// ปิด thinking (thinkingBudget 0) — งานดูรูปง่ายๆ ไม่ต้องคิดยาว เร็วขึ้น+ถูกลง
// key อยู่ฝั่ง server เท่านั้น (GEMINI_API_KEY) — ห้าม import จาก client

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export interface GeminiPreflightResult {
  verdict: "GREEN" | "YELLOW" | "RED";
  lowQuality: boolean; // เบลอ/แตก/ความละเอียดต่ำ
  summary: string; // สรุปสั้นภาษาไทย
  warnings: string[]; // คำเตือนภาษาไทย (ความคม/ความละเอียดเท่านั้น)
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["GREEN", "YELLOW", "RED"] },
    lowQuality: { type: "boolean" },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "lowQuality", "summary", "warnings"],
};

// เบสเคาะ 2026-06-14: AI ดูแค่ "ความคม/ความละเอียด" เรื่องเดียว
// - ห้ามวิจารณ์เนื้อหา/ลวดลาย/ลายน้ำ/ตัวหนังสือ/สี (ลูกค้าอาจตั้งใจ)
// - **ห้ามตัดสินพื้นโปร่ง/พื้นหลัง** — AI แยกพื้นโปร่งกับสีขาวไม่ออก (เห็นแค่พิกเซล render เดาผิด
//   เช่น รูปโปร่งจริงแต่ AI บอกพื้นขาว) → เรื่องพื้นโปร่งให้โค้ดอ่าน alpha จัดการใน preflight-rules.ts
const PROMPT = `คุณคือตัวช่วยตรวจ "ความคมชัด/ความละเอียด" ของไฟล์ภาพสำหรับพิมพ์ลงเสื้อ DTF/DTG เท่านั้น

ดูแค่เรื่องเดียว: ภาพ "เบลอ / แตก / เป็นเหลี่ยมพิกเซล / ความละเอียดต่ำเกินไป" สำหรับนำไปพิมพ์ไหม

**ห้ามเด็ดขาด — ห้ามพูดถึง/ตัดสินเรื่องเหล่านี้:**
- พื้นหลัง / พื้นโปร่ง / ต้องตัดพื้นออก (ระบบอื่นเช็คให้แล้ว · ลูกค้าอาจตั้งใจมีพื้น)
- เนื้อหา / ลวดลาย / สไตล์ / สี / ตัวการ์ตูน / ตัวหนังสือ / ลายน้ำ / ความสวยงาม / ความเหมาะสม

ตอบ JSON:
- lowQuality: true ถ้าภาพเบลอ/แตก/ความละเอียดต่ำเท่านั้น
- verdict: GREEN = คมชัดพอพิมพ์ได้, YELLOW = ความคมพอใช้แต่ควรระวัง, RED = เบลอ/ละเอียดต่ำชัดเจนไม่ควรพิมพ์
- summary: สรุปสั้น 1 ประโยคภาษาไทย (เรื่องความคมชัดเท่านั้น)
- warnings: คำเตือนสั้นๆ ภาษาไทย "เฉพาะเรื่องความคม/ความละเอียด" (ไม่มี = [])
ถ้าภาพคมชัดพอ = GREEN warnings ว่าง · อย่าเดาเกินภาพ`;

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
    lowQuality: !!parsed.lowQuality,
    summary: String(parsed.summary ?? ""),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}
