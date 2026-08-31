"use client";

/**
 * สามบล็อกที่ทุกแบบใช้ข้อมูลชุดเดียวกัน — เขียนมือเฉพาะ "ชิ้นที่กำลังเทียบ"
 * ของที่ไม่ได้เปลี่ยน (การ์ด · ปุ่ม · ป้าย · ช่องข้อมูล · การ์ดตัวเลข) import ตัวจริง
 * จาก src/components/ui ทั้งหมด ไม่วาดใหม่
 *
 * สีที่ใช้เพิ่มในแบบ B/C ไม่ใช่สีที่คิดขึ้นใหม่ — เป็นชุด module-* ที่อยู่ใน globals.css
 * มาตั้งแต่ P1.0 (แบรนด์ · ผลิต · สินค้า · การเงิน · ระบบ) มีคู่โหมดมืดครบแล้ว
 * แต่วันนี้ทั้งเว็บเรียกใช้จริงแค่ไม่กี่จุด (ไอคอนเมนูซ้าย · EntityMark)
 */

import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Factory,
  Receipt,
  Repeat2,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityMark } from "@/components/ui/entity-mark";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn, formatCurrency } from "@/lib/utils";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";

import { CORE_JOBS, formatQty, type ProtoJob, type StageKey } from "../_kit/demo-jobs";
import { Field, FieldGrid, SectionTitle } from "../order-overview/_ui";
import { lookCustomer, STATS, type LookCustomer, type LookStat } from "./_data";

export type LookVariant = "current" | "rank" | "module" | "alive";

/* ───────────────────────────── ตัวช่วยเล็ก ๆ ───────────────────────────── */

/** หัวข้อการ์ดที่ไอคอนมีกล่องสีประจำหมวด (ใช้ในแบบ B/C) */
function ToneTitle({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: VisualTone;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center",
          RADIUS.item,
          VISUAL_TONE_CLASSES[tone].soft,
        )}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </span>
  );
}

/** สีประจำช่วงงาน — แบบ B/C ใช้บอกว่า "ใบนี้อยู่มือใคร" โดยไม่ต้องอ่าน */
const STAGE_TONE: Record<StageKey, VisualTone> = {
  intake: "brand",
  design: "brand",
  prep: "production",
  dtf: "production",
  outsource: "production",
  qc: "production",
  ship: "product",
};

const STAT_TONE: Record<LookStat["kind"], VisualTone> = {
  production: "production",
  ship: "brand",
  finance: "finance",
  late: "system",
};

/* พื้นไล่สีของการ์ดตัวเลขในแบบ C — เขียนเป็นคลาสเต็มทีละตัว เพราะ Tailwind
   สแกนคลาสจากตัวอักษรในไฟล์ ต่อสตริงเองแล้วคลาสจะไม่ถูกสร้าง */
const TONE_GRADIENT: Record<VisualTone, string> = {
  brand: "bg-gradient-to-br from-module-brand-surface to-surface",
  production: "bg-gradient-to-br from-module-production-surface to-surface",
  product: "bg-gradient-to-br from-module-product-surface to-surface",
  finance: "bg-gradient-to-br from-module-finance-surface to-surface",
  system: "bg-gradient-to-br from-module-system-surface to-surface",
};

const STAT_ICON: Record<LookStat["kind"], LucideIcon> = {
  production: Factory,
  ship: Truck,
  finance: Receipt,
  late: CalendarClock,
};

/* ═════════════════════ ① การ์ดลูกค้าในใบงาน ═════════════════════ */

type HistoryCell = {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: VisualTone;
};

function historyCells(c: LookCustomer): HistoryCell[] {
  return [
    {
      label: "ซื้อสะสม",
      value: formatCurrency(c.totalSpent),
      icon: Wallet,
      tone: "finance",
    },
    {
      label: "สั่งมาแล้ว",
      value: `${c.totalOrders.toLocaleString()} ครั้ง`,
      icon: Repeat2,
      tone: "brand",
    },
    {
      label: "สั่งล่าสุด",
      value: c.lastOrderLabel ?? "—",
      icon: CalendarClock,
      tone: "system",
    },
    {
      label: "วงเงินเครดิต",
      value: c.creditLimit != null ? formatCurrency(c.creditLimit) : "ยังไม่ตั้ง",
      icon: CreditCard,
      tone: "finance",
    },
  ];
}

/** ของจริงวันนี้ — สูตรต่อบรรทัดยกมาจาก order-overview-tab.tsx ตรง ๆ */
function historyLine(c: LookCustomer) {
  return [
    `ซื้อสะสม ${formatCurrency(c.totalSpent)}`,
    c.totalOrders > 0 ? `${c.totalOrders.toLocaleString()} ครั้ง` : null,
    c.lastOrderLabel ? `ล่าสุด ${c.lastOrderLabel}` : null,
    c.creditLimit != null ? `วงเงิน ${formatCurrency(c.creditLimit)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function CustomerHistory({ variant, c }: { variant: LookVariant; c: LookCustomer }) {
  const cells = historyCells(c);

  if (variant === "rank") {
    /* เส้นคั่นบางด้วย gap-px บนพื้นเส้น — ได้ตารางตัวเลขโดยไม่ต้องมีกรอบ */
    return (
      <dl className={cn("grid grid-cols-2 gap-px overflow-hidden bg-divider sm:grid-cols-4", RADIUS.inner)}>
        {cells.map((cell) => (
          <div key={cell.label} className="bg-surface px-3 py-3">
            <dt className="text-xs text-muted">{cell.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-strong [overflow-wrap:anywhere]">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (variant === "module") {
    return (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cn("px-3 py-3", RADIUS.inner, VISUAL_TONE_CLASSES[cell.tone].soft)}
          >
            <dt className="flex items-center gap-1.5 text-xs">
              <cell.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {cell.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (variant === "alive") {
    const percent =
      c.creditLimit != null && c.creditUsed != null && c.creditLimit > 0
        ? Math.round((c.creditUsed / c.creditLimit) * 100)
        : null;
    return (
      <div
        className={cn(
          "bg-gradient-to-br from-module-finance-surface to-surface p-4",
          RADIUS.inner,
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              VISUAL_TONE_CLASSES.finance.soft,
            )}
            aria-hidden="true"
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">ซื้อสะสมกับเรา</p>
            <p className="text-2xl font-semibold tabular-nums text-strong">
              {formatCurrency(c.totalSpent)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-semibold tabular-nums text-strong">
              {c.totalOrders.toLocaleString()} ครั้ง
            </p>
            <p className="text-xs text-muted">
              {c.lastOrderLabel ? `ล่าสุด ${c.lastOrderLabel}` : "ยังไม่เคยสั่ง"}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-divider pt-3">
          {percent != null && c.creditLimit != null && c.creditUsed != null ? (
            <>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted">วงเงินเครดิตที่ใช้ไป</span>
                <span className="tabular-nums text-secondary">
                  {formatCurrency(c.creditUsed)} / {formatCurrency(c.creditLimit)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="สัดส่วนวงเงินเครดิตที่ใช้ไป"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-module-finance-solid transition-[width] duration-[var(--duration-base)] ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                เหลือใช้ได้อีก {formatCurrency(c.creditLimit - c.creditUsed)} ({100 - percent}%)
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">ยังไม่ตั้งวงเงินเครดิตให้ลูกค้ารายนี้</p>
          )}
        </div>
      </div>
    );
  }

  /* current — บรรทัดเดียวใต้ชื่อ (ของจริงวันนี้) */
  return (
    <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">{historyLine(c)}</p>
  );
}

function CustomerCard({ variant, c }: { variant: LookVariant; c: LookCustomer }) {
  const colored = variant === "module" || variant === "alive";

  return (
    <Section
      compact
      className={variant === "alive" ? "relative" : undefined}
      title={
        colored ? (
          <ToneTitle icon={User} tone="brand">
            ลูกค้าและผู้ติดต่อ
          </ToneTitle>
        ) : (
          <SectionTitle icon={User}>ลูกค้าและผู้ติดต่อ</SectionTitle>
        )
      }
      action={
        <Button type="button" variant="ghost" size="sm">
          เปิดหน้าลูกค้า
        </Button>
      }
    >
      {variant === "alive" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-module-production-solid to-module-finance-solid"
        />
      )}

      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {variant === "alive" && (
              <EntityMark label={c.name} size="lg" shape="avatar" tone="brand" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "font-semibold text-strong [overflow-wrap:anywhere]",
                  variant === "current" ? "text-base" : "text-lg",
                )}
              >
                {c.name}
              </p>
              {c.company && (
                <p className="text-sm text-secondary [overflow-wrap:anywhere]">{c.company}</p>
              )}
              {variant === "current" && <CustomerHistory variant={variant} c={c} />}
            </div>
          </div>
          <Badge variant={colored ? "accent" : "secondary"} size="sm">
            {c.type}
          </Badge>
        </div>

        {variant !== "current" && <CustomerHistory variant={variant} c={c} />}

        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "px-2 py-0.5 text-xs",
                  RADIUS.item,
                  colored
                    ? VISUAL_TONE_CLASSES.system.soft
                    : "text-secondary ring-1 ring-inset ring-border",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <FieldGrid>
          <Field
            label="เลขผู้เสียภาษี"
            emptyTone="warn"
            emptyText="ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้"
          >
            {c.taxId && (
              <span className="font-mono">
                {c.taxId}
                {c.branchLabel && (
                  <span className="ml-1.5 font-sans text-xs font-normal text-muted">
                    ({c.branchLabel})
                  </span>
                )}
              </span>
            )}
          </Field>
          <Field label="โทรศัพท์" emptyText="—">
            {c.phone}
          </Field>
          <Field label="LINE" emptyText="—">
            {c.lineId}
          </Field>
          <Field label="เงื่อนไขชำระของใบนี้">{c.paymentTerms}</Field>
        </FieldGrid>
      </div>
    </Section>
  );
}

/* ═════════════════════ ② แถวตัวเลขสรุปหน้าแรก ═════════════════════ */

function StatsRow({ variant }: { variant: LookVariant }) {
  if (variant === "rank") {
    /* แผงเดียวแบ่งช่องด้วยเส้น — เลิกให้การ์ด 4 ใบลอยแยกกัน */
    return (
      <div className="card-surface overflow-hidden rounded-2xl">
        <dl className="grid grid-cols-2 gap-px bg-divider lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.key} className="bg-surface px-5 py-4">
              <dt className="text-xs text-muted">{stat.label}</dt>
              <dd
                className={cn(
                  "mt-2 text-3xl font-semibold tabular-nums",
                  stat.danger ? "text-red-600 dark:text-red-400" : "text-strong",
                )}
              >
                {stat.value}
              </dd>
              <dd className="mt-1 text-xs text-muted">{stat.caption}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (variant === "module") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = STAT_ICON[stat.kind];
          const tone = STAT_TONE[stat.kind];
          return (
            <div key={stat.key} className="card-surface rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted">{stat.label}</p>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center",
                    RADIUS.item,
                    stat.danger
                      ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : VISUAL_TONE_CLASSES[tone].soft,
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold tabular-nums",
                  stat.danger
                    ? "text-red-600 dark:text-red-400"
                    : VISUAL_TONE_CLASSES[tone].text,
                )}
              >
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted">{stat.caption}</p>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "alive") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = STAT_ICON[stat.kind];
          const tone = STAT_TONE[stat.kind];
          return (
            <button
              key={stat.key}
              type="button"
              className={cn(
                "card-surface card-surface-hover group rounded-2xl p-5 text-left",
                FOCUS_BUTTON,
                "transition-transform duration-[var(--duration-base)] ease-out hover:-translate-y-0.5",
                stat.danger
                  ? "bg-gradient-to-br from-red-50 to-surface dark:from-red-950/40"
                  : TONE_GRADIENT[tone],
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted">{stat.label}</p>
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    stat.danger
                      ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : VISUAL_TONE_CLASSES[tone].soft,
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold tabular-nums",
                  stat.danger ? "text-red-600 dark:text-red-400" : "text-strong",
                )}
              >
                {stat.value}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                {stat.caption}
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </p>
            </button>
          );
        })}
      </div>
    );
  }

  /* current — StatCard ตัวจริงของระบบ */
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map((stat) => (
        <StatCard
          key={stat.key}
          title={stat.label}
          value={stat.value}
          icon={STAT_ICON[stat.kind]}
          tone={stat.danger ? "danger" : "default"}
          caption={stat.caption}
        />
      ))}
    </div>
  );
}

/* ═════════════════════ ③ แถวรายการออเดอร์ ═════════════════════ */

/* เลือกสี่ใบที่อยู่คนละช่วงงาน + ใบที่ยังไม่ตีราคาและยังไม่กำหนดส่ง —
   ถ้าหยิบสามใบแรกติดกันจะเป็นช่วง "ผลิต" หมด แล้วแถบสีของแบบ B/C จะสีเดียวกันทั้งคอลัมน์
   จนดูเหมือนสีไม่ได้บอกอะไร ทั้งที่จริงมันบอก */
const ROW_IDS = ["j-0042", "j-0044", "j-0055", "j-0058"] as const;
const ROWS: ProtoJob[] = ROW_IDS.map(
  (id) => CORE_JOBS.find((job) => job.id === id)!,
);

function DueLabel({ job }: { job: ProtoJob }) {
  if (job.dueInDays === null) return <span className="text-muted">ยังไม่กำหนดส่ง</span>;
  if (job.dueInDays < 0)
    return (
      <span className="font-medium text-red-700 dark:text-red-300">
        เลยกำหนด {Math.abs(job.dueInDays)} วัน
      </span>
    );
  if (job.dueInDays === 0) return <span className="text-amber-700 dark:text-amber-300">ส่งวันนี้</span>;
  return <span className="text-secondary">ส่ง {job.dueLabel}</span>;
}

function OrderRow({ variant, job }: { variant: LookVariant; job: ProtoJob }) {
  const tone = STAGE_TONE[job.stage];
  const percent = Math.round((job.progress.done / job.progress.total) * 100);

  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full items-center gap-3 px-5 py-3 text-left",
        FOCUS_BUTTON,
        "transition-colors hover:bg-interactive-hover active:bg-interactive-pressed",
        variant === "alive" && "gap-4",
      )}
    >
      {variant === "module" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-2 left-0 w-1 rounded-full",
            VISUAL_TONE_CLASSES[tone].solid,
          )}
        />
      )}
      {variant === "alive" && (
        <EntityMark label={job.company} size="md" shape="avatar" tone={tone} />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-semibold tabular-nums text-strong",
              variant === "current" ? "text-sm" : "text-sm",
            )}
          >
            {job.orderNumber}
          </span>
          {variant === "module" || variant === "alive" ? (
            <span
              className={cn(
                "px-2 py-0.5 text-xs",
                RADIUS.item,
                VISUAL_TONE_CLASSES[tone].soft,
              )}
            >
              {job.statusLabel}
            </span>
          ) : (
            <Badge variant="secondary" size="sm">
              {job.statusLabel}
            </Badge>
          )}
          {job.urgent && (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-secondary">
          {job.contact} · {job.company}
        </span>
        {variant === "alive" && (
          <span className="mt-2 flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
              <span
                className={cn("block h-full rounded-full", VISUAL_TONE_CLASSES[tone].solid)}
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-xs tabular-nums text-muted">
              {job.progress.done}/{job.progress.total} ช่วง
            </span>
          </span>
        )}
      </span>

      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-xs text-muted">{formatQty(job.qty)} ตัว</span>
        <span className="block text-xs">
          <DueLabel job={job} />
        </span>
      </span>

      <span
        className={cn(
          "shrink-0 text-right font-semibold tabular-nums text-strong",
          variant === "current" ? "text-sm" : "text-base",
        )}
      >
        {job.amount != null ? formatCurrency(job.amount) : "—"}
      </span>
    </button>
  );
}

function OrderList({ variant }: { variant: LookVariant }) {
  return (
    <Section
      flush
      surface="card"
      className="overflow-hidden"
      title={
        variant === "module" || variant === "alive" ? (
          <ToneTitle icon={Factory} tone="production">
            ออเดอร์ที่กำลังเดินอยู่
          </ToneTitle>
        ) : (
          <SectionTitle icon={Factory}>ออเดอร์ที่กำลังเดินอยู่</SectionTitle>
        )
      }
      action={
        <Button type="button" variant="ghost" size="sm">
          ดูทั้งหมด
        </Button>
      }
    >
      <div className="divide-y divide-divider">
        {ROWS.map((job) => (
          <OrderRow key={job.id} variant={variant} job={job} />
        ))}
      </div>
    </Section>
  );
}

/* ═════════════════════ ประกอบทั้งสามบล็อก ═════════════════════ */

function BlockFrame({
  step,
  title,
  note,
  children,
}: {
  step: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-xs font-medium text-muted">
        {step} {title}
      </p>
      <p className="mb-3 text-xs text-muted">{note}</p>
      {children}
    </section>
  );
}

export function LookPreview({
  variant,
  plain,
}: {
  variant: LookVariant;
  plain: boolean;
}) {
  const customer = lookCustomer(plain);

  return (
    <div
      className={cn(
        "space-y-8 p-4 sm:p-6",
        RADIUS.surface,
        variant === "alive"
          ? "bg-gradient-to-b from-module-brand-surface to-bg"
          : "bg-bg",
      )}
    >
      <BlockFrame
        step="1 ·"
        title="การ์ดลูกค้าในใบงาน"
        note="จุดที่เบสถ่ายมา — บรรทัด “ซื้อสะสม ฿0 · 6 ครั้ง · ล่าสุด 12 ส.ค. 2569”"
      >
        <div className="max-w-[680px]">
          <CustomerCard variant={variant} c={customer} />
        </div>
      </BlockFrame>

      <BlockFrame
        step="2 ·"
        title="แถวตัวเลขสรุปบนหน้าแรก"
        note="ของเดียวกันนี้ใช้ซ้ำอีก 6 หน้า (ผลิต · การเงิน · ลูกค้า · สินค้า · วิเคราะห์ · งานของฉัน)"
      >
        <StatsRow variant={variant} />
      </BlockFrame>

      <BlockFrame
        step="3 ·"
        title="แถวรายการออเดอร์"
        note="ด่านของทุกแบบ — สีที่ดูดีบนของชิ้นเดียว มักกลายเป็นพรมสีเมื่อเรียงกันสิบแถว"
      >
        <OrderList variant={variant} />
      </BlockFrame>
    </div>
  );
}
