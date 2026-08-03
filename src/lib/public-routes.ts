// prefix ของหน้า public (ลิงก์ลูกค้า/ร้านนอก — route group src/app/(public))
// providers.tsx ใช้บังคับธีมสว่าง · เพิ่มหน้า public ใหม่ = เพิ่มที่นี่ที่เดียว
// (เดิม hardcode ใน providers.tsx ต้องจำมาเพิ่มเองทุกครั้ง)
export const PUBLIC_CUSTOMER_PREFIXES = [
  "/approve",
  "/upload",
  "/status",
  "/quote",
  "/job",
] as const;
