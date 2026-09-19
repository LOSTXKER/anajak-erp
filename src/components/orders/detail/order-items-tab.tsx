"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  PackageCheck,
  PenLine,
  Plus,
  Printer,
  Receipt,
  Shirt,
  StickyNote,
  Wallet,
} from "lucide-react";
import { OrderChangeOrders } from "@/components/orders/detail/order-change-orders";
import { c, CardHead, Empty, Prop, SubHead } from "@/components/kit/kit";
import { ItemHead, PrintStrip, ProductCell } from "@/components/order-items/item-parts";
import {
  itemPieceRows,
  itemQty,
  itemRowStarts,
  positionLabel,
  printDims,
  printSizeLabel,
  productName,
  productQty,
  productSpans,
  sizeCountOf,
  techLabel,
  unique,
} from "@/components/order-items/rows";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { formatBaht } from "@/lib/utils";
import {
  BODY_FITS,
  COLLAR_TYPES,
  FABRIC_TYPES,
  GARMENT_CONDITIONS,
  PRICING_TYPE_LABELS,
  PRODUCT_TYPES,
  SLEEVE_TYPES,
} from "@/types/order-form";
import type { PricingType } from "@/types/order-form";

/* ============================================================
   แท็บ "รายการ" — ต้นแบบ tabItems() ทีละชิ้น (รื้อ 2026-09-15)

   ชุดงานซ้าย (การ์ดรายการสินค้า + ใบแก้ไข CO) · สรุปราคาขวา (sticky)
   ชุดงานละกล่อง .item: หัว (เลข · ชื่อ · ที่มาเสื้อ · วิธีพิมพ์ · จำนวน/ยอด) → ตรวจรับเสื้อลูกค้า →
   สเปกตัดเย็บ → ตารางเสื้อแถวละสี/ไซซ์ (ลายของชุดงานแปะทุกแถว) → ส่วนเสริม → หมายเหตุ
   สูตรแถว = จำนวน × (ราคาเสื้อสุทธิ + ค่าสกรีนทุกลาย) ชุดเดียวกับ OrderItemsDisplay เดิม · ยอดชุดงาน/ทั้งใบมาจาก server
   role ที่ไม่เห็นเงิน: การ์ดขวาเป็น "สเปกงาน" แทนสรุปราคา

   ⚠️ แท็บถูกคง DOM ไว้ตอนสลับ → เงินต้อง gate ด้วย {showMoney && ...} ที่ JSX เท่านั้น ห้ามซ่อนด้วยคลาส
   ตัววาดหัวรายการ/แถบลาย/ช่องสินค้า ใช้ร่วมกับใบผลิตที่ components/order-items (2026-09-20)
   ที่นี่เหลือเฉพาะของฝั่งขาย: ราคา ตรวจรับเสื้อลูกค้า สเปกตัดเย็บ ส่วนเสริม ค่าบริการ
   ============================================================ */

type OrderData = RouterOutput["order"]["getById"];
type OrderItem = OrderData["items"][number];
type OrderItemProduct = OrderItem["products"][number];
type OrderItemPrint = OrderItem["prints"][number];
type OrderFee = OrderData["fees"][number];

interface OrderItemsTabProps {
  orderId: string;
  items: OrderData["items"];
  fees: OrderData["fees"];
  /** ไม่ส่งมา = ไม่มีสิทธิ์แก้ ปุ่มแก้ไขไม่ต้องขึ้น */
  onEditItems?: () => void;
  /** นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นราคา — false = ไม่มีคอลัมน์/ยอดเงินใน DOM เลย (ห้ามโชว์ ฿0) */
  showMoney: boolean;
  /** โฟลว์เดิม: แก้สภาพ/หมายเหตุเสื้อที่ลูกค้าส่งมาได้ · Production V2 ให้จุดเตรียมงานเป็นเจ้าของ */
  canEditReceiveTracking: boolean;
  totals: { discount: number; taxRate: number; taxAmount: number | null; totalAmount: number };
  /** ปุ่ม "เงินและบิลของใบนี้" ในสรุปราคา */
  onOpenMoney?: () => void;
}

/* ---------------------------------------------------------------- ตัวเลขเฉพาะฝั่งเงิน
   ตัวเลข/ป้ายที่ใช้ร่วมกับใบผลิต ย้ายไป components/order-items/rows.ts แล้ว (2026-09-20)
   เหลือที่นี่เฉพาะสูตรเงิน ซึ่งใบผลิตต้องไม่มี */

function netUnitPrice(prod: OrderItemProduct): number {
  return Math.max(0, (prod.baseUnitPrice ?? 0) - (prod.discount ?? 0));
}

function printPerPiece(prints: OrderItemPrint[]): number {
  return prints.reduce((s, p) => s + (p.unitPrice ?? 0), 0);
}

const sourceLabel = (prod: OrderItemProduct) =>
  prod.itemSource ? getProductSourcePresentation(prod.itemSource).label : null;

/** ป้ายช่องกรอกในแถวตรวจรับ — ต้นแบบไม่มีคลาส .field จึงเขียน inline */
const FIELD_LABEL = { fontSize: 11.5, color: "var(--ink-3)" } as const;

/* ---------------------------------------------------------------- ตรวจรับเสื้อจากลูกค้า */

/** แถว .state ใต้หัวชุดงาน — ตรวจรับแล้ว = เขียว · ยังไม่มีหลักฐาน = ส้ม · แก้สภาพ/หมายเหตุได้เมื่อมีสิทธิ์ (โฟลว์เดิม) */
function ReceiveState({
  prod,
  orderId,
  readOnly,
  showName,
}: {
  prod: OrderItemProduct;
  orderId: string;
  readOnly: boolean;
  showName: boolean;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState(prod.garmentCondition ?? "");
  const [note, setNote] = useState(prod.receiveNote ?? "");
  const mutation = trpc.order.updateReceiveTracking.useMutation({
    onSuccess: () => {
      setEditing(false);
      void utils.order.getById.invalidate({ id: orderId });
    },
  });

  const qty = productQty(prod);
  const conditionText = prod.garmentCondition
    ? `สภาพ${GARMENT_CONDITIONS[prod.garmentCondition] ?? prod.garmentCondition}`
    : null;
  const detail = [conditionText, prod.receiveNote].filter(Boolean).join(" · ");
  const prefix = showName ? `${productName(prod)}: ` : "";

  if (editing && !readOnly) {
    return (
      <div className={c("state")} style={{ borderRadius: 0, alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <label htmlFor={`garment-condition-${prod.id}`} style={FIELD_LABEL}>
            สภาพเสื้อ
          </label>
          <Select
            size="sm"
            id={`garment-condition-${prod.id}`}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="">เลือก</option>
            {Object.entries(GARMENT_CONDITIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 160 }}>
          <label htmlFor={`garment-note-${prod.id}`} style={FIELD_LABEL}>
            หมายเหตุ
          </label>
          <Input
            size="sm"
            id={`garment-note-${prod.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น เสื้อสภาพดี มีถุงครบ"
          />
        </div>
        <button
          type="button"
          className={c("btn primary sm")}
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              orderItemProductId: prod.id,
              garmentCondition: condition || undefined,
              receiveNote: note || undefined,
            })
          }
        >
          <Check aria-hidden="true" />
          {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button
          type="button"
          className={c("btn ghost sm")}
          onClick={() => {
            setEditing(false);
            setCondition(prod.garmentCondition ?? "");
            setNote(prod.receiveNote ?? "");
          }}
        >
          ยกเลิก
        </button>
        {mutation.isError ? (
          <span role="alert" style={{ flexBasis: "100%", color: "var(--bad)", fontSize: 12.5 }}>
            {mutation.error.message}
          </span>
        ) : null}
      </div>
    );
  }

  const editButton = !readOnly ? (
    <button type="button" className={c("btn ghost sm")} onClick={() => setEditing(true)}>
      <PenLine aria-hidden="true" />
      แก้สภาพ/หมายเหตุ
    </button>
  ) : null;

  return (
    <div className={c("state", prod.receivedInspected ? "good" : "warn")} style={{ borderRadius: 0 }}>
      {prod.receivedInspected ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <span className={c("grow")}>
        {prefix}
        {prod.receivedInspected
          ? `ตรวจรับเสื้อจากลูกค้าแล้ว${qty > 0 ? ` ${qty.toLocaleString("th-TH")} ตัว` : ""}`
          : "ยังไม่มีหลักฐานใบตรวจรับ"}
        {detail ? ` · ${detail}` : ""}
      </span>
      {editButton}
    </div>
  );
}

/** ค่าสกรีน/ตัว ทางขวาของแถบลาย = เลขเดียวกับคอลัมน์ "ค่าสกรีน" ของทุกแถว (หน้าออเดอร์เท่านั้น) */
function PrintCost({ prints }: { prints: OrderItemPrint[] }) {
  const perPiece = printPerPiece(prints);
  if (perPiece <= 0) return null;
  return (
    <p className={c("pstrip-cost")}>
      <b className={c("mono")}>{formatBaht(perPiece)}</b>
      <span>ค่าสกรีน/ตัว{prints.length > 1 ? " · รวมทุกจุด" : ""}</span>
    </p>
  );
}

/* ---------------------------------------------------------------- สเปกเสื้อตัดเย็บ */

function CustomSpec({ prod, showName }: { prod: OrderItemProduct; showName: boolean }) {
  const rows = [
    prod.fabricType ? { key: "fabric", label: "ชนิดผ้า", value: FABRIC_TYPES[prod.fabricType] ?? prod.fabricType } : null,
    prod.material ? { key: "material", label: "ส่วนผสมผ้า", value: prod.material } : null,
    prod.fabricWeight ? { key: "weight", label: "น้ำหนักผ้า", value: prod.fabricWeight } : null,
    prod.fabricColor ? { key: "color", label: "สีผ้า", value: prod.fabricColor } : null,
    prod.collarType ? { key: "collar", label: "ทรงคอ", value: COLLAR_TYPES[prod.collarType] ?? prod.collarType } : null,
    prod.sleeveType ? { key: "sleeve", label: "แขน", value: SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType } : null,
    prod.bodyFit ? { key: "fit", label: "ทรงตัว", value: BODY_FITS[prod.bodyFit] ?? prod.bodyFit } : null,
    prod.patternNote ? { key: "pattern", label: "หมายเหตุแพทเทิร์น", value: prod.patternNote } : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length === 0) return null;

  return (
    <div style={{ padding: "12px 14px" }}>
      {showName ? (
        <SubHead
          icon={Shirt}
          tone="violet"
          title={productName(prod)}
          right={prod.productType ? <span className={c("chip gray")}>{PRODUCT_TYPES[prod.productType] ?? prod.productType}</span> : undefined}
        />
      ) : null}
      <dl className={c("props")}>
        {rows.map((row) => (
          <Prop key={row.key} label={row.label}>
            {row.value}
          </Prop>
        ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- ชุดงาน */

function ItemBlock({
  item,
  index,
  startIndex,
  orderId,
  showMoney,
  canEditReceiveTracking,
}: {
  item: OrderItem;
  index: number;
  /** เลขแถวแรกของชุดงานนี้ — นับต่อกันทั้งใบเหมือนบิล */
  startIndex: number;
  orderId: string;
  showMoney: boolean;
  canEditReceiveTracking: boolean;
}) {
  const products = item.products ?? [];
  const prints = item.prints ?? [];
  const addons = item.addons ?? [];
  const rows = itemPieceRows(item);
  const qty = itemQty(item);
  const hasPrints = prints.length > 0;
  const printCost = printPerPiece(prints);
  const manyProducts = products.length > 1;
  // ช่อง "สินค้า" คร่อมทุกแถวของสินค้าเดียวกัน (rowSpan) — เดิมพิมพ์ชื่อซ้ำทุกบรรทัด
  const spans = productSpans(rows);
  const sizeCount = sizeCountOf(rows);

  const customerProvided = products.filter((prod) => prod.itemSource === "CUSTOMER_PROVIDED");
  const customMade = products.filter((prod) => prod.itemSource === "CUSTOM_MADE");

  return (
    <div className={c("item")}>
      <ItemHead item={item} index={index} />

      {customerProvided.map((prod) => (
        <ReceiveState
          key={prod.id}
          prod={prod}
          orderId={orderId}
          readOnly={!canEditReceiveTracking}
          showName={manyProducts}
        />
      ))}

      {customMade.map((prod) => (
        <CustomSpec key={prod.id} prod={prod} showName={manyProducts} />
      ))}

      <PrintStrip prints={prints} cost={showMoney ? <PrintCost prints={prints} /> : null} />

      {rows.length > 0 ? (
        <div className={c("tblw")}>
          <table className={c("tbl")}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>สินค้า</th>
                <th className={c("szc")}>ไซส์</th>
                <th className={c("num")}>จำนวน</th>
                {showMoney && <th className={c("num")}>ราคาเสื้อ</th>}
                {showMoney && hasPrints && <th className={c("num")}>ค่าสกรีน</th>}
                {showMoney && <th className={c("num")}>รวม</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const { prod } = row;
                const net = netUnitPrice(prod);
                const discount = prod.discount ?? 0;
                return (
                  <tr key={row.key}>
                    <td style={{ color: "var(--ink-4)" }}>{startIndex + i + 1}</td>
                    {spans[i] > 0 ? <ProductCell row={row} rowSpan={spans[i]} /> : null}
                    <td className={c("szc")}>{row.size ? <b>{row.size}</b> : <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                    <td className={c("num")}>
                      <b>{row.qty.toLocaleString("th-TH")}</b>
                    </td>
                    {showMoney && (
                      <td className={c("num mono")}>
                        {net > 0 || discount > 0 ? formatBaht(net) : "—"}
                        {discount > 0 ? (
                          <small style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>
                            ลด {formatBaht(discount)}
                          </small>
                        ) : null}
                      </td>
                    )}
                    {showMoney && hasPrints && <td className={c("num mono")}>{formatBaht(printCost)}</td>}
                    {showMoney && (
                      <td className={c("num mono")}>
                        <b>{formatBaht(row.qty * (net + printCost))}</b>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>รวมชุดงานนี้</td>
                <td className={c("szc")}>{sizeCount} ไซส์</td>
                <td className={c("num")}>{qty.toLocaleString("th-TH")}</td>
                {showMoney && (
                  <td className={c("num")} colSpan={hasPrints ? 3 : 2}>
                    <span className={c("mono")}>{formatBaht(item.subtotal ?? 0)}</span>
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {addons.length > 0 ? (
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line-2)" }}>
          <SubHead icon={Plus} title="ส่วนเสริมในชุดงาน" />
          {addons.map((addon) => (
            <div key={addon.id} className={c("srow")}>
              <span style={{ overflowWrap: "anywhere" }}>
                {addon.name || "—"}{" "}
                <span className={c("chip gray")}>
                  {PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType}
                </span>
              </span>
              {showMoney && <b>{formatBaht(addon.unitPrice ?? 0)}</b>}
            </div>
          ))}
        </div>
      ) : null}

      {item.notes ? (
        <div className={c("state")} style={{ borderRadius: 0 }}>
          <StickyNote aria-hidden="true" />
          <span className={c("grow")} style={{ overflowWrap: "anywhere" }}>
            หมายเหตุการผลิตชุดนี้ · {item.notes}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- ค่าบริการเพิ่ม */

const feeName = (fee: OrderFee) => fee.name || fee.feeType || "ค่าธรรมเนียม";

function FeesBlock({ fees, showMoney }: { fees: OrderFee[]; showMoney: boolean }) {
  if (fees.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <SubHead icon={Receipt} tone="good" title="ค่าบริการเพิ่ม" />
      {fees.map((fee, i) => (
        <div key={fee.id ?? i} className={c("srow")}>
          <span>{feeName(fee)}</span>
          {showMoney && <b>{formatBaht(fee.amount ?? 0)}</b>}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- ส่งออก */

export function OrderItemsTab({
  orderId,
  items,
  fees,
  onEditItems,
  showMoney,
  canEditReceiveTracking,
  totals,
  onOpenMoney,
}: OrderItemsTabProps) {
  const list = items ?? [];
  const feeList = fees ?? [];
  const isEmpty = list.length === 0;
  const orderQty = list.reduce((s, item) => s + itemQty(item), 0);
  const rowStarts = itemRowStarts(list);

  const itemsCard = (
    <section className={c("card")} aria-labelledby="items-h">
      <CardHead
        icon={PackageCheck}
        tone="blue"
        title={
          <>
            <span id="items-h">รายการสินค้า</span>
            {!isEmpty ? <span className={c("chip gray")}>{orderQty.toLocaleString("th-TH")} ตัว</span> : null}
          </>
        }
        right={
          onEditItems && !isEmpty ? (
            <button type="button" className={c("btn ghost sm")} onClick={onEditItems}>
              <PenLine aria-hidden="true" />
              แก้ไขรายการ
            </button>
          ) : undefined
        }
      />
      {isEmpty ? (
        <>
          <Empty
            icon={PackageCheck}
            title="ยังไม่มีรายการสินค้า"
            hint="ใส่รายการก่อนถึงจะยืนยันออเดอร์ได้"
            action={
              onEditItems ? (
                <button type="button" className={c("btn primary sm")} onClick={onEditItems}>
                  <Plus aria-hidden="true" />
                  ใส่รายการสินค้า
                </button>
              ) : undefined
            }
          />
          {feeList.length > 0 ? (
            <div className={c("cb")}>
              <FeesBlock fees={feeList} showMoney={showMoney} />
            </div>
          ) : null}
        </>
      ) : (
        <div className={c("cb")}>
          {list.map((item, index) => (
            <ItemBlock
              key={item.id}
              item={item}
              index={index}
              startIndex={rowStarts[index]}
              orderId={orderId}
              showMoney={showMoney}
              canEditReceiveTracking={canEditReceiveTracking}
            />
          ))}
          <FeesBlock fees={feeList} showMoney={showMoney} />
        </div>
      )}
    </section>
  );

  const left = (
    <div className={c("stack")}>
      {itemsCard}
      <OrderChangeOrders orderId={orderId} />
    </div>
  );

  // ยังไม่มีรายการ = ยังไม่มีอะไรให้สรุป — คอลัมน์เดียว
  if (isEmpty) return left;

  const right = showMoney ? (
    <PriceCard items={list} fees={feeList} totals={totals} onOpenMoney={onOpenMoney} />
  ) : (
    <SpecCard items={list} />
  );

  return (
    <div className={c("two wide")}>
      {left}
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------- สรุปราคา (เห็นเงินเท่านั้น) */

/** ยอดรวมตัวใหญ่ → ชุดงานละบรรทัด (item.subtotal จาก server) → ค่าบริการ → ส่วนลด → VAT → ยอดรวมทั้งหมด */
function PriceCard({
  items,
  fees,
  totals,
  onOpenMoney,
}: {
  items: OrderItem[];
  fees: OrderFee[];
  totals: OrderItemsTabProps["totals"];
  onOpenMoney?: () => void;
}) {
  return (
    <section className={c("card price sticky")} aria-labelledby="items-price-h">
      <CardHead
        icon={Receipt}
        tone="good"
        title={<span id="items-price-h">สรุปราคา</span>}
        right={<span className={c("chip gray")}>{totals.taxRate > 0 ? `รวม VAT ${totals.taxRate}%` : "ไม่มี VAT"}</span>}
      />
      <div className={c("cb")}>
        <div className={c("big")}>{formatBaht(totals.totalAmount)}</div>
        <div style={{ marginTop: 12 }}>
          {items.map((item, index) => {
            const qty = itemQty(item);
            return (
              <div key={item.id} className={c("srow")}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {item.description || `รายการที่ ${index + 1}`}
                  {qty > 0 ? ` ${qty.toLocaleString("th-TH")} ตัว` : ""}
                </span>
                <b>{formatBaht(item.subtotal ?? 0)}</b>
              </div>
            );
          })}
          {fees.map((fee, i) => (
            <div key={fee.id ?? i} className={c("srow")}>
              <span>{feeName(fee)}</span>
              <b>{formatBaht(fee.amount ?? 0)}</b>
            </div>
          ))}
          {totals.discount > 0 ? (
            <div className={c("srow")}>
              <span>ส่วนลดท้ายบิล</span>
              <b className={c("neg")}>-{formatBaht(totals.discount)}</b>
            </div>
          ) : null}
          {totals.taxRate > 0 ? (
            <div className={c("srow")}>
              <span>VAT {totals.taxRate}%</span>
              <b>{formatBaht(totals.taxAmount ?? 0)}</b>
            </div>
          ) : null}
          <div className={c("srow total")}>
            <span>ยอดรวมทั้งหมด</span>
            <b>{formatBaht(totals.totalAmount)}</b>
          </div>
        </div>
        {onOpenMoney ? (
          <>
            <div className={c("hr")} />
            <button type="button" className={c("btn sm")} style={{ width: "100%", marginTop: 10 }} onClick={onOpenMoney}>
              <Wallet aria-hidden="true" />
              เงินและบิลของใบนี้
              <ArrowRight aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- สเปกงาน (role ที่ไม่เห็นเงิน) */

function SpecCard({ items }: { items: OrderItem[] }) {
  // getById ปิดราคาเป็น null ให้ role ที่ไม่เห็นเงิน → ชนิดเป็น union ต้องบอกชนิดผลลัพธ์ให้ flatMap
  const products = items.flatMap((item): OrderItemProduct[] => item.products ?? []);
  const shirts = unique(
    products.map((prod) => {
      const source = sourceLabel(prod);
      return source ? `${productName(prod)} · ${source}` : productName(prod);
    }),
  );
  const prints = unique(
    items.flatMap((item) =>
      (item.prints ?? []).map((print) => {
        const dims = printDims(print);
        const size = printSizeLabel(print);
        const sizeText = dims ? `${dims} ซม.` : size !== "—" ? size : null;
        return `${techLabel(print)} ${positionLabel(print)}${sizeText ? ` · ${sizeText}` : ""}`;
      }),
    ),
  );
  // รวมจำนวนตามสี/ไซซ์ทั้งใบ เรียงตามที่เจอก่อน
  const sizes = new Map<string, number>();
  for (const prod of products) {
    for (const variant of prod.variants ?? []) {
      const key = [variant.color, variant.size].filter(Boolean).join(" ") || "ไม่ระบุไซซ์";
      sizes.set(key, (sizes.get(key) ?? 0) + variant.quantity);
    }
  }

  return (
    <section className={c("card")} aria-labelledby="items-spec-h">
      <CardHead icon={Shirt} tone="violet" title={<span id="items-spec-h">สเปกงาน</span>} />
      <div className={c("cb")}>
        <dl className={c("props one")}>
          <Prop icon={Shirt} label="เสื้อ" none={shirts.length === 0}>
            {shirts.length > 0
              ? shirts.map((line) => (
                  <span key={line} style={{ display: "block" }}>
                    {line}
                  </span>
                ))
              : "ยังไม่มีเสื้อ"}
          </Prop>
          {prints.length > 0 ? (
            <Prop icon={Printer} label="ลาย">
              {prints.map((line) => (
                <span key={line} style={{ display: "block" }}>
                  {line}
                </span>
              ))}
            </Prop>
          ) : null}
          <Prop icon={PackageCheck} label="ไซซ์" none={sizes.size === 0}>
            {sizes.size > 0 ? (
              <span className={c("sizes")}>
                {[...sizes].map(([size, quantity]) => (
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
  );
}
