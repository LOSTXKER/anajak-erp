import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";
import { PageIdentityIcon, pageDescriptionForLabel } from "@/lib/page-identity";
import { HelpTip } from "@/components/ui/help-tip";
import type { VisualTone } from "@/lib/visual-tone";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  /** หน้านี้ใช้ทำอะไร — สั้นหนึ่งประโยคและเห็นเสมอใต้หัวข้อ */
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
  /** Visual identity ของโมดูล; ถ้าไม่ส่งจะอนุมานจากชื่อหน้า/เส้นทาง breadcrumb */
  icon?: LucideIcon;
  tone?: VisualTone;
  /** บริบทสำหรับ assistive technology เท่านั้น; ไม่วาด kicker เหนือ h1 */
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
  icon,
  eyebrow,
  children,
}: PageHeaderProps) {
  const identityLabel =
    typeof title === "string"
      ? title
      : breadcrumb?.at(-1)?.label;
  const descriptionSource = [identityLabel, ...(breadcrumb?.map((item) => item.label) ?? [])]
    .filter(Boolean)
    .join(" ");
  const resolvedDescription =
    description === undefined
      ? pageDescriptionForLabel(descriptionSource)
      : description;
  return (
    <div className="page-header space-y-4" data-page-identity={identityLabel ?? "custom"}>
      {(() => {
        // ตัวสุดท้ายที่ซ้ำกับชื่อหน้า (h1 บรรทัดถัดไป) คำต่อคำ — ตัดทิ้ง เหลือ path พ่อแม่
        // (benchmark: Stripe ใส่แค่ทางเดิน ให้หัวหน้าเป็นชื่อหน้าเอง)
        const deduped =
          !!breadcrumb &&
          typeof title === "string" &&
          breadcrumb.length > 0 &&
          breadcrumb[breadcrumb.length - 1].label === title;
        const crumbs = deduped ? breadcrumb!.slice(0, -1) : breadcrumb;
        return crumbs && crumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-xs text-muted"
        >
          {crumbs.map((item, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <span key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={cn(CONTROL_MIN_H, "inline-flex min-w-11 items-center justify-center rounded-lg px-1 transition-colors hover:text-strong sm:min-w-0 sm:justify-start sm:px-0 [@media(pointer:coarse)]:min-w-11 dark:hover:text-white")}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    // ตัวสุดท้ายเป็น "หน้าปัจจุบัน" เฉพาะเมื่อไม่ได้ถูกตัดเพราะซ้ำ h1
                    aria-current={isLast && !deduped ? "page" : undefined}
                    className={
                      isLast
                        ? "text-secondary"
                        : "text-muted"
                    }
                  >
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                )}
              </span>
            );
          })}
        </nav>
        ) : null;
      })()}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:min-w-64 sm:flex-1">
          {back && (
            <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
              <Link href={back.href} aria-label={back.label}>
                <ArrowLeft />
              </Link>
            </Button>
          )}
          <span
            className={cn(
              "page-module-mark mt-1 flex h-6 w-6 shrink-0 items-center justify-center",
              "text-secondary",
            )}
            role={eyebrow ? "img" : undefined}
            aria-label={eyebrow}
            aria-hidden={eyebrow ? undefined : "true"}
          >
            {icon ? (
              <>{/* component จาก caller เป็น contract คงที่ ไม่ได้สร้างจาก resolver ระหว่าง render */}
                {(() => {
                  const Icon = icon;
                  return <Icon className="h-5 w-5" strokeWidth={1.8} />;
                })()}
              </>
            ) : (
              <PageIdentityIcon label={identityLabel} className="h-5 w-5" strokeWidth={1.8} />
            )}
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-strong">
                {title}
              </h1>
              {titleBadge}
              {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
            </div>
            {resolvedDescription && (
              <p
                className="max-w-[72ch] text-sm leading-relaxed text-secondary"
                data-page-description=""
              >
                {resolvedDescription}
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
