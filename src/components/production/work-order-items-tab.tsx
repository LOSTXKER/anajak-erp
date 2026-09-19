"use client";

/**
 * แท็บ "สินค้า" ของใบผลิต — ตารางรายรายการชุดเดียวกับการ์ดขั้นงานและหน้าออเดอร์
 * ต่างกันที่ไม่มีช่องกรอกยอด และแสดงลายครบทุกวิธีพิมพ์ (ไม่กรองตามขั้น)
 */

import { ClipboardCheck, ImageOff, PackageCheck, Printer, Shirt } from "lucide-react";

import { c, CardHead, Prop } from "@/components/kit/kit";
import { ItemHead, PrintStrip, ProductCell } from "@/components/order-items/item-parts";
import {
  itemPieceRows,
  itemQty,
  itemRowStarts,
  positionLabel,
  printDims,
  printSizeLabel,
  productSpans,
  sizeCountOf,
  techLabel,
  unique,
} from "@/components/order-items/rows";
import { MaterialUsage } from "@/components/material-usage";
import type { ProductionDetail } from "@/components/production/types";
import { orderMockupCover } from "@/lib/mockup";
import { formatDateShort } from "@/lib/utils";
import type { WorkOrderController } from "./work-order-controller";

type Order = ProductionDetail["order"];

/** ไซซ์รวมทั้งใบ — ข้ามรายการ ใช้ตอนแพ็กและตอนนับของเข้า */
function sizeTotals(order: Order): [string, number][] {
  const sizes = new Map<string, number>();
  for (const item of order.items) {
    for (const prod of item.products) {
      for (const variant of prod.variants) {
        const key = [variant.color !== prod.fabricColor ? variant.color : null, variant.size].filter(Boolean).join(" ") || "ไม่ระบุไซซ์";
        sizes.set(key, (sizes.get(key) ?? 0) + variant.quantity);
      }
    }
  }
  return [...sizes];
}

export function WorkOrderItemsTab({ order, production, ctl }: { order: Order; production: ProductionDetail; ctl: WorkOrderController }) {
  const approved = order.designs[0] ?? null;
  const mockup = approved ? orderMockupCover(order) : null;
  const rowStarts = itemRowStarts(order.items);
  const totalQty = order.items.reduce((sum, item) => sum + itemQty(item), 0);
  const prints = unique(
    order.items.flatMap((item) =>
      item.prints.map((print) => {
        const dims = printDims(print);
        const size = printSizeLabel(print);
        const sizeText = dims ? `${dims} ซม.` : size !== "—" ? size : null;
        return `${techLabel(print)} ${positionLabel(print)}${sizeText ? ` · ${sizeText}` : ""}`;
      }),
    ),
  );

  return (
    <>
      <div className={c("two wide")}>
        <section className={c("card")} aria-labelledby="wo-items-h">
          <CardHead
            icon={PackageCheck}
            tone="blue"
            title={
              <>
                <span id="wo-items-h">รายการสินค้า</span>
                {totalQty > 0 ? <span className={c("chip gray")}>{totalQty.toLocaleString("th-TH")} ตัว</span> : null}
              </>
            }
          />
          <div className={c("cb")}>
            {order.items.length === 0 ? (
              <p className={c("mempty")} style={{ padding: 0 }}>
                ออเดอร์นี้ยังไม่มีรายการสินค้า
              </p>
            ) : (
              order.items.map((item, index) => {
                const rows = itemPieceRows(item);
                const spans = productSpans(rows);
                return (
                  <div key={item.id} className={c("item")}>
                    <ItemHead item={item} index={index} right={<span className={c("chip gray iq")}>{itemQty(item).toLocaleString("th-TH")} ตัว</span>} />
                    <PrintStrip prints={item.prints} />
                    {rows.length > 0 ? (
                      <div className={c("tblw")}>
                        <table className={c("tbl")}>
                          <colgroup>
                            <col className={c("c-no")} />
                            <col />
                            <col className={c("c-sz")} />
                            <col className={c("c-ord")} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">สินค้า</th>
                              <th scope="col" className={c("szc")}>
                                ไซซ์
                              </th>
                              <th scope="col" className={c("num")}>
                                จำนวน
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={row.key}>
                                <td className={c("rno")}>{rowStarts[index] + i + 1}</td>
                                {spans[i] > 0 ? <ProductCell row={row} rowSpan={spans[i]} /> : null}
                                <td className={c("szc")}>{row.size ? <b>{row.size}</b> : <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                                <td className={c("num")}>
                                  <b>{row.qty.toLocaleString("th-TH")}</b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td className={c("lbl")} colSpan={2}>
                                รวมรายการนี้
                              </td>
                              <td className={c("szc")}>{sizeCountOf(rows)} ไซซ์</td>
                              <td className={c("num")}>{itemQty(item).toLocaleString("th-TH")}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className={c("stack")}>
          <section className={c("card")} aria-labelledby="wo-mock-h">
            <CardHead
              icon={ClipboardCheck}
              tone="violet"
              id="wo-mock-h"
              title="ม็อกอัพ"
              right={approved ? <span className={c("chip good")}>อนุมัติ v{approved.versionNumber}</span> : <span className={c("chip warn")}>ยังไม่มี</span>}
            />
            <div className={c("cb")}>
              <div className={c("canvas")}>
                {mockup ? (
                  <a href={mockup} target="_blank" rel="noreferrer" aria-label="เปิดม็อกอัพเต็มจอ">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ไฟล์ม็อกอัพที่อัปโหลด */}
                    <img src={mockup} alt={`ม็อกอัพ ${order.orderNumber}`} />
                  </a>
                ) : (
                  <span className={c("e")}>
                    <ImageOff aria-hidden="true" />
                    ยังไม่มีม็อกอัพที่อนุมัติ
                  </span>
                )}
              </div>
              {approved?.approvedAt ? <p className={c("caption")}>อนุมัติ {formatDateShort(approved.approvedAt)}</p> : null}
            </div>
          </section>

          <section className={c("card")} aria-labelledby="wo-spec-h">
            <CardHead icon={Shirt} tone="violet" id="wo-spec-h" title="สเปกงาน" />
            <div className={c("cb")}>
              <dl className={c("props one")}>
                {prints.length > 0 ? (
                  <Prop icon={Printer} label="ลาย">
                    {prints.map((line) => (
                      <span key={line} style={{ display: "block" }}>
                        {line}
                      </span>
                    ))}
                  </Prop>
                ) : null}
                <Prop icon={PackageCheck} label="ไซซ์รวมทั้งใบ" none={totalQty === 0}>
                  {totalQty > 0 ? (
                    <span className={c("sizes")}>
                      {sizeTotals(order).map(([size, quantity]) => (
                        <span key={size}>
                          {size}
                          <b>{quantity.toLocaleString("th-TH")}</b>
                        </span>
                      ))}
                    </span>
                  ) : (
                    "ยังไม่ได้ใส่ไซซ์"
                  )}
                </Prop>
              </dl>
            </div>
          </section>
        </div>
      </div>
      <div className={c("embed")}>
        <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={ctl.canSeeCost} readOnly={!ctl.canUpdateStep} embedded />
      </div>
    </>
  );
}
