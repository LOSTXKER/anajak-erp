/* เลขหน้าที่โชว์บนแถบแบ่งหน้า (ตาราง kit ทุกหน้า): หน้าแรก · รอบหน้าปัจจุบัน · หน้าสุดท้าย · ช่องว่างเป็น "…" */
export function pagerItems(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: Math.max(1, pages) }, (_, index) => index + 1);
  const start = Math.max(2, Math.min(page - 1, pages - 3));
  const end = Math.min(pages - 1, Math.max(page + 1, 3));
  const items: (number | "gap")[] = [1];
  if (start > 2) items.push("gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}
