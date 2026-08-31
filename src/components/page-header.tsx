import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageIdentityIcon, pageDescriptionForLabel } from "@/lib/page-identity";
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
  const resolvedDescription =
    description === undefined
      ? pageDescriptionForLabel(descriptionSource)
      : description;
  /* แถบ breadcrumb ("บิล/การเงิน › ลูกหนี้") ถูกถอดออกจากทุกหน้า 2026-08-26
     เบสส่งภาพมาชี้ตรงนั้นแล้วบอกว่า "ทุกหน้าไม่ต้องมีหัวข้อเล็กๆแบบนี้"

     prop `breadcrumb` ยังอยู่และยังมีประโยชน์สองอย่าง ห้ามลบทิ้ง:
     ① เป็นที่มาของ identity/description ปริยายของหน้า (ดู identityLabel ข้างบน)
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
        <div className="flex min-w-0 items-start gap-2 sm:min-w-64 sm:flex-1">
          {/* ปุ่มย้อนกลับยืนบนผืนงานเทา ไม่ใช่ในการ์ด — ใช้คู่ interaction ของผืนงาน */}
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
          {/* เครื่องหมายประจำหมวดของหน้า — กลับมามีสีอีกครั้ง 2026-08-31 (แบบ B "สีบอกหมวด")
              สีอนุมานจากชื่อหน้า/breadcrumb ด้วย visualToneForLabel ทุกหน้าจึงได้สีเองโดย
              ไม่ต้องไล่แก้ทีละหน้า · หน้าไหนอยากกำหนดเองส่ง prop `tone` มาทับได้

              ประวัติกันคนมาแก้ย้อน: 23 ส.ค. เคยเป็นกล่องสีทึบ 48px มีเงา → ถูกลดเหลือ
              ไอคอนเส้นสีหมวด → แล้วถูกลดอีกเป็นเทาล้วนตอน "white canvas" วันเดียวกัน
              รอบนี้กลับมาที่ "กล่องสีอ่อน + ไอคอนเส้น" ซึ่งอยู่ระหว่างสองอันนั้น
              **ห้ามกลับไปเป็นสีทึบ** — ด่าน verify:ui ล็อกไว้แล้ว */}
          <span
            className={cn(
              "page-module-mark mt-1.5 flex shrink-0 items-center justify-center",
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
                  return <Icon className="h-6 w-6" strokeWidth={1.8} />;
                })()}
              </>
            ) : (
              <PageIdentityIcon label={identityLabel} className="h-6 w-6" strokeWidth={1.8} />
            )}
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold text-strong [overflow-wrap:anywhere]">
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
