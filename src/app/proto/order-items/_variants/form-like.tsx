"use client";

/**
 * A · เหมือนหน้าแก้ไข — แท็บรายการวางโครงเดียวกับฟอร์มสร้าง/แก้ (`OrderItemCard`)
 * แต่เป็นตัวหนังสืออ่านอย่างเดียว ไม่มีช่องกรอก
 *
 *   · หนึ่งชุดงาน = หนึ่งการ์ด หัวการ์ด "รายการที่ N · X ตัว · ฿" (ลอกจาก OrderItemRow)
 *   · ลำดับหมวดเหมือนฟอร์ม (มติ 2026-08-14): ลายและงานพิมพ์ → สินค้าในชุดงาน → ส่วนเสริม → หมายเหตุ → สรุปราคา
 *   · ตาราง 3 หมวดใช้ความกว้างคอลัมน์ชุดเดียวกัน (`ItemTableCols` ของฟอร์ม) — คอลัมน์ตัวเลขจึงตรงกัน
 *   · สินค้าที่ไม่ใช่สต๊อก (ตัดเย็บ/ลูกค้าส่งมา) เป็นกล่องจมเหมือน `ProductAdaptiveCard` — สเปกเสื้อเป็น Fact
 *     ตารางไซส์อ่านอย่างเดียว (ไซส์บน จำนวนล่าง เหมือน `SizeMatrix`)
 *   · จอแคบ (< @2xl ของกล่อง) สลับเป็นการ์ดเหมือน `ProductCardMobile` / `PrintCardMobile`
 *
 * ต่างจากฟอร์มโดยตั้งใจ: ไม่มีคอลัมน์ปุ่มลบ/จัดลำดับ (44px ท้ายตาราง) เพราะไม่มีอะไรให้กด
 */

import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Fact, FactList } from "@/components/ui/fact";
import { RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { cn, formatCurrency, isImageUrl } from "@/lib/utils";
import {
  BODY_FITS,
  COLLAR_TYPES,
  FABRIC_TYPES,
  GARMENT_CONDITIONS,
  PRICING_TYPE_LABELS,
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRODUCT_TYPES,
  SLEEVE_TYPES,
} from "@/types/order-form";
import type { PricingType } from "@/types/order-form";
import type { DemoFees, DemoItem, DemoItems } from "../_data";
import {
  FeesCard,
  ItemsCardFrame,
  itemPriceLines,
  itemQty,
  netUnitPrice,
  priceLineText,
  printDims,
  printSizeLabel,
  productQty,
  type DemoAddon,
  type DemoPrint,
  type DemoProduct,
} from "../_shared";

const GROUP_HEADING = "text-sm font-semibold text-strong";
const TH = "px-2 py-2.5 text-xs font-medium";
const TD = "px-2 py-2 align-middle text-sm";
const NUM = "tabular-nums";

/* โครงคอลัมน์ร่วมของ 3 ตาราง — ตัวเลขเดียวกับ ItemTableCols ของฟอร์ม ยกเว้นไม่มีช่องปุ่ม 44px */
function ItemTableCols() {
  return (
    <colgroup>
      <col style={{ width: 100 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 112 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 96 }} />
    </colgroup>
  );
}

function Dash() {
  return <span className="text-xs text-muted">—</span>;
}

/* ------------------------------------------------------------------ ลาย */

function PrintThumb({ print, size = "h-11 w-11" }: { print: DemoPrint; size?: string }) {
  const positionLabel = PRINT_POSITIONS[print.position] ?? print.position;
  if (isImageUrl(print.designImageUrl)) {
    return (
      <a href={print.designImageUrl!} target="_blank" rel="noreferrer" title="เปิดภาพเต็ม" className="inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={print.designImageUrl!}
          alt={`ลาย ${positionLabel}`}
          className={cn(RADIUS.item, size, "border border-border object-cover")}
        />
      </a>
    );
  }
  if (print.designImageUrl) {
    return (
      <a href={print.designImageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
        เปิดไฟล์แบบ
      </a>
    );
  }
  return (
    <div className={cn(RADIUS.item, size, "flex items-center justify-center border border-dashed border-border text-muted")}>
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}

function PrintsTable({ prints, showMoney }: { prints: DemoPrint[]; showMoney: boolean }) {
  return (
    <table className="w-full table-fixed">
      <ItemTableCols />
      <thead className={TABLE_HEAD_SURFACE}>
        <tr>
          <th className={cn(TH, "text-center")}>ลาย</th>
          <th className={cn(TH, "text-left")}>วิธีพิมพ์</th>
          <th className={cn(TH, "text-center")}>ขนาด</th>
          <th className={cn(TH, "text-center")}>กว้าง × สูง</th>
          <th className={cn(TH, "text-center")}>ตำแหน่ง</th>
          <th className={cn(TH, "text-center")}>จำนวนสี</th>
          <th className={cn(TH, "text-center")}>{showMoney ? "ค่าสกรีน" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {prints.map((p) => (
          <tr key={p.id}>
            <td className="py-2 pr-1 text-center align-middle">
              <div className="flex justify-center">
                <PrintThumb print={p} />
              </div>
            </td>
            <td className={cn(TD, "font-medium text-strong")}>
              {PRINT_TYPES[p.printType] ?? p.printType}
              {p.designNote && (
                <p className="mt-0.5 text-xs font-normal text-muted [overflow-wrap:anywhere]">{p.designNote}</p>
              )}
            </td>
            <td className={cn(TD, "text-center text-secondary")}>{printSizeLabel(p)}</td>
            <td className={cn(TD, NUM, "text-center text-secondary")}>{printDims(p)}</td>
            <td className={cn(TD, "text-center text-secondary")}>{PRINT_POSITIONS[p.position] ?? p.position}</td>
            <td className={cn(TD, NUM, "text-center text-secondary")}>{p.colorCount ?? <Dash />}</td>
            <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
              {showMoney ? formatCurrency(p.unitPrice ?? 0) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintCardNarrow({ print, showMoney }: { print: DemoPrint; showMoney: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-3">
      <PrintThumb print={print} size="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-strong">
            {PRINT_TYPES[print.printType] ?? print.printType} · {PRINT_POSITIONS[print.position] ?? print.position}
          </p>
          {showMoney && (
            <p className={cn(NUM, "text-sm font-semibold text-strong")}>{formatCurrency(print.unitPrice ?? 0)}</p>
          )}
        </div>
        <FactList columns={1} className="mt-2 @xs:grid-cols-3">
          <Fact size="sm" label="ขนาด" value={printSizeLabel(print)} />
          <Fact size="sm" label="กว้าง × สูง" value={printDims(print)} />
          {print.colorCount != null && <Fact size="sm" label="จำนวนสี" value={print.colorCount} />}
        </FactList>
        {print.designNote && <p className="mt-2 text-xs text-muted [overflow-wrap:anywhere]">{print.designNote}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- สินค้า */

function StockIdentity({ prod }: { prod: DemoProduct }) {
  const name = prod.product?.name || prod.description || "สินค้า";
  const v = prod.variants?.[0];
  const variantLabel = prod.variants?.length === 1 ? [v?.color, v?.size].filter(Boolean).join(" ") : "";
  return (
    <div className="flex items-center gap-2">
      {prod.product?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prod.product.imageUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted">
          <ImageIcon className="h-4 w-4 text-muted" />
        </div>
      )}
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-strong">{name}</span>
        {variantLabel && <span className="block text-xs text-muted">{variantLabel}</span>}
        {prod.product?.sku && <span className="block font-mono text-xs text-muted">{prod.product.sku}</span>}
      </div>
    </div>
  );
}

function StockRow({ prod, showMoney }: { prod: DemoProduct; showMoney: boolean }) {
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const qty = productQty(prod);
  return (
    <tr>
      <td className="py-2 pl-1 pr-3 align-middle">
        {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
      </td>
      <td className="py-2 pr-2 align-middle"><StockIdentity prod={prod} /></td>
      <td className={cn(TD, "text-center text-secondary")}>{prod.packagingOption?.name ?? <Dash />}</td>
      <td className={cn(TD, NUM, "text-center text-secondary")}>{showMoney ? formatCurrency(prod.baseUnitPrice ?? 0) : null}</td>
      <td className={cn(TD, NUM, "text-center text-secondary")}>
        {showMoney ? ((prod.discount ?? 0) > 0 ? formatCurrency(prod.discount ?? 0) : <Dash />) : null}
      </td>
      <td className={cn(TD, NUM, "text-center font-medium text-secondary")}>{qty}</td>
      <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
        {showMoney ? formatCurrency(qty * netUnitPrice(prod)) : null}
      </td>
    </tr>
  );
}

function StockCardNarrow({ prod, showMoney }: { prod: DemoProduct; showMoney: boolean }) {
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const qty = productQty(prod);
  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
      <StockIdentity prod={prod} />
      <FactList columns={1} className={showMoney ? "@xs:grid-cols-2 @md:grid-cols-4" : "@xs:grid-cols-2"}>
        <Fact size="sm" label="แพค" value={prod.packagingOption?.name ?? "—"} />
        {showMoney && <Fact size="sm" label="ราคา" value={formatCurrency(prod.baseUnitPrice ?? 0)} />}
        {showMoney && (prod.discount ?? 0) > 0 && <Fact size="sm" label="ส่วนลด" value={formatCurrency(prod.discount ?? 0)} />}
        <Fact size="sm" label="จำนวน" value={qty} />
        {showMoney && <Fact size="sm" label="รวม" value={formatCurrency(qty * netUnitPrice(prod))} />}
      </FactList>
    </div>
  );
}

/** ตารางไซส์อ่านอย่างเดียว — ไซส์บน จำนวนล่าง เหมือน SizeMatrix ของฟอร์ม */
function SizeGrid({ prod, title }: { prod: DemoProduct; title: string }) {
  const color = prod.variants?.find((v) => v.color)?.color;
  const total = productQty(prod);
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-strong">{title}</h4>
      {color && (
        <p className="mb-2 text-xs text-secondary">
          สี (ใช้ทุกไซส์): <span className="font-medium text-strong">{color}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(prod.variants ?? []).map((v) => (
          <div key={v.id} className={cn(RADIUS.item, "w-14 border border-border py-1.5 text-center")}>
            <p className="text-xs font-medium text-muted">{v.size || "—"}</p>
            <p className={cn(NUM, "text-base font-semibold text-strong")}>{v.quantity}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        รวม <span className="font-semibold text-secondary">{total}</span> ตัว
      </p>
    </div>
  );
}

/** สินค้าที่ไม่ใช่สต๊อก — กล่องจมแบบ ProductAdaptiveCard แต่อ่านอย่างเดียว */
function AdaptiveProductCard({
  prod,
  prodIdx,
  total,
  showMoney,
}: {
  prod: DemoProduct;
  prodIdx: number;
  total: number;
  showMoney: boolean;
}) {
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const isCustomerProvided = prod.itemSource === "CUSTOMER_PROVIDED";
  const isCustomMade = prod.itemSource === "CUSTOM_MADE";
  const qty = productQty(prod);

  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "@container p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-strong">
          สินค้า {prodIdx + 1}/{total}
        </h4>
        {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
        {prod.productType && <Badge variant="secondary" size="sm">{PRODUCT_TYPES[prod.productType] ?? prod.productType}</Badge>}
      </div>

      <div className="mt-3 space-y-4">
        <FactList columns={1} className="@md:grid-cols-2">
          <Fact label="ชื่อสินค้า" value={prod.description || prod.product?.name || "—"} />
          <Fact label="แพค" value={prod.packagingOption?.name ?? "—"} />
        </FactList>

        {isCustomerProvided ? (
          <>
            <p className="text-xs text-secondary">ตัวเสื้อเป็นของลูกค้า จึงไม่คิดราคาตัวเสื้อ</p>
            <div className="border-t border-divider pt-4">
              <SizeGrid prod={prod} title="จำนวนที่ลูกค้าส่งมา" />
            </div>
            {(prod.garmentCondition || prod.receivedInspected || prod.receiveNote) && (
              <div className="border-t border-divider pt-4">
                <h4 className="mb-2 text-sm font-semibold text-strong">ตรวจรับเสื้อ</h4>
                <FactList columns={1} className="@md:grid-cols-3">
                  <Fact size="sm" label="สภาพ" value={prod.garmentCondition ? GARMENT_CONDITIONS[prod.garmentCondition] ?? prod.garmentCondition : "—"} />
                  <Fact size="sm" label="ตรวจรับแล้ว" value={prod.receivedInspected ? "ใช่" : "ยัง"} tone={prod.receivedInspected ? "success" : "warning"} />
                  {prod.receiveNote && <Fact size="sm" label="หมายเหตุ" value={prod.receiveNote} />}
                </FactList>
              </div>
            )}
          </>
        ) : (
          <>
            {showMoney && (
              <FactList columns={1} className="@sm:grid-cols-3">
                <Fact label="ราคา/ชิ้น" value={formatCurrency(prod.baseUnitPrice ?? 0)} />
                <Fact label="ส่วนลด/ชิ้น" value={(prod.discount ?? 0) > 0 ? formatCurrency(prod.discount ?? 0) : "—"} />
                <Fact label="รวมตัวเสื้อ" value={formatCurrency(qty * netUnitPrice(prod))} />
              </FactList>
            )}
            <div className={cn("grid items-start gap-5 border-t border-divider pt-4", isCustomMade && "@3xl:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]")}>
              {isCustomMade && (
                <FactList columns={1} className="@sm:grid-cols-2 @xl:grid-cols-3">
                  {prod.fabricType && <Fact size="sm" label="ชนิดผ้า" value={FABRIC_TYPES[prod.fabricType] ?? prod.fabricType} />}
                  {prod.material && <Fact size="sm" label="ส่วนผสมผ้า" value={prod.material} />}
                  {prod.fabricWeight && <Fact size="sm" label="น้ำหนักผ้า" value={prod.fabricWeight} />}
                  {prod.fabricColor && <Fact size="sm" label="สีผ้า" value={prod.fabricColor} />}
                  {prod.collarType && <Fact size="sm" label="ทรงคอ" value={COLLAR_TYPES[prod.collarType] ?? prod.collarType} />}
                  {prod.sleeveType && <Fact size="sm" label="แขน" value={SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType} />}
                  {prod.bodyFit && <Fact size="sm" label="ทรงตัว" value={BODY_FITS[prod.bodyFit] ?? prod.bodyFit} />}
                  {prod.patternNote && <Fact size="sm" label="หมายเหตุแพทเทิร์น" value={prod.patternNote} className="col-span-full" />}
                </FactList>
              )}
              <div className={cn("min-w-0", isCustomMade && "@3xl:border-l @3xl:border-divider @3xl:pl-5")}>
                <SizeGrid prod={prod} title="ไซส์และจำนวน" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ ส่วนเสริม */

function AddonsTable({ addons, showMoney }: { addons: DemoAddon[]; showMoney: boolean }) {
  return (
    <table className="w-full table-fixed">
      <ItemTableCols />
      <thead className={TABLE_HEAD_SURFACE}>
        <tr>
          <th colSpan={2} className={cn(TH, "text-left")}>ชื่อ</th>
          <th colSpan={2} className={cn(TH, "text-left")}>ประเภท</th>
          <th colSpan={2} className={cn(TH, "text-center")}>คิดราคา</th>
          <th className={cn(TH, "text-center")}>{showMoney ? "ราคา" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {addons.map((a) => (
          <tr key={a.id}>
            <td colSpan={2} className={cn(TD, "font-medium text-strong [overflow-wrap:anywhere]")}>{a.name || "—"}</td>
            <td colSpan={2} className={cn(TD, "text-secondary")}>{a.addonType || <Dash />}</td>
            <td colSpan={2} className={cn(TD, "text-center")}>
              <Badge variant={a.pricingType === "PER_PIECE" ? "default" : "secondary"} size="sm">
                {PRICING_TYPE_LABELS[a.pricingType as PricingType] ?? a.pricingType}
              </Badge>
            </td>
            <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
              {showMoney ? formatCurrency(a.unitPrice ?? 0) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AddonCardNarrow({ addon, showMoney }: { addon: DemoAddon; showMoney: boolean }) {
  return (
    <div className={cn("rounded-lg p-3", SUNK_PANEL)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">{addon.name || "—"}</p>
        {showMoney && <p className={cn(NUM, "text-sm font-semibold text-strong")}>{formatCurrency(addon.unitPrice ?? 0)}</p>}
      </div>
      <FactList columns={2} className="mt-2">
        <Fact size="sm" label="ประเภท" value={addon.addonType || "—"} />
        <Fact size="sm" label="คิดราคา" value={PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType} />
      </FactList>
    </div>
  );
}

/* ------------------------------------------------------------ สรุปราคา */

function ItemPriceSummary({ item }: { item: DemoItem }) {
  const lines = itemPriceLines(item);
  const totalQty = itemQty(item);
  if (lines.length === 0) return null;
  return (
    <div className="border-t border-border/70 pt-3">
      <p className={cn(GROUP_HEADING, "mb-2")}>สรุปราคารายการ</p>
      <table className="w-full text-xs">
        <tbody className="text-secondary">
          {lines.map((line) => {
            const { label, detail } = priceLineText(item, line);
            return (
              <tr key={`${line.kind}-${line.index}`}>
                <td className="py-1 [overflow-wrap:anywhere]">
                  <span className="text-secondary">{label}</span>
                  {detail && <span className="ml-1 text-muted">({detail})</span>}
                </td>
                <td className={cn("px-2 py-1 text-right text-muted", NUM)}>{formatCurrency(line.unitPrice)}</td>
                <td className={cn("px-2 py-1 text-right text-muted", NUM)}>×{line.quantity}</td>
                <td className={cn("py-1 text-right", NUM)}>{formatCurrency(line.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/70">
            <td colSpan={2} className="pt-2 text-sm font-semibold text-strong">รวมทั้งหมด</td>
            <td className={cn("px-2 pt-2 text-right text-xs text-muted", NUM)}>{totalQty} ตัว</td>
            <td className={cn("pt-2 text-right text-sm font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</td>
          </tr>
          {totalQty > 0 && (
            <tr>
              <td colSpan={3} className="text-xs text-muted">
                เฉลี่ย {formatCurrency(Math.round(((item.subtotal ?? 0) / totalQty) * 100) / 100)} / ตัว
              </td>
              <td aria-hidden="true" />
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- การ์ดชุดงาน */

function ItemCard({ item, itemIdx, showMoney }: { item: DemoItem; itemIdx: number; showMoney: boolean }) {
  const totalQty = itemQty(item);
  const products = item.products ?? [];
  const prints = item.prints ?? [];
  const addons = item.addons ?? [];
  const usesAdaptive = products.some((p) => p.itemSource !== "FROM_STOCK");

  return (
    <article className={cn("card-surface p-4 sm:p-5", RADIUS.surface)}>
      {/* หัวการ์ด — ลอกจาก OrderItemRow ของฟอร์ม */}
      <div className="flex min-h-11 items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {itemIdx + 1}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
          {item.description ? item.description : `รายการที่ ${itemIdx + 1}`}
        </h3>
        {totalQty > 0 && <span className={cn("flex-shrink-0 text-xs text-muted", NUM)}>{totalQty} ตัว</span>}
        {showMoney && (item.subtotal ?? 0) > 0 && (
          <span className={cn("flex-shrink-0 text-sm font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</span>
        )}
      </div>

      <div className="space-y-5 pt-4">
        {/* ลาย */}
        {prints.length > 0 && (
          <div className="@container">
            <p className={cn(GROUP_HEADING, "mb-2")}>ลายและงานพิมพ์</p>
            <div className="hidden overflow-hidden @2xl:block"><PrintsTable prints={prints} showMoney={showMoney} /></div>
            <div className="space-y-2.5 @2xl:hidden">
              {prints.map((p) => <PrintCardNarrow key={p.id} print={p} showMoney={showMoney} />)}
            </div>
          </div>
        )}

        {/* สินค้า */}
        <div className="@container">
          <p className={cn(GROUP_HEADING, "mb-2")}>สินค้าในชุดงาน</p>
          {usesAdaptive ? (
            <div className="space-y-3">
              {products.map((prod, i) => (
                <AdaptiveProductCard key={prod.id} prod={prod} prodIdx={i} total={products.length} showMoney={showMoney} />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden @2xl:block">
                <table className="w-full table-fixed">
                  <ItemTableCols />
                  <thead className={TABLE_HEAD_SURFACE}>
                    <tr>
                      <th className={cn(TH, "text-left")}>แหล่ง</th>
                      <th className={cn(TH, "text-left")}>สินค้า</th>
                      <th className={cn(TH, "text-center")}>แพค</th>
                      <th className={cn(TH, "text-center")}>{showMoney ? "ราคา" : ""}</th>
                      <th className={cn(TH, "text-center")}>{showMoney ? "ส่วนลด" : ""}</th>
                      <th className={cn(TH, "text-center")}>จำนวน</th>
                      <th className={cn(TH, "text-center")}>{showMoney ? "รวม" : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod) => <StockRow key={prod.id} prod={prod} showMoney={showMoney} />)}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2.5 @2xl:hidden">
                {products.map((prod) => <StockCardNarrow key={prod.id} prod={prod} showMoney={showMoney} />)}
              </div>
            </>
          )}
        </div>

        {/* ส่วนเสริม */}
        {addons.length > 0 && (
          <div className="@container">
            <p className={cn(GROUP_HEADING, "mb-2")}>ส่วนเสริมในชุดงาน</p>
            <div className="hidden overflow-hidden @2xl:block"><AddonsTable addons={addons} showMoney={showMoney} /></div>
            <div className="space-y-2.5 @2xl:hidden">
              {addons.map((a) => <AddonCardNarrow key={a.id} addon={a} showMoney={showMoney} />)}
            </div>
          </div>
        )}

        {/* หมายเหตุ */}
        {item.notes && (
          <Fact label="หมายเหตุการผลิตชุดนี้" value={item.notes} />
        )}

        {showMoney && <ItemPriceSummary item={item} />}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- ส่งออก */

export function FormLikeVariant({
  items,
  fees,
  showMoney,
}: {
  items: DemoItems;
  fees: DemoFees;
  showMoney: boolean;
}) {
  return (
    <div className="space-y-6">
      <ItemsCardFrame items={items} showMoney={showMoney} bare>
        <div className="space-y-4">
          {items.map((item, i) => (
            <ItemCard key={item.id} item={item} itemIdx={i} showMoney={showMoney} />
          ))}
        </div>
      </ItemsCardFrame>
      <FeesCard fees={fees} showMoney={showMoney} />
    </div>
  );
}
