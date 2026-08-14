import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // ใช้ semantic เดียวเพื่อมองเห็นบนพื้นทุกชั้นทั้ง light/dark โดยไม่เป็นแถบขาวโปร่ง
      className={cn("animate-pulse rounded-lg bg-skeleton", className)}
      {...props}
    />
  );
}

export { Skeleton };
