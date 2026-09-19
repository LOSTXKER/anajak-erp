"use client";

/**
 * /production/problems — คิวปัญหาของทั้งโรงงาน (เบสสั่ง 2026-09-19 "ไม่มีหน้ารวมปัญหา")
 *
 * ตอบสามคำถามต่อเรื่อง: เกิดอะไร · อยู่ใบไหนขั้นไหน · ตอนนี้รอใคร (และรอมานานแค่ไหน)
 * แหล่งข้อมูล = production.problemQueue (แถวจริงใน production_exceptions + ใบเก่าที่ยังมีแต่ marker ใน notes)
 * อ่านอย่างเดียว การตัดสินอยู่ในกล่องปัญหาบนใบผลิต — ปุ่มที่นี่จึงพาไปที่นั่น ไม่มีคำสั่งซ้ำอีกชุด
 * ไม่มีเงินในหน้านี้ ทุกบทบาทเปิดได้
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Flag, ShieldCheck, TriangleAlert } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { c, CardHead } from "@/components/kit/kit";
import { Seg } from "@/components/kit/seg";
import { ProductionModuleHead } from "@/components/production/production-module-head";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatDateShort } from "@/lib/utils";

type Problem = RouterOutput["production"]["problemQueue"][number];
type Group = "waiting" | "working" | "closed";

const GROUP_OF = (problem: Problem): Group =>
  problem.resolvedAt ? "closed" : problem.acknowledgedAt ? "working" : "waiting";

const SOURCE_LABELS: Record<string, string> = {
  STATION: "หน้างาน",
  QC: "ตรวจงาน",
  OUTSOURCE: "ร้านนอก",
  CLAIM: "ลูกค้าแจ้ง",
  SYSTEM: "ระบบ",
};

/** รอมานานแค่ไหน — บอกเป็นชั่วโมงจนครบวัน เพื่อให้เรื่องที่เพิ่งแจ้งไม่ขึ้นว่า "0 วัน" */
export function problemAge(from: Date | string, nowMs: number): string {
  const ms = nowMs - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "เพิ่งแจ้ง";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "เพิ่งแจ้ง";
  if (hours < 24) return `${hours} ชม.`;
  return `${Math.floor(hours / 24)} วัน`;
}

/** ตอนนี้ลูกบอลอยู่ที่ใคร — คำตอบของ "กดไปแล้วไงต่อ" */
export function waitingOnText(problem: Problem): string {
  if (problem.resolvedAt) return problem.resolution ?? "ปิดแล้ว";
  if (problem.acknowledgedAt) return problem.ownerName ? `${problem.ownerName} กำลังแก้` : "หัวหน้ากำลังแก้";
  return "รอหัวหน้ารับเรื่อง";
}

/* ช่องในตารางแยกเป็นชิ้น — ตารางอ่านง่ายและตัวช่วยเข้าถึงเห็นข้อความในช่องครบ (แบบเดียวกับตารางออเดอร์) */

function ReasonCell({ problem }: { problem: Problem }) {
  return (
    <span className={c("nowc")}>
      <span className={c("lb", problem.blocksStep && !problem.resolvedAt && "bad")}>{problem.title}</span>
      <span className={c("ln")}>
        <span className={c("chip", problem.blocksStep ? "bad" : "warn")}>{problem.blocksStep ? "หยุดทั้งขั้น" : "ทำต่อได้"}</span>
        {problem.scrapQty > 0 ? <span className={c("t")}>เสีย {problem.scrapQty.toLocaleString("th-TH")} ตัว</span> : null}
        <span className={c("t")}>{SOURCE_LABELS[problem.source] ?? problem.source}</span>
      </span>
    </span>
  );
}

function TwoLineCell({ title, sub }: { title: string; sub: string }) {
  return (
    <span className={c("outc")}>
      <b>{title}</b>
      <span className={c("t")}>{sub}</span>
    </span>
  );
}

function WaitingCell({ problem }: { problem: Problem }) {
  return (
    <span className={c("whoc", !problem.raisedByName && "none")}>
      {waitingOnText(problem)}
      {problem.raisedByName ? <small> · แจ้งโดย {problem.raisedByName}</small> : null}
    </span>
  );
}

function ProblemsView({ rows, nowMs }: { rows: Problem[]; nowMs: number }) {
  const [group, setGroup] = useState<Group>("waiting");
  const counts = {
    waiting: rows.filter((row) => GROUP_OF(row) === "waiting").length,
    working: rows.filter((row) => GROUP_OF(row) === "working").length,
    closed: rows.filter((row) => GROUP_OF(row) === "closed").length,
  };
  const shown = rows.filter((row) => GROUP_OF(row) === group);
  const blocking = rows.filter((row) => row.blocksStep && !row.resolvedAt).length;

  return (
    <div className={c("tokens page mfg")}>
      <ProductionModuleHead active="problems" title="ปัญหาหน้างาน" badges={{ problems: counts.waiting + counts.working }} />

      <section className={c("card")} aria-labelledby="pq-h">
        <CardHead
          icon={TriangleAlert}
          tone={blocking > 0 ? "bad" : "blue"}
          id="pq-h"
          title={
            <>
              เรื่องที่ยังไม่จบ
              <small>
                {" "}
                {counts.waiting + counts.working} เรื่อง
                {blocking > 0 ? ` · หยุดงานอยู่ ${blocking}` : ""}
              </small>
            </>
          }
          right={
            <Seg
              label="กลุ่มของคิวปัญหา"
              value={group}
              onChange={setGroup}
              options={[
                { key: "waiting", label: "รอหัวหน้ารับเรื่อง", count: counts.waiting },
                { key: "working", label: "กำลังแก้", count: counts.working },
                { key: "closed", label: "ปิดแล้ว 7 วัน", count: counts.closed },
              ]}
            />
          }
        />
        {shown.length === 0 ? (
          <div className={c("empty flat")}>
            <span className={c("ring")} aria-hidden="true">
              <ShieldCheck />
            </span>
            <b>{group === "closed" ? "ยังไม่มีเรื่องที่ปิดใน 7 วันนี้" : "ไม่มีเรื่องค้างในกลุ่มนี้"}</b>
          </div>
        ) : (
          <div className={c("tblw")}>
            <table className={c("tbl")}>
              <caption className={c("sr")}>คิวปัญหาของการผลิต</caption>
              <thead>
                <tr>
                  <th scope="col">เรื่อง</th>
                  <th scope="col">ใบผลิต</th>
                  <th scope="col">ขั้น</th>
                  <th scope="col" className={c("num")}>
                    แจ้งมาแล้ว
                  </th>
                  <th scope="col">ตอนนี้รอใคร</th>
                  <th scope="col" aria-label="เปิดใบผลิต" />
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td className={c("pcell")}>
                      <ReasonCell problem={row} />
                    </td>
                    <td>
                      <TwoLineCell title={row.orderNumber} sub={row.customerName ?? "ไม่ระบุลูกค้า"} />
                    </td>
                    <td>
                      <TwoLineCell title={row.stepLabel} sub={row.deadline ? `ส่ง ${formatDateShort(row.deadline)}` : "ไม่ระบุกำหนดส่ง"} />
                    </td>
                    <td className={c("num")}>{problemAge(row.reportedAt, nowMs)}</td>
                    <td>
                      <WaitingCell problem={row} />
                    </td>
                    <td className={c("num")}>
                      <Link className={c("btn sm")} href={`/production/${row.productionId}`}>
                        เปิดใบผลิต
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={c("stepfoot")}>
          <span className={c("why")}>
            <Flag aria-hidden="true" /> ตัดสินเรื่องได้ในกล่องปัญหาบนใบผลิต — ที่นี่ดูภาพรวมและอายุของเรื่อง
          </span>
        </div>
      </section>
    </div>
  );
}

export function ProductionProblemsPage() {
  const query = trpc.production.problemQueue.useQuery({}, { refetchInterval: 60_000, staleTime: 30_000 });
  return (
    <PageShell
      title="ปัญหาหน้างาน"
      header={<div className="sr-only">ปัญหาหน้างาน</div>}
      loading={query.isLoading}
      skeleton={
        <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดคิวปัญหา">
          <span className={c("sk")} style={{ height: 112 }} />
          <span className={c("sk")} style={{ height: 360 }} />
        </div>
      }
      error={query.isError && !query.data ? { message: "โหลดคิวปัญหาไม่สำเร็จ", onRetry: () => void query.refetch() } : null}
    >
      {query.data ? <ProblemsView rows={query.data} nowMs={query.dataUpdatedAt || 0} /> : null}
    </PageShell>
  );
}

export { ProblemsView as ProductionProblemsView };
