import { ShieldX } from "lucide-react";
import { Card, CardContent } from "./card";
import { EmptyState } from "./empty-state";

/* หน้าจอ "ไม่มีสิทธิ์" — หน้าตาเดียวทั้งระบบ
   เดิมมี 4 สูตรปนกัน: <p> เทาเปล่า ~10 หน้า · Card+EmptyState 5 หน้า ·
   settings/audit เอา QueryError (ของสำหรับ "โหลดพัง") มาโชว์เรื่องสิทธิ์จนดูเหมือน
   ระบบล่ม · quotations/new ประกอบเองทั้ง branch — ผู้ใช้ตีความต่างกันแล้วแต่หน้า */
export function AccessDenied({
  title = "ไม่มีสิทธิ์เข้าหน้านี้",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={ShieldX}
          title={title}
          description={
            description ??
            "หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์เท่านั้น — ผู้ดูแลปรับสิทธิ์ได้ที่ ตั้งค่า → ผู้ใช้"
          }
        />
      </CardContent>
    </Card>
  );
}
