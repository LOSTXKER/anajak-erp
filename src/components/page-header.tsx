import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageIdentityIcon } from "@/lib/page-identity";
import { HelpTip } from "@/components/ui/help-tip";
import {
  INTERACTIVE_PAGE_HOVER,
  INTERACTIVE_PAGE_PRESSED,
} from "@/components/ui/tokens";
import {
  VISUAL_TONE_CLASSES,
  visualToneForLabel,
  type VisualTone,
} from "@/lib/visual-tone";

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
  /** Visual identity ของโมดูล; ถ้าไม่ส่งจะอนุมานจากชื่อหน้า/เส้นทาง breadcrumb */
  icon?: LucideIcon;
  tone?: VisualTone;
  /** บริบทสำหรับ assistive technology เท่านั้น; ไม่วาด kicker เหนือ h1 */
  eyebrow?: string;
  children?: ReactNode;
}

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
  tone,
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
  const resolvedTone = tone ?? visualToneForLabel(descriptionSource);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:min-w-64 sm:flex-[1_1_24rem]">
          {/* ปุ่มย้อนกลับใช้ interaction ของผืนหน้าเดียวกับหัวข้อ */}
          {resolvedBack && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn(INTERACTIVE_PAGE_HOVER, INTERACTIVE_PAGE_PRESSED, "mt-0.5 shrink-0")}
            >
              <Link href={resolvedBack.href} aria-label={resolvedBack.label}>
                <ArrowLeft />
              </Link>
            </Button>
          )}

          <span
            className={cn(
              "page-module-mark flex h-9 w-6 shrink-0 items-center justify-center sm:h-10",
              VISUAL_TONE_CLASSES[resolvedTone].mark,
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
          <div className="min-w-0 space-y-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold text-strong [overflow-wrap:anywhere] sm:text-3xl">
                {title}
              </h1>
              {titleBadge}
              {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
            </div>
            {description && (
              <p
                className="max-w-[72ch] text-sm leading-relaxed text-secondary"
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
