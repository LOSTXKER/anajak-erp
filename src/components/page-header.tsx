import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import { INTERACTIVE_PAGE_PRESSED } from "@/components/ui/tokens";
import type { VisualTone } from "@/lib/visual-tone";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  /** คำแนะนำที่จำเป็นต่อหน้านี้; ไม่เติมคำโปรยอัตโนมัติจากชื่อหน้า */
  description?: ReactNode;
  /** ข้อเท็จจริงเฉพาะรายการ/สถานะ เช่น SKU จำนวนงาน หรือชื่อโปรเจกต์ */
  meta?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** ป้าย/สถานะที่ยืนข้างหัวข้อ — แยกจาก title เพื่อให้ <h1> มีแต่ข้อความจริง
   *  (เครื่องอ่านหน้าจอประกาศหัวข้อหน้า ไม่ควรมีคำว่า "ร่าง"/"VIP" ปนเข้าไป) */
  titleBadge?: ReactNode;
  /** ปุ่มย้อนกลับหน้าหัวข้อ — หน้ารายละเอียดใช้ */
  back?: { href: string; label: string };
  /** @deprecated หัวแบบ kit ไม่วาดไอคอนประจำหมวดแล้ว (2026-09-17) — คงไว้ให้ caller เดิมไม่พัง */
  icon?: LucideIcon;
  /** @deprecated ดู icon */
  tone?: VisualTone;
  /** @deprecated ดู icon */
  eyebrow?: string;
  children?: ReactNode;
}

/* หัวข้อหน้า = ที่เดียวของทั้งระบบ (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไรไม่เป็นมาตรฐาน")
   audit เจอ 3 หน้าเขียนสูตร <h1> เองซ้ำกับที่นี่ทุกตัวอักษร เพราะที่นี่ไม่รองรับ
   "ปุ่มย้อนกลับ + ป้ายข้างหัวข้อ" ที่หน้ารายละเอียดต้องใช้ — เพิ่ม back/titleBadge
   ให้รองรับ แทนที่จะปล่อยให้ก๊อปต่อไป (ก๊อปแล้วมันจะเพี้ยนวันที่แก้ที่นี่) */
export function PageHeader({
  title,
  description,
  meta,
  help,
  action,
  breadcrumb,
  titleBadge,
  back,
  children,
}: PageHeaderProps) {
  const identityLabel =
    typeof title === "string"
      ? title
      : breadcrumb?.at(-1)?.label;
  /* แถบ breadcrumb ("บิล/การเงิน › ลูกหนี้") ถูกถอดออกจากทุกหน้า 2026-08-26
     เบสส่งภาพมาชี้ตรงนั้นแล้วบอกว่า "ทุกหน้าไม่ต้องมีหัวข้อเล็กๆแบบนี้"

     prop `breadcrumb` ยังอยู่และยังมีประโยชน์สองอย่าง ห้ามลบทิ้ง:
     ① เป็นที่มาของ identity ของหน้า (ดู identityLabel ข้างบน)
     ② เป็นที่มาของ "ปุ่มย้อนกลับ" เมื่อหน้าไม่ได้ส่ง back มาเอง — 5 หน้าที่เคยมีแต่
        breadcrumb ไม่มี back จะไม่เหลือทางกลับบนจอเลยถ้าไม่ทำตรงนี้
        (ลูกค้ารายตัว · ภาษีขาย · แก้ออเดอร์ · เปิดออเดอร์ 2 ไฟล์) */
  const resolvedBack =
    back ??
    (() => {
      const parents = (breadcrumb ?? []).filter(
        (item) => item.href && item.label !== identityLabel,
      );
      const parent = parents.at(-1);
      return parent?.href ? { href: parent.href, label: `กลับไป${parent.label}` } : undefined;
    })();

  return (
    <div className="page-header space-y-4" data-page-identity={identityLabel ?? "custom"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 sm:min-w-64 sm:flex-1">
          {/* ปุ่มย้อนกลับยืนบนผืนงานเทา ไม่ใช่ในการ์ด — ใช้คู่ interaction ของผืนงาน */}
          {resolvedBack && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn(INTERACTIVE_PAGE_PRESSED, "shrink-0")}
            >
              <Link href={resolvedBack.href} aria-label={resolvedBack.label}>
                <ArrowLeft />
              </Link>
            </Button>
          )}
          {/* หัวหน้าแบบชุดกลาง kit (2026-09-17 เบสสั่ง "ทุกหน้าให้เข้ากัน ใช้ component เดียวกัน"):
              ชื่อหน้าใหญ่ + ปุ่มขวา ไม่มีกล่องไอคอนประจำหมวด — ตรงหัวหน้าออเดอร์/หน้าแรกที่เบสเคาะ
              (ไอคอนสีบอกหมวดแบบ B 2026-08-31 ถูกแทนด้วยหัวแบบนี้) · data-page-identity ยังอยู่ให้ด่านตรวจ */}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-3xl font-semibold text-strong [overflow-wrap:anywhere]">
                {title}
              </h1>
              {titleBadge}
              {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
            </div>
            {description && (
              <p
                className="max-w-[72ch] text-sm leading-relaxed text-muted"
                data-page-description=""
              >
                {description}
              </p>
            )}
            {meta && (
              <p className="text-xs leading-relaxed text-muted" data-page-meta="">
                {meta}
              </p>
            )}
          </div>
        </div>
        {action && (
          // ล็อกพื้นที่หัวข้อไว้ก่อน: action ยอมห่อและลงแถวใหม่เมื่อพื้นที่จริงหลังหัก sidebar ไม่พอ
          <div className="flex max-w-full flex-wrap items-center gap-2 sm:ml-auto">{action}</div>
        )}
      </div>
      {children}
    </div>
  );
}
