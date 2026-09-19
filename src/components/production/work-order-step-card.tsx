"use client";

/**
 * การ์ดขั้นงานของใบผลิต — ตารางรายรายการแบบเดียวกับแท็บ "รายการ" ของหน้าออเดอร์
 * (เบสสั่ง 2026-09-19: "ไม่รู้ว่างานนี้ต้องสกรีนกับเสื้อตัวไหน ควรเรียงสินค้าเป็นตารางแบบหน้าออเดอร์")
 *
 * ลายอยู่เหนือตารางของ "รายการนั้น" ไม่ใช่กองรวมทั้งใบ — และกรองเหลือเฉพาะลายที่ขั้นนี้ต้องทำ
 * ช่องกรอก ทำแล้ว/เสีย เป็นคอลัมน์ในแถวไซซ์เดียวกัน · ยอดที่พิมพ์ค้างอยู่ที่การ์ด ไม่ใช่ที่ตาราง
 * จึงไม่หายเมื่อข้อมูลรีเฟรชระหว่างพิมพ์ (ปัญหาเดิมของตารางที่ถือ state เอง)
 *
 * ไม่มีเงินในไฟล์นี้ และ production.getById ก็ไม่ส่งเงินมา (SPEC: ใบผลิตห้ามมีเงินแม้เป็นเจ้าของ)
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Flame, Printer, Shirt, Truck, Wrench } from "lucide-react";

import { c, CardHead, DueTag, Prop } from "@/components/kit/kit";
import { ItemHead, PrintStrip, ProductCell } from "@/components/order-items/item-parts";
import { itemPieceRows, itemQty, itemRowStarts, productName, productSpans, sizeCountOf, type PieceRow, type PrintLike } from "@/components/order-items/rows";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { GarmentReceiveInline } from "@/components/production/garment-receive-inline";
import { printTypesForProductionStep } from "@/components/production/production-design-card";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { heatLabel } from "@/lib/print-heat";
import { FLOW_OWNED_STEP_TYPES, isOutsourceStep } from "@/lib/production-steps";
import { formatDateShort } from "@/lib/utils";
import { pieceTableAnchor } from "./work-order-anchors";
import { activeOutsource, daysFromNow, stepLabel, viewOf } from "./work-order-pieces";
import type { WorkOrderController } from "./work-order-controller";

type Order = ProductionDetail["order"];
type OrderItem = Order["items"][number];
type OrderPrint = OrderItem["prints"][number];
type RowQty = { done: number; waste: number };

const CHIP_TONE = { success: "good", info: "blue", warning: "warn", error: "bad", neutral: "gray" } as const;

export function stepIcon(step: ProductionStep): LucideIcon {
  if (activeOutsource(step) || isOutsourceStep(step.stepType)) return Truck;
  if (step.stepType === "HEAT_PRESS") return Flame;
  if (step.stepType === "DTF_PRINT") return Printer;
  if (step.stepType === "GARMENT_PICK" || step.stepType === "GARMENT_RECEIVE") return Shirt;
  return Wrench;
}

/** ลายที่ขั้นนี้ต้องทำ — ขั้นที่ทำแต่ตัวเสื้อ (เบิก/ตรวจรับ/แพ็ก) ไม่ต้องเห็นลายของขั้นอื่น */
export function printsForStep(item: OrderItem, stepType: string | undefined): OrderPrint[] {
  const allowed = printTypesForProductionStep(stepType);
  if (!allowed) return item.prints;
  if (allowed.length === 0) return [];
  return item.prints.filter((print) => allowed.includes(print.printType));
}

/** ค่ารีดของลายขึ้นเฉพาะขั้นรีดร้อน — ขั้นอื่นไม่ได้ใช้ค่านี้ */
const heatNote = (stepType: string) => (print: PrintLike) =>
  stepType === "HEAT_PRESS" && print.artwork
    ? heatLabel({
        tempC: print.artwork.heatTempC ?? null,
        pressSec: print.artwork.heatPressSec ?? null,
        pressure: print.artwork.heatPressure ?? null,
      })
    : null;

function QtyCell({
  row,
  field,
  label,
  value,
  editable,
  pending,
  onChange,
}: {
  row: PieceRow;
  field: keyof RowQty;
  label: string;
  value: number;
  editable: boolean;
  pending: boolean;
  onChange: (next: number) => void;
}) {
  const canEdit = editable && Boolean(row.variantId);
  return (
    <td className={c("inp")}>
      <input
        className={c("qin", field === "done" && value === row.qty && "full", value === 0 && "zero")}
        style={field === "waste" && value > 0 ? ({ color: "var(--warn)" } as CSSProperties) : undefined}
        inputMode="numeric"
        value={row.variantId ? value : "—"}
        disabled={!canEdit || pending}
        onChange={(event) => onChange(Math.max(0, Math.min(row.qty, parseInt(event.target.value.replace(/\D/g, "") || "0", 10))))}
        onFocus={(event) => event.target.select()}
        aria-label={`${label} ${[productName(row.prod), row.color, row.size].filter(Boolean).join(" ")}`}
      />
    </td>
  );
}

/** คอลัมน์เดียวกันทุกตารางในการ์ด รวมแถวรวมทั้งใบ — ตัวเลขจึงตรงแนวกันทั้งใบ */
function Cols({ showQty }: { showQty: boolean }) {
  return (
    <colgroup>
      <col className={c("c-no")} />
      <col />
      <col className={c("c-sz")} />
      <col className={c("c-ord")} />
      {showQty ? <col className={c("c-in")} /> : null}
      {showQty ? <col className={c("c-in")} /> : null}
    </colgroup>
  );
}

export function WorkOrderStepCard({
  step,
  ctl,
  footer,
}: {
  step: ProductionStep;
  ctl: WorkOrderController;
  /** ปุ่มของขั้น — กติกาว่ากดอะไรได้อยู่ที่ตัวหน้า ไม่ใช่ที่การ์ด */
  footer?: ReactNode;
}) {
  const order = ctl.order;
  const production = ctl.production;
  const items = useMemo(() => order?.items ?? [], [order]);
  const rowStarts = itemRowStarts(items);
  const allRows = useMemo(() => items.flatMap((item) => itemPieceRows(item)), [items]);
  const variantRows = allRows.filter((row) => row.variantId);

  const counting = step.qtyTotal !== null && step.qtyTotal > 0;
  const outsource = activeOutsource(step);
  const editable =
    counting &&
    ctl.canUpdateStep &&
    ctl.canOwnOrSupervise(step) &&
    step.status !== "COMPLETED" &&
    step.status !== "FAILED" &&
    !FLOW_OWNED_STEP_TYPES.has(step.stepType) &&
    !outsource;

  const saved = useMemo(() => {
    const map: Record<string, RowQty> = {};
    for (const q of step.quantities) if (q.sourceOrderItemVariantId) map[q.sourceOrderItemVariantId] = { done: q.qtyGood, waste: q.qtyScrap };
    return map;
  }, [step.quantities]);
  const [draft, setDraft] = useState<Record<string, RowQty>>({});
  const valueOf = (key: string): RowQty => draft[key] ?? saved[key] ?? { done: 0, waste: 0 };
  const showQty = editable || step.quantities.length > 0;
  const dirty = variantRows.some((row) => {
    const d = draft[row.key];
    if (!d) return false;
    const s = saved[row.key] ?? { done: 0, waste: 0 };
    return d.done !== s.done || d.waste !== s.waste;
  });
  const setRow = (key: string, patch: Partial<RowQty>) => setDraft((d) => ({ ...d, [key]: { ...valueOf(key), ...patch } }));
  const sumOf = (rows: PieceRow[], field: keyof RowQty) => rows.reduce((sum, row) => sum + valueOf(row.key)[field], 0);
  const total = allRows.reduce((sum, row) => sum + row.qty, 0);

  const view = viewOf(step, ctl.nowById.get(step.id));
  const iconTone = view.state === "blocked" ? "bad" : view.state === "held" || outsource ? "warn" : "blue";
  const Icon = stepIcon(step);
  const notePrint = heatNote(step.stepType);

  return (
    <section className={c("card stepcard")} aria-labelledby={`st-${step.id}`}>
      <CardHead
        icon={Icon}
        tone={iconTone}
        id={`st-${step.id}`}
        title={
          <>
            {stepLabel(step)}
            {counting ? (
              <small>
                {" "}
                {(step.qtyDone ?? 0).toLocaleString("th-TH")} / {step.qtyTotal!.toLocaleString("th-TH")} ตัว
              </small>
            ) : null}
          </>
        }
        right={<span className={c("chip", CHIP_TONE[view.chip])}>{outsource ? "อยู่ร้านนอก" : view.label}</span>}
      />
      <div className={c("cb")}>
        {outsource ? (
          <dl className={c("props")} style={{ marginBottom: 16 }}>
            <Prop label="ร้าน">{outsource.vendor.name}</Prop>
            <Prop label="นัดรับกลับ" none={!outsource.expectedBackAt}>
              {outsource.expectedBackAt ? (
                <DueTag status="PRODUCING" deadline={outsource.expectedBackAt} dueInDays={daysFromNow(outsource.expectedBackAt, ctl.nowMs)} small={false} />
              ) : (
                "ยังไม่นัด"
              )}
            </Prop>
            <Prop label="งานที่ส่ง">
              {outsource.description || stepLabel(step)}
              <small>
                {outsource.quantity.toLocaleString("th-TH")} ตัว{outsource.sentAt ? ` · ส่ง ${formatDateShort(outsource.sentAt)}` : ""}
              </small>
            </Prop>
            {outsource.notes ? <Prop label="หมายเหตุร้าน">{outsource.notes}</Prop> : null}
          </dl>
        ) : null}

        {step.stepType === "GARMENT_PICK" && production ? (
          <div className={c("embed")}>
            <GarmentPickCard
              productionId={production.id}
              steps={ctl.workflowSteps}
              stepId={step.id}
              canIssueGarments={ctl.canUpdateStep && ctl.canOwnOrSupervise(step)}
              canReturnGarments={ctl.canSuperviseStep && ctl.hasProductionPermission && !ctl.writeDataStale}
              primaryTask
            />
          </div>
        ) : step.stepType === "GARMENT_RECEIVE" && order ? (
          <div className={c("embed")}>
            <GarmentReceiveInline
              orderId={order.id}
              productionStepId={step.id}
              canRecord={ctl.canUpdateStep && ctl.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED"}
              canCorrect={ctl.canSuperviseStep && ctl.hasProductionPermission && step.status === "COMPLETED"}
            />
          </div>
        ) : allRows.length === 0 ? (
          <p className={c("mempty")} style={{ padding: 0 }}>
            ออเดอร์นี้ยังไม่มีรายการสินค้า
          </p>
        ) : (
          <>
            {editable ? (
              <div className={c("qbar")}>
                <span className={c("t", dirty && "dirty")} aria-live="polite">
                  {dirty ? "ยังไม่บันทึก" : ""}
                </span>
                {variantRows.length > 0 ? (
                  <button
                    type="button"
                    className={c("btn sm")}
                    onClick={() => setDraft(Object.fromEntries(variantRows.map((row) => [row.key, { done: row.qty, waste: valueOf(row.key).waste }])))}
                    disabled={ctl.piecePending}
                  >
                    ใส่ครบทุกไซซ์
                  </button>
                ) : (
                  <button type="button" className={c("btn sm")} onClick={() => ctl.openQty(step.id)}>
                    บันทึกยอด
                  </button>
                )}
                {dirty ? (
                  <button
                    type="button"
                    className={c("btn sm primary")}
                    onClick={() => ctl.savePieceQty(step.id, variantRows.map((row) => ({ variantId: row.variantId!, ...valueOf(row.key) })))}
                    disabled={ctl.piecePending}
                  >
                    บันทึกยอด
                  </button>
                ) : null}
              </div>
            ) : null}

            <div id={pieceTableAnchor(step.id)} role="region" aria-label={`รายการเสื้อ ขั้น${stepLabel(step)}`}>
              {items.map((item, index) => {
                const rows = itemPieceRows(item);
                if (rows.length === 0) return null;
                const spans = productSpans(rows);
                const prints = printsForStep(item, step.stepType);
                return (
                  <div key={item.id} className={c("item")}>
                    <ItemHead item={item} index={index} prints={prints} right={<span className={c("chip gray iq")}>{itemQty(item).toLocaleString("th-TH")} ตัว</span>} />
                    <PrintStrip prints={prints} extraNote={notePrint} />
                    <div className={c("tblw")}>
                      <table className={c("tbl")}>
                        <caption className={c("sr")}>
                          ยอดต่อไซซ์ {item.description || `รายการที่ ${index + 1}`} ขั้น{stepLabel(step)}
                        </caption>
                        <Cols showQty={showQty} />
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">สินค้า</th>
                            <th scope="col" className={c("szc")}>
                              ไซซ์
                            </th>
                            <th scope="col" className={c("num")}>
                              สั่ง
                            </th>
                            {showQty ? (
                              <th scope="col" className={c("num inh")}>
                                ทำแล้ว
                              </th>
                            ) : null}
                            {showQty ? (
                              <th scope="col" className={c("num inh")}>
                                เสีย
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const value = valueOf(row.key);
                            return (
                              <tr key={row.key}>
                                <td className={c("rno")}>{rowStarts[index] + i + 1}</td>
                                {spans[i] > 0 ? <ProductCell row={row} rowSpan={spans[i]} /> : null}
                                <td className={c("szc")}>
                                  {row.size ? <b>{row.size}</b> : <span style={{ color: "var(--ink-4)" }}>—</span>}
                                </td>
                                <td className={c("num")}>{row.qty.toLocaleString("th-TH")}</td>
                                {showQty ? (
                                  <QtyCell row={row} field="done" label="ทำแล้ว" value={value.done} editable={editable} pending={ctl.piecePending} onChange={(done) => setRow(row.key, { done })} />
                                ) : null}
                                {showQty ? (
                                  <QtyCell row={row} field="waste" label="เสีย" value={value.waste} editable={editable} pending={ctl.piecePending} onChange={(waste) => setRow(row.key, { waste })} />
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className={c("lbl")} colSpan={2}>
                              รวมรายการนี้
                            </td>
                            <td className={c("szc")}>{sizeCountOf(rows)} ไซซ์</td>
                            <td className={c("num")}>{rows.reduce((sum, row) => sum + row.qty, 0).toLocaleString("th-TH")}</td>
                            {showQty ? <td className={c("num inh")}>{sumOf(rows, "done").toLocaleString("th-TH")}</td> : null}
                            {showQty ? (
                              <td className={c("num inh", sumOf(rows, "waste") > 0 && "warn")}>{sumOf(rows, "waste").toLocaleString("th-TH")}</td>
                            ) : null}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
              {items.length > 1 ? (
                <div className={c("item")}>
                  <div className={c("tblw")}>
                    <table className={c("tbl")}>
                      <Cols showQty={showQty} />
                      <tfoot>
                        <tr>
                          <td className={c("lbl")} colSpan={3}>
                            รวมทั้งใบ
                          </td>
                          <td className={c("num")}>{total.toLocaleString("th-TH")}</td>
                          {showQty ? <td className={c("num inh")}>{sumOf(variantRows, "done").toLocaleString("th-TH")}</td> : null}
                          {showQty ? (
                            <td className={c("num inh", sumOf(variantRows, "waste") > 0 && "warn")}>
                              {sumOf(variantRows, "waste").toLocaleString("th-TH")}
                            </td>
                          ) : null}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
      {footer}
    </section>
  );
}
