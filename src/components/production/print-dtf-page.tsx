"use client";

/**
 * /production/print-runs — หน้า "พิมพ์ DTF" (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16)
 *
 * ความจริงหน้าเครื่องที่เบสตอบ 09-16: พิมพ์รวมหลายออเดอร์ในม้วนเดียวบ่อยมาก · พิมพ์เผื่อไม่ค่อยมี · ฟิล์มไม่ค่อยสลับ
 * → ติ๊กงานที่พิมพ์ม้วนเดียวกัน แล้วกด "พิมพ์เสร็จ" ครั้งเดียว ขั้นพิมพ์ DTF ของทุกใบปิดพร้อมกัน
 *
 * ไม่มีกฎใหม่ฝั่ง server: ปุ่มเรียกคำสั่งรอบพิมพ์เดิมต่อกัน create → markPrinted → complete (ใบแบบเดิมเท่านั้น)
 * ถ้าสะดุดกลางทาง รอบนั้นขึ้นเป็นแถบบนสุดพร้อมปุ่ม "ปิดให้เสร็จ" ทำต่อจากจังหวะที่ค้าง
 * ใบ Production V2 ต้องรายงานยอดราย quantity line — ยังกดจากหน้านี้ไม่ได้ (ติ๊กไม่ได้พร้อมบอกเหตุ)
 */

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CircleCheck, RefreshCw, SearchX, TriangleAlert } from "lucide-react";

import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { startOfBangkokDay, differenceInBangkokDays } from "@/lib/date-utils";
import { formatTime, isImageUrl } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { c, CardHead, Callout, DueTag, Thumb } from "@/components/kit/kit";
import { ProductionModuleHead } from "@/components/production/production-module-head";

type QueueEntry = RouterOutput["printRun"]["queue"][number];
type Run = RouterOutput["printRun"]["list"][number];

function coverOf(entry: QueueEntry): string | null {
  const design = entry.design;
  if (!design) return null;
  return [design.thumbnailUrl, design.fileUrl].find((url) => isImageUrl(url)) ?? null;
}

function PrintDtf() {
  const utils = trpc.useUtils();
  const meQuery = trpc.user.me.useQuery();
  const queueQuery = trpc.printRun.queue.useQuery(undefined, { refetchInterval: 30_000, refetchOnWindowFocus: true });
  const runsQuery = trpc.printRun.list.useQuery(undefined, { refetchInterval: 30_000 });
  const create = trpc.printRun.create.useMutation();
  const markPrinted = trpc.printRun.markPrinted.useMutation();
  const complete = trpc.printRun.complete.useMutation();
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const canOperate = permAllows(meQuery.data?.permissions, "manage_production");
  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data]);
  const runs = runsQuery.data ?? [];
  const nowMs = queueQuery.dataUpdatedAt || 0;
  const todayStart = nowMs > 0 ? startOfBangkokDay(nowMs).getTime() : 0;

  const selectable = queue.filter((entry) => !entry.executionEnabled && entry.remaining > 0);
  const pickedEntries = Object.entries(picked).filter(([stepId]) => selectable.some((entry) => entry.stepId === stepId));
  const pieces = pickedEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const allOn = selectable.length > 0 && selectable.every((entry) => entry.stepId in picked);
  const stuck = runs.filter((run) => run.status === "PRINTING" || run.status === "PRINTED");
  const doneToday = runs
    .filter((run) => run.status === "COMPLETED" && run.completedAt && new Date(run.completedAt).getTime() >= todayStart)
    .flatMap((run) => run.items.map((item) => ({ key: item.id, orderNumber: item.order.orderNumber, qty: item.qty, at: run.completedAt! })));

  const sync = async () => {
    await Promise.all([
      utils.printRun.queue.invalidate(),
      utils.printRun.list.invalidate(),
      utils.production.getById.invalidate(),
      utils.production.kanban.invalidate(),
    ]);
  };

  /** ปิดรอบให้จบจากจังหวะที่ค้าง: PRINTING → พิมพ์จบ → ปิดรอบ */
  async function finishRun(runId: string, status: Run["status"] | "PRINTING") {
    if (status === "PRINTING") await markPrinted.mutateAsync({ runId });
    await complete.mutateAsync({ runId });
  }

  async function printDone() {
    if (pickedEntries.length === 0 || busy) return;
    setBusy(true);
    let runId: string | null = null;
    try {
      const run = await create.mutateAsync({ items: pickedEntries.map(([stepId, qty]) => ({ stepId, qty })) });
      runId = run.id;
      await finishRun(run.id, "PRINTING");
      toast.success(`ปิดขั้นพิมพ์ DTF แล้ว ${pickedEntries.length.toLocaleString("th-TH")} ใบ`);
      setPicked({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "บันทึกไม่สำเร็จ";
      toast.error(runId ? `บันทึกยังไม่ครบ — กด "ปิดให้เสร็จ" ที่แถบด้านบน (${message})` : message);
    } finally {
      await sync();
      setBusy(false);
    }
  }

  async function resume(run: Run) {
    if (busy) return;
    setBusy(true);
    try {
      await finishRun(run.id, run.status);
      toast.success(`ปิดรอบ ${run.runNumber} แล้ว`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ปิดรอบไม่สำเร็จ");
    } finally {
      await sync();
      setBusy(false);
    }
  }

  const togglePick = (entry: QueueEntry, on: boolean) =>
    setPicked((current) => {
      const next = { ...current };
      if (on) next[entry.stepId] = entry.remaining;
      else delete next[entry.stepId];
      return next;
    });

  const loading = queueQuery.isLoading || runsQuery.isLoading || meQuery.isLoading;

  return (
    <PageShell
      title="พิมพ์ DTF"
      header={<div className="sr-only">พิมพ์ DTF</div>}
      loading={loading}
      skeleton={
        <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดคิวพิมพ์ DTF">
          <span className={c("sk")} style={{ height: 112 }} />
          <div className={c("two")}>
            <span className={c("sk")} style={{ height: 360 }} />
            <span className={c("sk")} style={{ height: 200 }} />
          </div>
        </div>
      }
      error={queueQuery.isError && !queueQuery.data ? { message: "โหลดคิวพิมพ์ไม่สำเร็จ", onRetry: () => void queueQuery.refetch() } : null}
    >
      <div className={c("tokens page mfg")}>
        {stuck.length > 0 ? (
          <div className={c("alerts")}>
            {stuck.map((run) => (
              <Callout
                key={run.id}
                icon={TriangleAlert}
                role="alert"
                action={
                  canOperate ? (
                    <button type="button" className={c("btn sm")} onClick={() => void resume(run)} disabled={busy}>
                      <RefreshCw aria-hidden="true" />
                      ปิดให้เสร็จ
                    </button>
                  ) : undefined
                }
              >
                <b>รอบ {run.runNumber} ยังปิดไม่เสร็จ</b> — {run.items.map((item) => item.order.orderNumber).join(", ")}
              </Callout>
            ))}
          </div>
        ) : null}

        <ProductionModuleHead active="dtf" title="พิมพ์ DTF" badges={{ dtf: queue.length }} />

        <div className={c("two")}>
          <section className={c("card")} aria-label="คิวพิมพ์ฟิล์ม">
            <div className={c("tblw")}>
              <table className={c("orders pqt")}>
                <caption className={c("sr")}>งานที่ไฟล์พร้อม รอพิมพ์ฟิล์ม DTF</caption>
                <colgroup>
                  <col className={c("q1")} />
                  <col />
                  <col className={c("q3")} />
                  <col className={c("q4")} />
                  <col className={c("q5")} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        className={c("chk")}
                        type="checkbox"
                        checked={allOn}
                        disabled={!canOperate || selectable.length === 0 || busy}
                        onChange={(event) => setPicked(event.target.checked ? Object.fromEntries(selectable.map((entry) => [entry.stepId, entry.remaining])) : {})}
                        aria-label="เลือกทุกงานที่พร้อม"
                      />
                    </th>
                    <th scope="col">ใบงาน</th>
                    <th scope="col">กำหนดส่ง</th>
                    <th scope="col" className={c("r")}>ต้องพิมพ์</th>
                    <th scope="col" className={c("r")}>พิมพ์ม้วนนี้</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((entry) => {
                    const on = entry.stepId in picked;
                    const v2 = entry.executionEnabled;
                    const id = `dtf-${entry.stepId}`;
                    return (
                      <tr key={entry.stepId} className={c("row", on && "picked")}>
                        <td>
                          <input
                            id={id}
                            className={c("chk")}
                            type="checkbox"
                            checked={on}
                            disabled={!canOperate || v2 || busy}
                            onChange={(event) => togglePick(entry, event.target.checked)}
                            aria-label={`เลือก ${entry.orderNumber}`}
                          />
                        </td>
                        <td>
                          <div className={c("who")}>
                            <Thumb cover={coverOf(entry)} alt={`ม็อกอัพ ${entry.orderNumber}`} />
                            <div className={c("t")}>
                              <div className={c("id")}>
                                <Link href={`/production/${entry.productionId}`} className={c("idbtn")}>
                                  <span className={c("mono")}>{entry.orderNumber}</span>
                                </Link>
                              </div>
                              <span className={c("cu")}>{entry.customerName}</span>
                              {v2 ? <span className={c("lay")}>ใบรุ่นใหม่ บันทึกจากจอสถานี</span> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <DueTag status="PRODUCING" deadline={entry.dueDate} dueInDays={nowMs > 0 ? differenceInBangkokDays(entry.dueDate, nowMs) : null} />
                        </td>
                        <td className={c("qty r")}>
                          <b>{entry.remaining.toLocaleString("th-TH")}</b>
                          <small>ชิ้น</small>
                        </td>
                        <td className={c("r")}>
                          {on ? (
                            <input
                              className={c("qin")}
                              inputMode="numeric"
                              value={picked[entry.stepId]}
                              disabled={busy}
                              onFocus={(event) => event.target.select()}
                              onChange={(event) => {
                                const qty = Math.max(1, Math.min(entry.remaining, parseInt(event.target.value.replace(/\D/g, "") || "0", 10) || 1));
                                setPicked((current) => ({ ...current, [entry.stepId]: qty }));
                              }}
                              aria-label={`จำนวนที่พิมพ์ม้วนนี้ ${entry.orderNumber}`}
                            />
                          ) : (
                            <span className={c("whoc none")}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {queue.length === 0 ? (
                <div className={c("noresult")}>
                  <SearchX aria-hidden="true" />
                  <span>ยังไม่มีงานรอพิมพ์</span>
                </div>
              ) : null}
            </div>
            <div className={c("qfoot")}>
              <span className={c("tx")}>
                {pickedEntries.length > 0 ? (
                  <>
                    เลือก <b>{pickedEntries.length.toLocaleString("th-TH")}</b> ใบ · <b>{pieces.toLocaleString("th-TH")}</b> ชิ้น
                  </>
                ) : canOperate ? (
                  "ติ๊กงานที่พิมพ์ม้วนเดียวกัน"
                ) : (
                  "ให้ทีมผลิตเป็นผู้บันทึก"
                )}
              </span>
              {pickedEntries.length > 0 ? (
                <button type="button" className={c("btn sm ghost")} onClick={() => setPicked({})} disabled={busy}>
                  ล้าง
                </button>
              ) : null}
              <button type="button" className={c("btn primary")} onClick={() => void printDone()} disabled={!canOperate || pickedEntries.length === 0 || busy}>
                <Check aria-hidden="true" />
                {busy ? "กำลังบันทึก…" : "พิมพ์เสร็จ"}
              </button>
            </div>
          </section>

          <div className={c("stack sticky")}>
            <section className={c("card")} aria-labelledby="dtf-today-h">
              <CardHead
                icon={CircleCheck}
                tone="good"
                id="dtf-today-h"
                title="พิมพ์เสร็จวันนี้"
                right={<span className={c("chip gray")}>{doneToday.length.toLocaleString("th-TH")} ใบ</span>}
              />
              <div className={c("cb")}>
                {doneToday.length > 0 ? (
                  <ol className={c("hist")}>
                    {doneToday.map((item) => (
                      <li key={item.key}>
                        <span className={c("d good")} aria-hidden="true" />
                        <span className={c("tx mono")}>{item.orderNumber}</span>
                        <span className={c("m")}>
                          <b>{item.qty.toLocaleString("th-TH")} ชิ้น</b>
                          {formatTime(item.at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={c("mempty")}>ยังไม่มี</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function PrintDtfPage() {
  return (
    <Suspense fallback={null}>
      <PrintDtf />
    </Suspense>
  );
}
