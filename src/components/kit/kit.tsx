import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Calendar,
  CalendarClock,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import s from "./kit.module.css";
import { INTERNAL_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { formatDateShort, formatTime } from "@/lib/utils";

/* ============================================================
   ชิ้นส่วนกลางของชุดหน้าตาที่เบสเคาะ (ยกจากหน้าออเดอร์ 2026-09-15 · ใช้ร่วมทั้งเว็บ)

   c("chip warn") = คลาสชื่อเดียวกับต้นแบบใน kit.module.css — เขียน JSX ให้อ่านเทียบต้นแบบได้ทีละบรรทัด
   ชิ้นในไฟล์นี้ไม่มีกฎธุรกิจ: หัวการ์ด หัวย่อย ช่องข้อมูล แถว ป้ายสถานะ/กำหนดส่ง กล่องแจ้งเตือน
   ชิ้นเฉพาะออเดอร์ (ต้องจัดการ ม็อกอัพ การชำระ) อยู่ components/orders/orders-ui.tsx
   ============================================================ */

const missing = new Set<string>();

/** ชื่อคลาสแบบต้นแบบ → คลาสจริงใน kit.module.css · ชื่อที่ไม่มีจะเตือนตอน dev ไม่ให้หน้าตาหายเงียบ */
export function c(...parts: Array<string | false | null | undefined>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const name of part.split(" ")) {
      if (!name) continue;
      const hashed = s[name];
      if (hashed) out.push(hashed);
      else if (process.env.NODE_ENV !== "production" && !missing.has(name)) {
        missing.add(name);
        console.warn(`kit.module.css ไม่มีคลาส "${name}"`);
      }
    }
  }
  return out.join(" ");
}

export type Tone = "blue" | "good" | "warn" | "bad" | "violet" | "gray" | "";

/** โทนสถานะภายในตามต้นแบบ (TONE) — ต่างจากสีกลางของระบบเล็กน้อยโดยตั้งใจ: ช่วงผลิต/ส่ง = ส้ม */
export const STATUS_TONE: Record<string, Exclude<Tone, "" | "violet">> = {
  DRAFT: "gray",
  INQUIRY: "gray",
  CONFIRMED: "blue",
  DESIGNING: "blue",
  DESIGN_APPROVED: "blue",
  PRODUCTION_QUEUE: "warn",
  PRODUCING: "warn",
  QUALITY_CHECK: "warn",
  PACKING: "warn",
  READY_TO_SHIP: "warn",
  SHIPPED: "blue",
  COMPLETED: "good",
  CANCELLED: "bad",
  ON_HOLD: "gray",
};

export const statusLabel = (status: string) =>
  (INTERNAL_STATUS_LABELS as Record<string, string>)[status] ?? status;

export const timeText = (date: Date | string) => `${formatTime(date)} น.`;

/** สถานะแบบชิปมีจุด (statusPill) · พักงาน = กรอบประ */
export function StatusPill({ status, lg = false }: { status: string; lg?: boolean }) {
  const tone = status === "ON_HOLD" ? "hold" : STATUS_TONE[status] ?? "gray";
  return (
    <span className={c("chip", lg && "lg", tone)}>
      <span className={c("d")} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

/** สถานะแบบจุด + ชื่อ (.stat) */
export function StatusDot({ status }: { status: string }) {
  return (
    <span className={c("stat")}>
      <span className={c("d", STATUS_TONE[status] ?? "gray")} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

const CLOSED_FOR_DUE = new Set(["SHIPPED", "COMPLETED", "CANCELLED", "DRAFT"]);

/** ป้ายวันส่ง (dueTag) — งานที่ยังเดินบอกความรีบ · งานจบแล้วเหลือแค่วันที่ */
export function DueTag({
  status,
  deadline,
  dueInDays,
  small = true,
}: {
  status: string;
  deadline: Date | string | null;
  dueInDays: number | null;
  small?: boolean;
}) {
  if (!deadline || dueInDays === null) {
    return (
      <span className={c("due n")}>
        <CalendarClock aria-hidden="true" />
        ยังไม่กำหนด
      </span>
    );
  }
  const date = formatDateShort(deadline);
  if (CLOSED_FOR_DUE.has(status)) {
    return (
      <span className={c("due n")}>
        <Calendar aria-hidden="true" />
        {date}
      </span>
    );
  }
  const [tone, text] =
    dueInDays < 0
      ? ["bad", `เลยกำหนด ${-dueInDays} วัน`]
      : dueInDays === 0
        ? ["warn", "ส่งวันนี้"]
        : dueInDays === 1
          ? ["warn", "ส่งพรุ่งนี้"]
          : ["n", `อีก ${dueInDays} วัน${small ? "" : ` · ${date}`}`];
  return (
    <span className={c("due", tone)}>
      <CalendarClock aria-hidden="true" />
      {text}
    </span>
  );
}

/** ลำดับคิวผลิต — โผล่เฉพาะสองระดับบน (สูง/เร่งด่วน) ระดับปกติ/ต่ำไม่ต้องมีป้าย
 *  คำบนป้ายมาจาก PRIORITY_LABELS ชุดเดียวกับตัวเลือกในฟอร์ม (เบสสั่ง 2026-09-18 ให้ตรงกัน)
 *  เดิมป้ายเขียน "สำคัญ" ขณะที่ช่องเลือกเขียน "สูง" — คนละคำสำหรับค่าเดียวกัน */
export function PriorityChip({ priority, lg = false }: { priority: string; lg?: boolean }) {
  if (priority !== "URGENT" && priority !== "HIGH") return null;
  return (
    <span className={c("chip", priority === "URGENT" ? "bad" : "warn", lg && "lg")}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** แถบขั้นงาน (.prog) — ขั้นที่เสร็จทึบ ขั้นที่ทำอยู่จาง */
export function StepBar({ done, total, label }: { done: number; total: number; label: string }) {
  if (total <= 0) return null;
  return (
    <span className={c("prog")} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={c(index < done ? "d" : index === done ? "c" : null)} />
      ))}
    </span>
  );
}

/** รูปม็อกอัพเล็ก (.thumb) — รูปจริงจากสูตรกลาง mockupCoverImage · ไม่มีรูป = ช่องว่างมีไอคอน */
export function Thumb({ cover, alt, lg = false }: { cover: string | null; alt: string; lg?: boolean }) {
  return (
    <span className={c("thumb", lg && "lg")} aria-hidden={cover ? undefined : true}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <ImageOff aria-hidden="true" />
      )}
    </span>
  );
}

/** หัวการ์ด (ch) — ทุกการ์ดมีไอคอนในกล่องสี (เบสสั่ง) */
export function CardHead({
  icon: Icon,
  tone = "",
  title,
  id,
  after,
  right,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  id?: string;
  /** ของที่ต่อท้ายชื่อการ์ดทางซ้าย เช่น คำอธิบายสี (legend) */
  after?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={c("ch")}>
      <h2 id={id}>
        <span className={c("ic", tone)} aria-hidden="true">
          <Icon />
        </span>
        {title}
      </h2>
      {after}
      {right ? <div className={c("r")}>{right}</div> : null}
    </div>
  );
}

/** หัวย่อยในการ์ด (sh) */
export function SubHead({
  icon: Icon,
  tone = "",
  title,
  right,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={c("sub-h")}>
      <h3>
        <span className={c("tm", tone)} aria-hidden="true">
          <Icon />
        </span>
        {title}
      </h3>
      {right ? <div className={c("r")}>{right}</div> : null}
    </div>
  );
}

/** ช่องข้อมูล label/ค่า (prop) — none = ค่าว่างสีจาง */
export function Prop({
  icon: Icon,
  label,
  children,
  none = false,
  wide = false,
}: {
  icon?: LucideIcon;
  label: string;
  children: ReactNode;
  none?: boolean;
  /** กินเต็มแถวในตาราง props สองคอลัมน์ */
  wide?: boolean;
}) {
  return (
    <div className={c("prop", wide && "wide")}>
      <dt>
        {Icon ? <Icon aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className={none ? c("none") : undefined}>{children}</dd>
    </div>
  );
}

/** วงแหวนเล็ก (miniRing) — pct = สัดส่วนที่ใช้ไป 0..1 */
export function MiniRing({ pct, label, tone = "" }: { pct: number; label: ReactNode; tone?: Tone }) {
  const offset = 100 * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <span className={c("miniring", tone)} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle className={c("tr")} cx="20" cy="20" r="16" />
        <circle className={c("pr")} cx="20" cy="20" r="16" pathLength={100} style={{ strokeDashoffset: offset }} />
      </svg>
      <b>{label}</b>
    </span>
  );
}

/** ป้ายแจ้งเตือน (.callout) — tone ว่าง = ส้ม */
export function Callout({
  tone,
  icon: Icon,
  children,
  action,
  role,
}: {
  tone?: "danger" | "info";
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  role?: "alert" | "note";
}) {
  return (
    <div role={role} className={c("callout", tone)}>
      <Icon aria-hidden="true" />
      <span className={c("grow")}>{children}</span>
      {action}
    </div>
  );
}

/** ช่องสถานะในการ์ด (.state) */
export function StateBox({
  tone,
  icon: Icon,
  children,
  action,
}: {
  tone?: "on" | "good" | "warn" | "bad";
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={c("state", tone)}>
      <Icon aria-hidden="true" />
      <span className={c("grow")}>{children}</span>
      {action}
    </div>
  );
}

/** ช่องว่าง (.empty) — วงไอคอน + ป้ายสั้น + ทางไปต่อ */
export function Empty({
  icon: Icon,
  title,
  hint,
  size = "sm",
  flat = false,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  size?: "sm" | "lg";
  flat?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={c("empty", size === "sm" && "sm", flat && "flat")}>
      <span className={c("ring")} aria-hidden="true">
        <Icon />
      </span>
      <b>{title}</b>
      {hint ? <small>{hint}</small> : null}
      {action}
    </div>
  );
}

/** แถวกดได้ (.rw): ไอคอน · ชื่อ+บรรทัดรอง · ค่าขวา · ลูกศร */
export function Rw({
  href,
  onClick,
  icon: Icon,
  tone,
  title,
  sub,
  right,
  arrow = "chevron",
  ariaLabel,
}: {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  tone?: "good" | "warn" | "bad" | "lineapp";
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  arrow?: "chevron" | "external" | null;
  ariaLabel?: string;
}) {
  const interactive = Boolean(href || onClick);
  const inner = (
    <>
      <span className={c("tl", tone)} aria-hidden="true">
        <Icon />
      </span>
      <span className={c("tx")}>
        {title}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className={c("r")}>{right}</span>
      {interactive && arrow === "chevron" ? (
        <ChevronRight className={c("arrow")} aria-hidden="true" />
      ) : interactive && arrow === "external" ? (
        <ArrowUpRight className={c("arrow")} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" />
      )}
    </>
  );
  if (href) {
    if (/^(tel|mailto):/.test(href)) {
      return (
        <a href={href} aria-label={ariaLabel} className={c("rw")}>
          {inner}
        </a>
      );
    }
    if (/^https?:/.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={c("rw")}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} aria-label={ariaLabel} className={c("rw")}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={c("rw")}>
        {inner}
      </button>
    );
  }
  return <div className={c("rw static")}>{inner}</div>;
}
