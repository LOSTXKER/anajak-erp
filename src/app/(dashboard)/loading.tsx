import { ListPageSkeleton } from "@/components/ui/page-skeleton";

/* โครงร่างระหว่างเปลี่ยนหน้าในหลังบ้าน (UI-2026 เฟส 4)

   ก่อนหน้านี้ทั้งโปรเจกต์ไม่มี loading.tsx สักไฟล์ — กดเมนูแล้วจอค้างอยู่หน้าเดิม
   200-800ms จนกว่าหน้าใหม่จะพร้อม คนเลยกดซ้ำเพราะไม่รู้ว่าระบบรับรู้แล้วหรือยัง
   เอกสารของ Next เองแนะนำ loading.js เป็นทางหลัก (useLinkStatus เป็นทางเสริม) —
   node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md */
export default function DashboardLoading() {
  return <ListPageSkeleton />;
}
