"use client";

import { useEffect, type ReactNode, type Ref } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Factory,
  ListFilter,
  PackageCheck,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { StatusLabel } from "@/components/ui/status-label";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import { cn, formatDateShort } from "@/lib/utils";
import {
  type BoardJob,
  type BoardOrderLike,
  type BoardRailPoint,
  type BoardStepLike,
  type ProductionBoard,
} from "@/lib/production-board";
import {
  PRODUCTION_WORKLIST_LENSES,
  PRODUCTION_WORKLIST_SORT_COLUMNS,
  PRODUCTION_WORKLIST_SORT_OPTIONS,
  groupProductionWorklist,
  productionWorklistProgress,
  productionWorklistCounts,
  productionWorklistHref,
  productionWorklistStatus,
  resolveProductionWorklistSort,
  type ProductionWorklistLens,
  type ProductionWorklistSort,
  type ProductionWorklistSortColumn,
} from "@/lib/production-worklist";

/* ============================================================
   รายการควบคุมการผลิต — แบบ C "แถบเดียว" (เบสเคาะจากหน้าลอง
   /proto/production-list เมื่อ 2026-08-31)

   สองอย่างที่เปลี่ยนจากของเดิม และเหตุผล:
   ① ตัวกรอง 5 มุมเคยเป็นการ์ดตัวเลขสูง 87px วางเต็มแถวก่อนถึงงานใบแรก
      → ยุบเป็นแถบชิปแถวเดียวในแถบเครื่องมือ (ใช้ FilterChip ตัวจริงของระบบ)
      พื้นที่ที่ได้คืนไปให้ตัวงาน ซึ่งเป็นเนื้อหาจริงของหน้านี้
   ② คอลัมน์ "ต้องทำต่อ" (เหตุผล + เจ้าของถัดไป + ป้ายสายงาน) ถูกตัดออก
      เบสสั่งคำต่อคำ: "ตารางไม่ต้องบอกรายละเอียด ต้องทำต่อ คือทำให้รู้ว่าตอนนี้
      สถานะอะไรก็พอ" → เหลือคอลัมน์ "สถานะ" ที่ใช้ป้ายกลาง StatusLabel
   ③ ตารางแบ่งหัวข้อตามกำหนดส่ง เพราะคำถามจริงของหน้านี้คือ "อะไรจะไม่ทัน" —
      หัวข้อกลุ่มบอกความเร่งแล้ว ในแถวจึงเหลือแค่วันที่ ไม่มีป้ายซ้ำ

   หน้านี้ยังเป็น read/triage layer เท่านั้น: การเปลี่ยนสถานะทำในใบผลิต/ออเดอร์
   ผ่าน mutation และ permission เดิมทั้งหมด
   ============================================================ */

/* ไอคอนของแต่ละมุมมองยังใช้สีประจำหมวดชุดเดิม เปลี่ยนแค่ที่วาง: จากกล่องสีในการ์ดใหญ่
   มาเป็นไอคอนในชิปแถบเดียว · ตัวเลขเกาะข้างชื่อมุมด้วยสีเฉดเดียวกัน **ไม่มีพื้นเม็ด**
   ตั้งแต่ 2026-08-31 (เบสเคาะแบบ B "ไม่มีกล่อง" จากหน้าลอง /proto/quiet) —
   กติกาเดียวกับ `mark` ใน visual-tone.ts: ไอคอน/ตัวเลขนำหน้าหัวข้อไม่ต้องมีพื้น */
const WORKLIST_LENS_PRESENTATION = {
  all: {
    icon: ListFilter,
    iconColor: "text-module-brand-text",
    countColor: "text-module-brand-text",
  },
  attention: {
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-300",
    countColor: "text-red-700 dark:text-red-300",
  },
  production: {
    icon: Factory,
    iconColor: "text-module-production-text",
    countColor: "text-module-production-text",
  },
  qc: {
    icon: ClipboardCheck,
    iconColor: "text-amber-700 dark:text-amber-300",
    countColor: "text-amber-700 dark:text-amber-300",
  },
  packing: {
    icon: PackageCheck,
    iconColor: "text-green-700 dark:text-green-300",
    countColor: "text-green-700 dark:text-green-300",
  },
} satisfies Record<
  ProductionWorklistLens,
  {
    icon: LucideIcon;
    iconColor: string;
    countColor: string;
  }
>;

const WORKLIST_FOCUS_STORAGE_KEY = "anajak:production-worklist:last-focus";

function rememberWorklistFocus(orderId: string) {
  try {
    window.sessionStorage.setItem(WORKLIST_FOCUS_STORAGE_KEY, orderId);
  } catch {
    // sessionStorage อาจถูกปิดโดย browser policy — การนำทางยังทำงานตามปกติ
  }
}

function WorkProgress({
  rail,
}: {
  rail: readonly BoardRailPoint[];
}) {
  const { completed, total, percent } = productionWorklistProgress(rail);

  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{completed}/{total} ช่วง</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * สถานะของแถว — ชื่อสถานะจาก INTERNAL_STATUS_LABELS + จุดสีบอกสภาพงาน
 * บรรทัดรองบอกสายงานที่ยังค้าง (งานผสมมีได้หลายสาย) และซ่อนเองถ้าซ้ำกับบรรทัดบน
 */
function WorkStatus<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
}: {
  job: BoardJob<O, S>;
}) {
  const status = productionWorklistStatus(job);
  return (
    <StatusLabel
      label={status.label}
      tone={status.tone}
      sub={status.stations.length > 0 ? status.stations.join(" · ") : undefined}
    />
  );
}

function OrderIdentity<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
  href,
  size = "sm",
  /** ปิดเมื่อการ์ดทั้งใบเป็นลิงก์อยู่แล้ว — ลิงก์ซ้อนลิงก์ทำให้เบราว์เซอร์ตัด DOM */
  asLink = true,
}: {
  job: BoardJob<O, S>;
  href: string;
  size?: "sm" | "md";
  asLink?: boolean;
}) {
  const body = (
    <>
      {/* รูปม็อกอัพนำหน้า — หัวหน้าไล่คิวจำงานจากภาพได้เร็วกว่าอ่านเลขออเดอร์ */}
      <MockupThumbnail
        cover={orderMockupCover(job.order)}
        alt={`ม็อกอัพของ ${job.order.orderNumber}`}
        size={size}
      />
      <span className="flex min-w-0 flex-col justify-center">
        <span className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums text-strong">
          {job.order.orderNumber}
          {job.order.priority === "URGENT" ? (
            <Badge variant="destructive" size="sm">ด่วน</Badge>
          ) : null}
        </span>
        <span className="max-w-48 truncate text-xs text-muted">
          {job.order.customerName || "ไม่ระบุลูกค้า"}
        </span>
      </span>
    </>
  );

  if (!asLink) {
    return <span className="flex min-w-0 items-center gap-3">{body}</span>;
  }

  return (
    <Link
      data-production-worklist-order={job.order.id}
      href={href}
      onClick={() => rememberWorklistFocus(job.order.id)}
      className={cn(
        FOCUS_BUTTON,
        "inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg",
      )}
    >
      {body}
    </Link>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <>
      <span className="font-semibold text-secondary">{label}</span>
      <span className="ml-2 font-normal tabular-nums text-muted">{count} ใบ</span>
    </>
  );
}

function DesktopRows<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  jobs,
  canCreateProduction,
  sort,
  onSelectSort,
}: {
  jobs: readonly BoardJob<O, S>[];
  canCreateProduction: boolean;
  sort: ProductionWorklistSort;
  onSelectSort: (sort: ProductionWorklistSort) => void;
}) {
  const sortColumn = (column: ProductionWorklistSortColumn) => {
    const config = PRODUCTION_WORKLIST_SORT_COLUMNS[column];
    return {
      direction:
        sort === config.asc ? "asc" as const
          : sort === config.desc ? "desc" as const
            : null,
      defaultDirection: config.defaultDirection,
      onSort: (direction: "asc" | "desc") => onSelectSort(config[direction]),
    };
  };
  const groups = groupProductionWorklist(jobs);

  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh {...sortColumn("orderNumber")}>
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.SortableTh {...sortColumn("progress")}>
            ความคืบหน้า
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumn("totalQuantity")}
            className="hidden lg:table-cell"
            align="right"
          >
            จำนวน
          </DataTable.SortableTh>
          <DataTable.SortableTh {...sortColumn("deadline")}>
            กำหนดส่ง
          </DataTable.SortableTh>
          <DataTable.Th className="w-12"><span className="sr-only">เปิด</span></DataTable.Th>
        </tr>
      </DataTable.Head>
      {groups.map((group) => (
        <DataTable.Body key={group.key}>
          {/* หัวข้อกลุ่มคือสิ่งที่บอกความเร่ง แถวข้างล่างจึงไม่ต้องมีป้ายซ้ำอีก */}
          <tr className="border-t border-divider bg-surface-muted/70">
            <th scope="colgroup" colSpan={6} className="px-6 py-1.5 text-left text-xs">
              <GroupHeading label={group.label} count={group.jobs.length} />
            </th>
          </tr>
          {group.jobs.map((job) => {
            const href = productionWorklistHref(job, canCreateProduction);
            return (
              <DataTable.Row
                key={job.key}
                href={href}
                onClick={() => rememberWorklistFocus(job.order.id)}
                className="h-[70px]"
              >
                <DataTable.Td className="min-w-44">
                  <OrderIdentity job={job} href={href} />
                </DataTable.Td>
                <DataTable.Td className="min-w-44">
                  <WorkStatus job={job} />
                </DataTable.Td>
                <DataTable.Td className="w-32">
                  <WorkProgress rail={job.rail} />
                </DataTable.Td>
                <DataTable.Td className="hidden tabular-nums lg:table-cell" align="right">
                  {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
                </DataTable.Td>
                <DataTable.Td className="min-w-24">
                  <span className={cn("block tabular-nums", job.overdue && "font-medium text-red-700 dark:text-red-300")}>
                    {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนด"}
                  </span>
                </DataTable.Td>
                <DataTable.Td className="text-muted">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </DataTable.Td>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      ))}
    </DataTable.Root>
  );
}

function MobileRows<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  jobs,
  canCreateProduction,
}: {
  jobs: readonly BoardJob<O, S>[];
  canCreateProduction: boolean;
}) {
  const groups = groupProductionWorklist(jobs);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key}>
          <p className="mb-1.5 px-1 text-xs">
            <GroupHeading label={group.label} count={group.jobs.length} />
          </p>
          <ul aria-label={group.label} className="space-y-2">
            {group.jobs.map((job) => {
              const href = productionWorklistHref(job, canCreateProduction);
              return (
                <li key={job.key}>
                  <Link
                    data-production-worklist-order={job.order.id}
                    href={href}
                    onClick={() => rememberWorklistFocus(job.order.id)}
                    className={cn(
                      FOCUS_BUTTON,
                      "card-surface card-surface-hover block min-h-11 rounded-2xl p-4",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <OrderIdentity job={job} href={href} size="md" asLink={false} />
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    </span>
                    <span className="mt-3 block"><WorkStatus job={job} /></span>
                    <span className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
                      <WorkProgress rail={job.rail} />
                      <span className="text-right text-xs text-muted">
                        <span className="block tabular-nums">
                          {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนดส่ง"}
                        </span>
                        <span className="block tabular-nums">
                          {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ProductionControlWorklist<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>({
  board,
  jobs,
  lens,
  sort,
  searchDefault,
  searchInputRef,
  onSelectLens,
  onSelectSort,
  onSearchChange,
  canCreateProduction,
  freshness,
}: {
  board: ProductionBoard<O, S>;
  jobs: readonly BoardJob<O, S>[];
  lens: ProductionWorklistLens;
  sort: ProductionWorklistSort;
  searchDefault: string;
  searchInputRef: Ref<HTMLInputElement>;
  onSelectLens: (lens: ProductionWorklistLens) => void;
  onSelectSort: (sort: ProductionWorklistSort) => void;
  onSearchChange: (value: string) => void;
  canCreateProduction: boolean;
  freshness?: ReactNode;
}) {
  const counts = productionWorklistCounts(board);
  const desktopSortValue = sort === "attention" || sort === "urgent"
    ? sort
    : "__column__";

  useEffect(() => {
    let orderId: string | null = null;
    try {
      orderId = window.sessionStorage.getItem(WORKLIST_FOCUS_STORAGE_KEY);
    } catch {
      return;
    }
    if (!orderId) return;

    const target = [...document.querySelectorAll<HTMLElement>(
      "[data-production-worklist-order]",
    )].find(
      (candidate) =>
        candidate.dataset.productionWorklistOrder === orderId &&
        candidate.getClientRects().length > 0,
    );
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      try {
        window.sessionStorage.removeItem(WORKLIST_FOCUS_STORAGE_KEY);
      } catch {
        // ไม่มีผลต่อการคืน focus ที่ทำสำเร็จแล้ว
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [jobs]);

  return (
    <div className="space-y-4" data-production-worklist>
      <div className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-surface">
        <Toolbar className="lg:border-b lg:border-divider lg:px-4 lg:py-3">
          {freshness ? (
            <div className="order-1 flex justify-end @2xl:order-4 @2xl:ml-auto">
              {freshness}
            </div>
          ) : null}
          {/* ตัวกรอง 5 มุมเป็นแถบเดียว — เลขเกาะในชิป ไม่ใช่การ์ดตัวเลขเต็มแถวอีกต่อไป */}
          <div
            role="group"
            aria-label="กรองรายการงาน"
            className="-mx-1 order-2 flex w-full items-center gap-4 overflow-x-auto border-b border-divider px-1 @2xl:order-1"
          >
            {PRODUCTION_WORKLIST_LENSES.map((item) => {
              const isOn = lens === item.key;
              const presentation = WORKLIST_LENS_PRESENTATION[item.key];
              const Icon = presentation.icon;
              const action = item.key === "all" && isOn
                ? "กำลังแสดงทั้งหมด"
                : isOn
                  ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง"
                  : "กดเพื่อกรอง";
              const actionLabel = `${item.label} · ${counts[item.key]} งาน · ${action}`;

              return (
                <FilterChip
                  key={item.key}
                  selected={isOn}
                  onClick={() => onSelectLens(isOn ? "all" : item.key)}
                  aria-label={actionLabel}
                  title={actionLabel}
                  icon={
                    <Icon
                      className={cn("h-4 w-4", presentation.iconColor)}
                      strokeWidth={1.8}
                    />
                  }
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  <span
                    data-lens-count=""
                    className={cn(
                      "ml-1 text-2xs font-semibold tabular-nums",
                      presentation.countColor,
                    )}
                  >
                    {counts[item.key]}
                  </span>
                </FilterChip>
              );
            })}
          </div>
          <SearchInput
            ref={searchInputRef}
            defaultValue={searchDefault}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ค้นหาเลขออเดอร์ หรือลูกค้า"
            surface="raised"
            containerClassName="order-3 w-full @2xl:order-2 @2xl:max-w-md"
          />
          <ToolbarGroup className="order-4 w-full @2xl:order-3 @2xl:w-auto">
            {/* มือถือไม่มีหัวตาราง จึงต้องเข้าถึงทุกวิธีเรียงจาก Select */}
            <Select
              value={sort}
              onChange={(event) =>
                onSelectSort(resolveProductionWorklistSort(event.target.value))
              }
              aria-label="เรียงรายการงาน"
              shape="pill"
              surface="raised"
              className="w-full @2xl:hidden"
            >
              {PRODUCTION_WORKLIST_SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
            {/* desktop ใช้หัวตารางกับ column sort และเหลือเฉพาะ preset ข้ามคอลัมน์ */}
            <Select
              value={desktopSortValue}
              onChange={(event) =>
                onSelectSort(resolveProductionWorklistSort(event.target.value))
              }
              aria-label="ลำดับพิเศษ"
              shape="pill"
              surface="raised"
              className="hidden @2xl:flex @2xl:w-52"
            >
              <option value="__column__" disabled>เรียงจากหัวตาราง</option>
              <option value="attention">ต้องจัดการก่อน</option>
              <option value="urgent">ด่วนก่อน</option>
            </Select>
          </ToolbarGroup>
        </Toolbar>

        <ResponsiveList
          items={jobs}
          label="งานผลิต"
          emptyState={
            <EmptyState
              icon={lens === "all" ? Factory : SearchX}
              title={lens === "all" ? "ยังไม่มีงานในสายการผลิต" : "ไม่มีงานในมุมนี้"}
              description={lens === "all" ? "ออเดอร์พร้อมผลิตจะปรากฏที่นี่" : "ลองเลือกมุมอื่นหรือค้นหาด้วยเลขออเดอร์"}
            />
          }
          renderDesktop={(items) => (
            <DesktopRows
              jobs={items}
              canCreateProduction={canCreateProduction}
              sort={sort}
              onSelectSort={onSelectSort}
            />
          )}
          renderMobile={(items) => (
            <MobileRows
              jobs={items}
              canCreateProduction={canCreateProduction}
            />
          )}
        />
      </div>
    </div>
  );
}
