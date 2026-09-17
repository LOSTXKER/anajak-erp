import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader, type BreadcrumbItem, type PageBack } from "@/components/page-header";
import { c } from "@/components/kit/kit";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessDenied } from "@/components/ui/access-denied";
import { cn } from "@/lib/utils";
import type { VisualTone } from "@/lib/visual-tone";

/* ============================================================
   โครงหน้า dashboard — ที่เดียวของ header + สถานะ โหลด/พัง/ไม่มีสิทธิ์ + ระยะห่าง

   เดิมทุกหน้าประกอบเอง: 13 หน้า render PageHeader ซ้ำ 2-5 รอบ (branch ละรอบ)
   จน description หน้า billing/tax แตกเป็น 2 เวอร์ชันไม่ตรงกัน · บางหน้า branch
   error คืน QueryError เปล่าไม่มี header (จอกระโดดตอนโหลดเสร็จ) · ระยะห่างมี
   5 ค่า (space-y-4..8) ความกว้าง 4 ค่า แล้วแต่หน้าจะเดา

   หน้าเขียน header ครั้งเดียวที่ props แล้ว PageShell คุมให้ทุก state:
   ลำดับ = error → loading → denied → children
   (error/loading มาก่อน denied เพราะระหว่างเช็คสิทธิ์ยังตอบไม่ได้ว่า "ไม่มีสิทธิ์")

   ความกว้างเหลือค่าเดียวทั้งเว็บ (ต้นแบบที่เบสเคาะ 2026-09-16): ทุกหน้าใช้ผืน .page
   ของชุด kit เหมือนกันหมด รวมทั้งฟอร์มเปิดออเดอร์/ใบเสนอราคา — ต้นแบบไม่มีชั้นแคบ
   prop `width` จึงไม่มีผลแล้ว แต่ยังรับไว้ให้ caller เดิมคอมไพล์ผ่านระหว่างรอถอดออก
   (ฟอร์มยาวคุมความอ่านง่ายด้วยกริดในการ์ด ไม่ใช่การบีบทั้งหน้า)
   ============================================================ */

/** @deprecated ทุกหน้าใช้ความกว้างเดียวกันแล้ว — ค่าที่ส่งมาไม่มีผล */
type PageWidth = "full" | "wide" | "content" | "form";

interface PageShellProps {
  // ---- ส่งต่อ PageHeader ทั้งชุด (เขียนครั้งเดียว ใช้ทุก state) ----
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  titleBadge?: ReactNode;
  back?: PageBack;
  icon?: LucideIcon;
  tone?: VisualTone;
  eyebrow?: string;
  /** เนื้อหาใต้หัว (แถบ filter/summary) — โชว์เฉพาะตอนปกติ ไม่โชว์ระหว่างโหลด/พัง */
  headerChildren?: ReactNode;
  /**
   * หน้าที่เป็น workspace เฉพาะทางสามารถแทนหัวมาตรฐานได้ โดย PageShell ยังคุม
   * loading/error/denied และความกว้างให้เหมือนเดิม · caller อื่นไม่ส่งค่านี้
   * จึงยังใช้ PageHeader กลางตามปกติ
   */
  header?: ReactNode;

  // ---- สถานะของหน้า ----
  /** query หลัก/เช็คสิทธิ์ ยังไม่มา */
  loading?: boolean;
  /** แทน skeleton default ตอน loading */
  skeleton?: ReactNode;
  /** query พัง — ส่ง message + onRetry (ค่า falsy = ปกติ) */
  error?: { message: string; onRetry?: () => void } | null | false;
  /** ไม่มีสิทธิ์ — ส่ง object เพื่อใช้ข้อความเฉพาะหน้า หรือ true ใช้ข้อความกลาง */
  denied?: { title?: string; description?: string } | boolean | null;

  /** @deprecated ทุกหน้ากว้างเท่ากันตามต้นแบบแล้ว — ค่าที่ส่งมาไม่มีผล */
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  meta,
  help,
  action,
  breadcrumb,
  titleBadge,
  back,
  icon,
  tone,
  eyebrow,
  headerChildren,
  header,
  loading = false,
  skeleton,
  error,
  denied,
  className,
  children,
}: PageShellProps) {
  let body: ReactNode;
  if (error) {
    body = <QueryError message={error.message} onRetry={error.onRetry} />;
  } else if (loading) {
    body = skeleton ?? <Skeleton className="h-72 rounded-lg" />;
  } else if (denied) {
    body =
      typeof denied === "object" ? (
        <AccessDenied title={denied.title} description={denied.description} />
      ) : (
        <AccessDenied />
      );
  } else {
    body = children;
  }
  const normal = !error && !loading && !denied;

  /* หน้าที่มีหัวโมดูลของตัวเอง (โมดูลการผลิต/หน้าแรก) วาดผืน .page ของตัวเองอยู่แล้ว
     ที่นี่จึงคุมแค่ความกว้างและตัวอักษรชุดกลาง ไม่ซ้อนผืนซ้ำจนของในหน้าไล่ขึ้นสองรอบ */
  return (
    <div
      className={cn(
        header ? cn(c("tokens"), "mx-auto w-full max-w-[1124px] space-y-0") : c("tokens page"),
        className,
      )}
    >
      {header ?? (
        <PageHeader
          title={title}
          description={description}
          meta={meta}
          help={help}
          // ปุ่ม action ใช้ไม่ได้ระหว่างโหลด/พัง/ไม่มีสิทธิ์ — ซ่อนกันกดแล้วพัง
          action={normal ? action : undefined}
          breadcrumb={breadcrumb}
          titleBadge={normal ? titleBadge : undefined}
          back={back}
          icon={icon}
          tone={tone}
          eyebrow={eyebrow}
        >
          {normal ? headerChildren : undefined}
        </PageHeader>
      )}
      {body}
    </div>
  );
}
