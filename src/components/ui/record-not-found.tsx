import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { EmptyState } from "./empty-state";

/* ============================================================
   "เปิดมาแล้วไม่มีของนี้" — ของกลาง (เบสสั่ง 2026-08-01 หลังไล่ดูทุกหน้า)

   หน้ารายละเอียด 5 หน้า (ลูกค้า · สินค้า · งานผลิต · ใบเสนอราคา · ออเดอร์)
   เขียน `if (!x) return null` เหมือนกันหมด → เปิดลิงก์ของที่ถูกลบไปแล้ว
   หรือลิงก์เก่าที่ id เปลี่ยน = **จอว่างเปล่าสนิท** ไม่มีอะไรบอกว่าเกิดอะไรขึ้น
   และไม่มีทางกลับนอกจากกดเมนูซ้าย (เจอตอนลองเปิดด้วย id ที่ไม่มีจริง)
   ============================================================ */
export function RecordNotFound({
  what,
  backHref,
  backLabel,
}: {
  /** ชื่อของที่หาไม่เจอ เช่น "ลูกค้ารายนี้" — ขึ้นต่อจากคำว่า "ไม่พบ" */
  what: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title={`ไม่พบ${what}`}
        description="อาจถูกลบไปแล้ว หรือลิงก์ที่เปิดมาไม่ถูกต้อง"
        action={
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        }
      />
    </Card>
  );
}
