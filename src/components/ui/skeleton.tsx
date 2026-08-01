import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // โหมดมืดเดิมใช้ slate-800 (#2a2a2e) ซึ่งต่างจากพื้นการ์ด (#252528) แค่ 5 จาก 255
      // = แถบโครงร่างแทบมองไม่เห็น คนใช้นึกว่าจอค้าง · ขาวโปร่งสว่างกว่าพื้นเสมอ
      // ไม่ว่าวางบนการ์ด พื้นหน้า หรือกล่องลอย (audit สี 2026-08-02 · ครอบ 87 จุด)
      className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-white/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
