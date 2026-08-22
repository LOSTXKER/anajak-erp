import { cn } from "@/lib/utils";

/* การ์ดรายการบนมือถือ (ฝั่ง renderMobile ของ ResponsiveList)
   เดิมโครงนี้ (wrapper role=list + article.card-surface + ตาราง meta
   grid-cols-2 border-t) ถูกพิมพ์ซ้ำมือ ~9 หน้า — spacing/เส้นคั่น/role
   ขึ้นกับว่าใครก๊อปมาครบไหม (บางหน้าใช้ dl บางหน้า div เฉยๆ)
   เนื้อในการ์ด (ลิงก์ทั้งใบ/ปุ่ม/badge) ต่างกันตามหน้า — primitive คุมแค่โครง */

/** wrapper รายการการ์ด — role=list + ระยะห่างมาตรฐาน */
export function ListCards({
  label,
  className,
  children,
}: {
  /** aria-label ของรายการ เช่น "รายชื่อลูกค้า" */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="list" aria-label={label} className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

/** การ์ดหนึ่งใบ — ผิว/มุมโค้งมาตรฐาน (เนื้อในและลิงก์เป็นของหน้า) */
export function ListCardItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article role="listitem" className={cn("card-surface rounded-xl", className)}>
      {children}
    </article>
  );
}

/** ตาราง meta ท้ายการ์ด — เส้นคั่นบน + grid มาตรฐาน */
export function ListCardMetaGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-3 grid gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

/** ช่อง label+ค่า ใน MetaGrid */
export function ListCardMeta({
  label,
  align = "left",
  className,
  children,
}: {
  label: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right", className)}>
      <p className="text-muted">{label}</p>
      <div className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  );
}
