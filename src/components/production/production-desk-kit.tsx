"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpDown, CalendarClock, ChevronRight, PackageCheck, Search, SearchX, TriangleAlert, Truck } from "lucide-react";
import { c, DueTag, Empty, PriorityChip, Thumb } from "@/components/kit/kit";
import { Seg } from "@/components/kit/seg";
import { orderMockupCover } from "@/lib/mockup";
import type { BoardOrderLike } from "@/lib/production-board";
import type { DeskLens, DeskOutsource, DeskRow, DeskStepLike, DeskSummary } from "@/lib/production-desk";
import type { DeskSort, DeskSortKey } from "@/lib/production-desk-sort";
import { productionWorklistProgress } from "@/lib/production-worklist";

/* ============================================================
   หน้างานในโรงงาน /production บนชุดหน้าตากลาง (ต้นแบบ mockup-production-calm-2026-09-15)
   กล่องสถานะ 4 ช่องกดกรอง · ตัวกรองขั้นแบบเลื่อน + ค้นหา · ตาราง 6 คอลัมน์ ร้านนอกแยกคอลัมน์
   ตัววาดรับ props ล้วน — ข้อมูล/ตัวกรองอยู่ production-desk-page.tsx (สูตรเดิมทั้งหมด)
   ============================================================ */

const LENSES: { key: Exclude<DeskLens, "all">; label: string; icon: LucideIcon; tone: "bad" | "warn" | "good" }[] = [
  { key: "late", label: "เลยกำหนดส่ง", icon: CalendarClock, tone: "bad" },
  { key: "blocked", label: "ติดปัญหา", icon: TriangleAlert, tone: "bad" },
  { key: "outsource", label: "ร้านนอกเลยนัด", icon: Truck, tone: "warn" },
  { key: "ready", label: "พร้อมส่ง QC", icon: PackageCheck, tone: "good" },
];

export function DeskLensBoxes({
  summary,
  lens,
  onSelect,
}: {
  summary: DeskSummary;
  lens: DeskLens;
  onSelect: (lens: DeskLens) => void;
}) {
  return (
    <section className={c("lenses")} aria-label="งานที่ต้องจัดการ">
      {LENSES.map((item) => {
        const count = summary[item.key];
        const Icon = item.icon;
        const on = lens === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={c("lensbox", count > 0 && item.tone)}
            aria-pressed={on}
            onClick={() => onSelect(on ? "all" : item.key)}
          >
            <span className={c("lb")}>
              <span className={c("d")} aria-hidden="true" />
              {item.label}
            </span>
            <span className={c("ic")} aria-hidden="true">
              <Icon />
            </span>
            <span className={c("n")}>
              <b>{count.toLocaleString("th-TH")}</b>
              <small>ใบ</small>
            </span>
          </button>
        );
      })}
    </section>
  );
}

export type DeskStationOption = { key: string; label: string; count: number };

function OutsourceBack({ outsource }: { outsource: DeskOutsource }) {
  const days = outsource.backInDays;
  if (days === null) return <span className={c("t")}>{outsource.statusLabel}</span>;
  if (days < 0) return <span className={c("t bad")}>เลยนัดรับ {-days} วัน</span>;
  if (days === 0) return <span className={c("t bad")}>นัดรับวันนี้</span>;
  return <span className={c("t")}>กลับอีก {days} วัน</span>;
}

function NowCell<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row }: { row: DeskRow<S, O> }) {
  const [primary] = row.current;
  const { completed, total } = productionWorklistProgress(row.job.rail);
  if (!primary) return <span className={c("whoc none")}>รออัปเดตขั้นตอน</span>;
  const failed = primary.state === "failed";
  const points = row.job.rail.filter((point) => point.state !== "na");
  return (
    <div className={c("nowc")}>
      <span className={c("lb", failed && "bad")}>{primary.label}</span>
      {points.length > 0 || primary.reason ? (
        <span className={c("ln")}>
          {points.length > 0 ? (
            <span className={c("prog")} role="img" aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}>
              {points.map((point) => (
                <i
                  key={point.key}
                  className={c(
                    point.state === "done" ? "d" : point.state === "failed" ? "bad" : point.state === "now" || point.state === "stuck" ? "c" : null,
                  )}
                />
              ))}
            </span>
          ) : null}
          {primary.reason ? (
            <span className={c("t", failed ? "bad" : primary.state === "waiting" && "warn")}>{primary.reason}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function initialOf(name: string) {
  return name.replace(/^[เแโใไ]/, "").slice(0, 1);
}

function WhoCell({ names }: { names: readonly string[] }) {
  if (names.length === 0) {
    return (
      <span className={c("whoc none")}>
        <span className={c("av")} aria-hidden="true">?</span>
        ยังไม่มีคนรับ
      </span>
    );
  }
  return (
    <span className={c("whoc")} title={names.join(", ")}>
      <span className={c("av")} aria-hidden="true">{initialOf(names[0]!)}</span>
      {names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]}
    </span>
  );
}

export function DeskWorkCard<S extends DeskStepLike, O extends BoardOrderLike<S>>({
  rows,
  station,
  stations,
  onSelectStation,
  searchDefault,
  searchInputRef,
  onSearchChange,
  sort,
  onSort,
  hrefFor,
  filtered,
  onClear,
}: {
  rows: readonly DeskRow<S, O>[];
  station: string;
  stations: readonly DeskStationOption[];
  onSelectStation: (key: string) => void;
  searchDefault: string;
  searchInputRef: RefObject<HTMLInputElement | null> | null;
  onSearchChange: (value: string) => void;
  sort: DeskSort;
  onSort: (key: DeskSortKey, direction: "asc" | "desc") => void;
  hrefFor: (row: DeskRow<S, O>) => string;
  filtered: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const sortButton = (key: DeskSortKey, label: string) => {
    const on = sort.key === key;
    return (
      <button
        type="button"
        className={c("sort")}
        onClick={() => onSort(key, on && sort.direction === "asc" ? "desc" : "asc")}
      >
        {label}
        <ArrowUpDown aria-hidden="true" />
      </button>
    );
  };
  const ariaSort = (key: DeskSortKey) => (sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined);

  return (
    <section className={c("card desk")} aria-label="งานในโรงงาน">
      <div className={c("tools top")}>
        <Seg label="กรองตามขั้นงาน" options={stations} value={station} onChange={onSelectStation} />
        <label className={c("sinput")}>
          <Search aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="ค้นเลขออเดอร์หรือลูกค้า"
            defaultValue={searchDefault}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="ค้นหางานผลิต"
            autoComplete="off"
          />
        </label>
      </div>

      <div className={c("tblw list")}>
        <table className={c("orders deskt")}>
          <caption className={c("sr")}>รายการผลิต กดแถวเพื่อเปิดใบผลิต</caption>
          <colgroup>
            <col className={c("c1")} />
            <col className={c("c2")} />
            <col />
            <col className={c("c4")} />
            <col className={c("c5")} />
            <col className={c("c6")} />
            <col className={c("c7")} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort("order")}>{sortButton("order", "ใบงาน")}</th>
              <th scope="col" aria-sort={ariaSort("deadline")}>{sortButton("deadline", "กำหนดส่ง")}</th>
              <th scope="col">ตอนนี้</th>
              <th scope="col">ร้านนอก</th>
              <th scope="col">คนทำ</th>
              <th scope="col" className={c("r")} aria-sort={ariaSort("quantity")}>{sortButton("quantity", "จำนวน")}</th>
              <th scope="col"><span className={c("sr")}>เปิด</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const order = row.job.order;
              const href = hrefFor(row);
              return (
                <tr
                  key={row.job.key}
                  className={c("row")}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a,button")) return;
                    if (window.getSelection()?.toString()) return;
                    router.push(href);
                  }}
                >
                  <td>
                    <div className={c("who")}>
                      <Thumb cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} />
                      <div className={c("t")}>
                        <div className={c("id")}>
                          <Link href={href} className={c("idbtn")}>
                            <span className={c("mono")}>{order.orderNumber}</span>
                          </Link>
                          <PriorityChip priority={order.priority ?? "NORMAL"} />
                        </div>
                        <div className={c("cu")}>{order.customerName ?? "ไม่ระบุลูกค้า"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <DueTag status={order.internalStatus} deadline={order.deadline ?? null} dueInDays={row.dueInDays} />
                  </td>
                  <td>
                    <NowCell row={row} />
                  </td>
                  <td>
                    {row.outsource ? (
                      <div className={c("outc")}>
                        <b>{row.outsource.vendor}</b>
                        <OutsourceBack outsource={row.outsource} />
                      </div>
                    ) : (
                      <span className={c("whoc none")}>—</span>
                    )}
                  </td>
                  <td>
                    <WhoCell names={row.responsible} />
                  </td>
                  <td className={c("qty r")}>
                    <b>{(order.totalQuantity ?? 0).toLocaleString("th-TH")}</b>
                    <small>ตัว</small>
                  </td>
                  <td className={c("arr")}>
                    <Link href={href} className={c("ibtn")} aria-label={`เปิดใบผลิต ${order.orderNumber}`}>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          /* กล่องว่างของชุดกลาง เหมือนหน้าอื่นทั้งเว็บ — เดิมวาด .noresult เอง */
          <Empty
            icon={SearchX}
            title={filtered ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ยังไม่มีงานในโรงงาน"}
            action={
              filtered ? (
                <button type="button" className={c("btn sm")} onClick={onClear}>
                  ล้างตัวกรอง
                </button>
              ) : undefined
            }
          />
        ) : null}
      </div>

      <ul className={c("ocards")}>
        {rows.map((row) => {
          const order = row.job.order;
          return (
            <li key={row.job.key}>
              <Link href={hrefFor(row)} className={c("ocard")}>
                <span className={c("l1")}>
                  <span className={c("mono")}>{order.orderNumber}</span>
                  <DueTag status={order.internalStatus} deadline={order.deadline ?? null} dueInDays={row.dueInDays} />
                </span>
                <NowCell row={row} />
                <span className={c("l2")}>
                  <span>{row.responsible[0] ?? "ยังไม่มีคนรับ"}</span>
                  {row.outsource ? <span>{row.outsource.vendor}</span> : null}
                  <span className={c("amt")}>{(order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
