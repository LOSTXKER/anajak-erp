import { useMemo, useState, type ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { NumberInput } from "@/components/ui/number-input";
import { Section } from "@/components/ui/section";
import { CONTROL_H } from "@/components/ui/control-size";
import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import type { ProductionDetail, ProductionStep } from "./types";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { PRINT_POSITIONS, PRINT_TYPES, PRODUCT_TYPES } from "@/types/order-form";
import { cn, isImageUrl } from "@/lib/utils";
import type { WorkOrderController } from "./work-order-controller";
import { activeOutsource, stepLabel, viewOf } from "./work-order-pieces";

export const pieceTableAnchor = (stepId: string) => `work-order-pieces-${stepId}`;

/* ───────────────────────── ซ้าย: ตารางรายตัวของขั้นที่ยืนอยู่ ───────────────────────── */

const TH = "px-3 py-3 text-xs font-medium";
const TD = "px-3 py-3 align-middle text-sm";

type PieceRow = { key: string; productId: string; variantId: string | null; product: string; productColor: string | null; color: string | null; size: string | null; qty: number; thumb: string | null; prints: string[] };
type RowQty = { done: number; waste: number };

/** แถวละไซซ์จาก order.items ของใบผลิต (ชุดเดียวกับตารางรายการหน้าออเดอร์) */
export function pieceRowsOf(order: ProductionDetail["order"]): PieceRow[] {
  return order.items.flatMap((item) => {
    const prints = item.prints.map((p) => `${PRINT_POSITIONS[p.position] ?? p.position} ${PRINT_TYPES[p.printType] ?? p.printType}`);
    const thumbSrc = item.prints.map((p) => p.artwork?.imageUrl ?? p.designImageUrl).find((u) => isImageUrl(u)) ?? null;
    return item.products.flatMap((prod): PieceRow[] => {
      const name = prod.description || PRODUCT_TYPES[prod.productType ?? ""] || "สินค้า";
      const productColor = prod.fabricColor ?? null;
      if (prod.variants.length === 0) return [{ key: prod.id, productId: prod.id, variantId: null, product: name, productColor, color: productColor, size: null, qty: prod.totalQuantity ?? 0, thumb: thumbSrc, prints }];
      return prod.variants.map((v) => ({ key: v.id, productId: prod.id, variantId: v.id, product: name, productColor, color: v.color ?? productColor, size: v.size || null, qty: v.quantity, thumb: thumbSrc, prints }));
    });
  });
}

/** ตารางรายตัว: แถวละไซซ์ · ขั้นที่นับยอดกรอก "ทำแล้ว/เสีย" ต่อแถวได้ — ยอดรวมของขั้น = ผลบวก (server) */
export function StepPieceTable({ step, order, c, stepAction }: { step: ProductionStep; order: ProductionDetail["order"]; c: WorkOrderController; stepAction?: ReactNode }) {
  const rows = pieceRowsOf(order);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const groups = new Map<string, PieceRow[]>();
  for (const row of rows) {
    const group = groups.get(row.productId);
    if (group) group.push(row);
    else groups.set(row.productId, [row]);
  }
  const counting = step.qtyTotal !== null && step.qtyTotal > 0;
  // ของอยู่ร้านนอก = ยอดมาจากใบตรวจรับตอนรับกลับ ไม่กรอกเอง
  const editable = counting && c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED" && !FLOW_OWNED_STEP_TYPES.has(step.stepType) && !activeOutsource(step);
  const view = viewOf(step, c.nowById.get(step.id));
  const saved = useMemo(() => {
    const map: Record<string, RowQty> = {};
    for (const q of step.quantities) if (q.sourceOrderItemVariantId) map[q.sourceOrderItemVariantId] = { done: q.qtyGood, waste: q.qtyScrap };
    return map;
  }, [step.quantities]);
  const [draft, setDraft] = useState<Record<string, RowQty>>({});
  const valueOf = (key: string): RowQty => draft[key] ?? saved[key] ?? { done: 0, waste: 0 };
  const variantRows = rows.filter((r) => r.variantId);
  const showQty = editable || step.quantities.length > 0;
  const dirty = variantRows.some((r) => {
    const d = draft[r.key];
    if (!d) return false;
    const s = saved[r.key] ?? { done: 0, waste: 0 };
    return d.done !== s.done || d.waste !== s.waste;
  });
  const doneSum = variantRows.reduce((n, r) => n + valueOf(r.key).done, 0);
  const wasteSum = variantRows.reduce((n, r) => n + valueOf(r.key).waste, 0);
  const setRow = (key: string, patch: Partial<RowQty>) => setDraft((d) => ({ ...d, [key]: { ...valueOf(key), ...patch } }));
  const fillAll = () => setDraft(Object.fromEntries(variantRows.map((r) => [r.key, { done: r.qty, waste: 0 }])));
  const save = () => c.savePieceQty(step.id, variantRows.map((r) => ({ variantId: r.variantId!, ...valueOf(r.key) })));

  return (
    <Section
      title={stepLabel(step)}
      meta={counting ? <span className="tabular-nums">{(step.qtyDone ?? 0).toLocaleString("th-TH")} / {step.qtyTotal!.toLocaleString("th-TH")} ตัว</span> : undefined}
      action={
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <InfoChip size="sm" tone={view.chip}>{view.label}</InfoChip>
          {stepAction}
        </div>
      }
      flush
    >
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-5 py-3">
          <span className="text-xs text-muted" aria-live="polite">{dirty ? "ยอดที่แก้ยังไม่บันทึก" : variantRows.length > 0 ? `${variantRows.length.toLocaleString("th-TH")} ไซซ์` : "ยอดรวมของขั้น"}</span>
          <div className="flex flex-wrap items-center gap-2">
            {variantRows.length > 0 ? (
              <Button size="sm" variant="outline" onClick={fillAll} disabled={c.piecePending}>
                ใส่ครบทุกไซซ์
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => c.openQty(step.id)}>
                บันทึกยอด
              </Button>
            )}
            {dirty ? (
              <Button size="sm" onClick={save} disabled={c.piecePending}>
                บันทึกยอด
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState icon={ImageIcon} title="ออเดอร์นี้ยังไม่มีรายการเสื้อ" />
      ) : (
        <div id={pieceTableAnchor(step.id)} role="region" aria-label={`รายการเสื้อ ขั้น${stepLabel(step)}`}>
          <div className="divide-y divide-divider">
            {[...groups].map(([productId, productRows]) => {
              const product = productRows[0]!;
              return (
                <div key={productId}>
                  <div className="flex items-start gap-3 px-5 py-4">
                    {product.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- รูปลายจากคลัง/ไฟล์ที่อัปโหลด
                      <img src={product.thumb} alt="" className={cn("h-14 w-14 shrink-0 border border-border bg-surface-muted object-contain", RADIUS.inner)} />
                    ) : (
                      <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center border border-border bg-surface-muted", RADIUS.inner)}>
                        <ImageIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-semibold text-strong [overflow-wrap:anywhere]">{product.product}</h3>
                      {product.productColor ? <p className="text-sm text-secondary">{product.productColor}</p> : null}
                      {product.prints.length > 0 ? (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
                          {product.prints.map((print, index) => <li key={`${print}-${index}`}>{print}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <caption className="sr-only">ไซซ์และยอด {product.product} ขั้น{stepLabel(step)}</caption>
                      <colgroup>
                        <col />
                        <col style={{ width: showQty ? "23%" : "35%" }} />
                        {showQty ? <col style={{ width: "26%" }} /> : null}
                        {showQty ? <col style={{ width: "26%" }} /> : null}
                      </colgroup>
                      <thead className={TABLE_HEAD_SURFACE}>
                        <tr>
                          <th scope="col" className={cn(TH, "pl-5 text-left")}>ไซซ์</th>
                          <th scope="col" className={cn(TH, "text-right", !showQty && "pr-5")}>จำนวน</th>
                          {showQty ? <th scope="col" className={cn(TH, "text-right")}>ทำแล้ว</th> : null}
                          {showQty ? <th scope="col" className={cn(TH, "pr-5 text-right")}>เสีย</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider">
                        {productRows.map((row) => {
                          const value = valueOf(row.key);
                          const rowLabel = [row.product, row.color, row.size].filter(Boolean).join(" ");
                          return (
                            <tr key={row.key} className="focus-within:bg-surface-muted">
                              <td className={cn(TD, "pl-5")}>
                                <p className="text-base font-semibold text-strong">{row.size ?? "ไม่ระบุ"}</p>
                                {row.color && row.color !== product.productColor ? <p className="text-xs text-secondary [overflow-wrap:anywhere]">{row.color}</p> : null}
                              </td>
                              <td className={cn(TD, "text-right text-base font-semibold tabular-nums text-strong", !showQty && "pr-5")}>{row.qty.toLocaleString("th-TH")}</td>
                              {showQty ? (
                                <td className={cn(TD, "text-right")}>
                                  {editable && row.variantId ? (
                                    <NumberInput integer min={0} max={row.qty} value={value.done} onValueChange={(n) => setRow(row.key, { done: n })} disabled={c.piecePending} placeholder="0" aria-label={`ทำแล้ว ${rowLabel}`} className={cn(CONTROL_H, "w-full text-right")} />
                                  ) : (
                                    <span className={cn("tabular-nums", value.done > 0 ? "font-semibold text-strong" : "text-muted")}>{row.variantId ? value.done.toLocaleString("th-TH") : "—"}</span>
                                  )}
                                </td>
                              ) : null}
                              {showQty ? (
                                <td className={cn(TD, "pr-5 text-right")}>
                                  {editable && row.variantId ? (
                                    <NumberInput integer min={0} max={row.qty} value={value.waste} onValueChange={(n) => setRow(row.key, { waste: n })} disabled={c.piecePending} placeholder="0" aria-label={`เสีย ${rowLabel}`} className={cn(CONTROL_H, "w-full text-right")} />
                                  ) : (
                                    <span className={cn("tabular-nums", value.waste > 0 ? "font-semibold text-strong" : "text-muted")}>{row.variantId ? value.waste.toLocaleString("th-TH") : "—"}</span>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={cn("grid items-center border-t border-divider bg-surface-muted py-4", showQty ? "grid-cols-[25%_23%_26%_26%]" : "grid-cols-[65%_35%]")}>
            <span className="pl-5 text-xs text-muted">รวมทั้งใบ</span>
            <Metric size="sm" value={total.toLocaleString("th-TH")} unit="ตัว" className={cn("px-3 text-right", !showQty && "pr-5")} />
            {showQty ? <Metric size="sm" value={doneSum.toLocaleString("th-TH")} className="px-3 text-right" /> : null}
            {showQty ? <Metric size="sm" value={wasteSum.toLocaleString("th-TH")} className="pl-3 pr-5 text-right" tone={wasteSum > 0 ? "warning" : undefined} /> : null}
          </div>
        </div>
      )}
    </Section>
  );
}
