import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CalendarClock,
  ChevronRight,
  Flame,
  ImageOff,
  PackageCheck,
  Pause,
  Truck,
  User,
} from "lucide-react";
import s from "./orders.module.css";
import { orderAttentionText } from "@/components/orders/order-problem";
import type { HomeProblem, HomeProblemKind } from "@/lib/home-orders";
import type { OrderProgress } from "@/lib/order-progress";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { formatDateShort, formatTime } from "@/lib/utils";

/* ============================================================
   ชิ้นส่วนร่วมของหน้าออเดอร์ที่ยกจากต้นแบบรอบ 2 (2026-09-15 · เบส "รื้อเขียนใหม่ refactor ไปเลย")

   c("chip warn") = คลาสชื่อเดียวกับต้นแบบใน orders.module.css — เขียน JSX ให้อ่านเทียบต้นแบบได้ทีละบรรทัด
   ชิ้นในไฟล์นี้ตรงกับ helper ของต้นแบบ: ch() sh() prop() dueTag() techChip() statusPill() payTag() problemCallout()
   กฎว่า "ต้องจัดการอะไร" ยังมาจาก lib/home-orders ชุดเดียวกับหน้าแรก — ไฟล์นี้วาดอย่างเดียว
   ============================================================ */

const missing = new Set<string>();

/** ชื่อคลาสแบบต้นแบบ → คลาสจริงใน orders.module.css · ชื่อที่ไม่มีจะเตือนตอน dev ไม่ให้หน้าตาหายเงียบ */
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
        console.warn(`orders.module.css ไม่มีคลาส "${name}"`);
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

/** ชิปวิธีพิมพ์ (techChip): DTF ฟ้า · ปัก เทา · ที่เหลือเส้นบาง */
export function TechChip({ label }: { label: string }) {
  return <span className={c("chip", label === "DTF" ? "blue" : label === "ปัก" ? "gray" : "line")}>{label}</span>;
}

/** ความเร่งด่วน — โผล่เฉพาะงานสำคัญ/เร่งด่วน */
export function PriorityChip({ priority, lg = false }: { priority: string; lg?: boolean }) {
  if (priority === "URGENT") return <span className={c("chip bad", lg && "lg")}>เร่งด่วน</span>;
  if (priority === "HIGH") return <span className={c("chip warn", lg && "lg")}>สำคัญ</span>;
  return null;
}

/** การชำระ (payTag) */
export function PayTag({ label, status }: { label: string; status: string }) {
  if (status === "INQUIRY" || status === "CANCELLED" || !["paid", "partial", "unpaid"].includes(label)) {
    return <span className={c("pay none")}>—</span>;
  }
  const [tone, text] =
    label === "paid" ? ["good", "ชำระแล้ว"] : label === "partial" ? ["warn", "บางส่วน"] : ["bad", "ค้างชำระ"];
  return (
    <span className={c("pay", tone)}>
      <span className={c("d")} aria-hidden="true" />
      {text}
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
  right,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  id?: string;
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
}: {
  icon?: LucideIcon;
  label: string;
  children: ReactNode;
  none?: boolean;
}) {
  return (
    <div className={c("prop")}>
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

/* ---------- "ต้องจัดการ" ---------- */

export const PROBLEM_ICON: Record<HomeProblemKind, LucideIcon> = {
  overdue: Flame,
  "vendor-late": Truck,
  ready: PackageCheck,
  "in-progress": Activity,
  customer: User,
  vendor: Truck,
  stuck: Pause,
};

export const PROBLEM_TONE: Record<HomeProblem["tone"], Tone> = {
  danger: "bad",
  warning: "warn",
  success: "good",
  neutral: "",
};

/** ช่องต้องจัดการในตาราง/การ์ด (why-cell) */
export function WhyCell({
  problem,
  progress,
  showWho = true,
}: {
  problem: HomeProblem | null;
  progress: OrderProgress;
  showWho?: boolean;
}) {
  if (!problem) {
    return (
      <div className={c("why-cell")}>
        <span className={c("none")}>—</span>
      </div>
    );
  }
  const Icon = PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <div className={c("why-cell")}>
      <span className={c("why", PROBLEM_TONE[problem.tone])}>
        <Icon aria-hidden="true" />
        {text}
      </span>
      {showWho && who ? <span className={c("wholine")}>{who}</span> : null}
    </div>
  );
}

/** ป้ายต้องจัดการแบบกล่อง (problemCallout): เลยกำหนด = แดง · ส่งวันนี้แพ็กแล้ว = ฟ้า · ที่เหลือ = ส้ม */
export function ProblemCallout({
  problem,
  progress,
  action,
}: {
  problem: HomeProblem;
  progress: OrderProgress;
  action?: ReactNode;
}) {
  const Icon = PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <Callout
      tone={problem.tone === "danger" ? "danger" : problem.tone === "success" ? "info" : undefined}
      icon={Icon}
      action={action}
    >
      <b>{text}</b>
      {who ? <span className={c("whoinline")}>· {who}</span> : null}
    </Callout>
  );
}

/** สถานะม็อกอัพ (mockPill) · ส่งให้ลูกค้าดูมากี่วันนับจาก now ที่หน้าแม่ส่งมา */
export function MockupPill({
  design,
  now,
}: {
  design: { approvalStatus: string; createdAt: Date | string } | null | undefined;
  now: Date;
}) {
  if (!design) return <span className={c("chip gray")}>ยังไม่มีม็อกอัพ</span>;
  switch (design.approvalStatus) {
    case "APPROVED":
      return <span className={c("chip good")}>ลูกค้าอนุมัติแล้ว</span>;
    case "PENDING":
      return (
        <span className={c("chip warn")}>
          รอลูกค้าตรวจ · {Math.max(0, differenceInBangkokDays(now, design.createdAt) ?? 0)} วัน
        </span>
      );
    case "REVISION_REQUESTED":
      return <span className={c("chip warn")}>ลูกค้าขอแก้</span>;
    case "REJECTED":
      return <span className={c("chip bad")}>ลูกค้าไม่ผ่านแบบ</span>;
    default:
      return <span className={c("chip gray")}>{design.approvalStatus}</span>;
  }
}

const NAME_PREFIX =/^(บริษัท|ร้าน|ชมรม|โรงเรียน|โรงแรม|ทีม|คณะ|สมาคม|ตลาดนัด|คลินิก|สโมสร)\s?/;

/** ตัวอักษรในวงของลูกค้า (.av) — ตัดคำนำหน้าองค์กรออกก่อน */
export function avatarLetter(name: string): string {
  return name.replace(NAME_PREFIX, "").trim().slice(0, 1) || "?";
}
