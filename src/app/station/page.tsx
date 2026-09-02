import { redirect } from "next/navigation";
import { FLOOR_HREF } from "@/lib/production-surface";

/**
 * /station — ที่อยู่เดิมของจอสถานี (09-03 เช้า) · ย้ายไปเป็นโหมดหน้างานของโมดูลผลิต `/production/floor`
 * เก็บ route ไว้ให้ bookmark บนจอทัช/ลิงก์เก่ายังใช้ได้ — พก query (?st= &s= &job= &step= &fix=) ไปด้วย
 */
export default async function StationRedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined) q.set(key, v);
  }
  const qs = q.toString();
  redirect(qs ? `${FLOOR_HREF}?${qs}` : FLOOR_HREF);
}
