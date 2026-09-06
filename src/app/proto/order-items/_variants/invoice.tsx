"use client";

/**
 * B · อ่านเหมือนบิล — ทั้งชุดงานเป็นตารางเดียว ทุกอย่างเป็น "บรรทัด" เรียงลงมา
 *
 *   วิธีคิด: คนเปิดแท็บรายการมาเพื่อตอบคำถามเดียว "ลูกค้าสั่งอะไร กี่ตัว ราคาเท่าไร" —
 *   ใบเสนอราคา/ใบส่งของตอบคำถามนี้ด้วยตารางเดียว 4 คอลัมน์มาตลอด คนโรงงานคุ้นอยู่แล้ว
 *
 *   · หนึ่งชุดงาน = หนึ่งตาราง: รายการ · ราคา/หน่วย · จำนวน · รวม
 *   · เสื้อแยกบรรทัดตาม สี+ไซส์ (แถวละไซส์) → ลาย (แถวละจุด · ×จำนวนเสื้อ) → ส่วนเสริม → รวมชุดงาน
 *   · สเปกเสื้อตัดเย็บ / บันทึกตรวจรับ / หมายเหตุ อยู่ใต้หัวชุดงานเป็น Fact ก่อนถึงตาราง
 *   · จอแคบ (< @xl) ซ่อนคอลัมน์ราคา/หน่วย เหลือ รายการ · จำนวน · รวม
 *
 *   แลก: ออเดอร์ 5 ไซส์ × 3 สี = 15 บรรทัดของเสื้อตัวเดียวกัน · ไม่มีหมวด "ลาย/สินค้า/ส่วนเสริม"
 *   ให้กวาดตาไปหา ต้องอ่านไล่ลง · แพค/แหล่ง/SKU กลายเป็นบรรทัดเล็กใต้ชื่อ
 */

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
  addonQty,
  itemQty,
  netUnitPrice,
  printDims,
  printSizeLabel,
  type DemoPrint,
  type DemoProduct,
} from "../_shared";

const NUM = "tabular-nums";
const TH = "py-2 text-xs font-medium";
const TD = "py-2.5 align-top";

/* ------------------------------------------------------------ แถวหนึ่งบรรทัด */

function Line({
  thumb,
  title,
  meta,
  unitPrice,
  qty,
  total,
  showMoney,
  free = false,
  sub = false,
}: {
  thumb?: React.ReactNode;
  title: React.ReactNode;
  /** ข้อมูลประกอบเป็นชิ้น ๆ เว้นช่องกัน — ไม่ต่อด้วยจุด (กฎ DESIGN §ลำดับความสำคัญทางสายตา) */
  meta?: Array<React.ReactNode | null | undefined | false>;
  /** บรรทัดลูก (ไซส์ของเสื้อตัวเดียวกัน) — ย่อหน้าเข้าใต้ชื่อสินค้า */
  sub?: boolean;
  unitPrice: number;
  qty: number;
  total: number;
  showMoney: boolean;
  /** ไม่คิดเงิน (เสื้อของลูกค้า) — โชว์คำ ไม่โชว์ ฿0 */
  free?: boolean;
}) {
  return (
    <tr className="border-b border-divider last:border-b-0">
      <td className={cn(TD, "pr-3", sub && "pl-8")}>
        <div className="flex items-start gap-2">
          {thumb}
          <div className="min-w-0">
            <p className={cn("text-sm [overflow-wrap:anywhere]", sub ? "text-secondary" : "font-medium text-strong")}>{title}</p>
            {meta && meta.some(Boolean) && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {meta.filter(Boolean).map((m, i) => <span key={i} className="[overflow-wrap:anywhere]">{m}</span>)}
              </p>
            )}
          </div>
        </div>
      </td>
      {showMoney && (
        <td className={cn(TD, NUM, "hidden pr-3 text-right text-sm text-secondary @xl:table-cell")}>
          {free ? <span className="text-xs text-muted">ไม่คิด</span> : formatCurrency(unitPrice)}
        </td>
      )}
      <td className={cn(TD, NUM, "pr-3 text-right text-sm font-medium text-secondary")}>{qty}</td>
      {showMoney && (
        <td className={cn(TD, NUM, "text-right text-sm font-semibold text-strong")}>
          {free ? <span className="text-xs font-normal text-muted">—</span> : formatCurrency(total)}
        </td>
      )}
    </tr>
  );
}

function ProductThumb({ prod }: { prod: DemoProduct }) {
  if (!prod.product?.imageUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={prod.product.imageUrl} alt="" className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" />;
}

function PrintThumb({ print }: { print: DemoPrint }) {
  if (!isImageUrl(print.designImageUrl)) return null;
  return (
    <a href={print.designImageUrl!} target="_blank" rel="noreferrer" title="เปิดภาพเต็ม" className="mt-0.5 flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={print.designImageUrl!} alt="" className="h-9 w-9 rounded-lg border border-border object-cover" />
    </a>
  );
}

/* ------------------------------------------------------------ สเปกใต้หัวชุดงาน */

function ProductSpecs({ prod }: { prod: DemoProduct }) {
  const isCustomMade = prod.itemSource === "CUSTOM_MADE";
  const isCustomerProvided = prod.itemSource === "CUSTOMER_PROVIDED";
  if (!isCustomMade && !isCustomerProvided) return null;
  const source = getProductSourcePresentation(prod.itemSource!);
  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "@container p-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-strong [overflow-wrap:anywhere]">{prod.description || prod.product?.name || "สินค้า"}</p>
        <Badge variant={source.variant} size="sm">{source.label}</Badge>
        {prod.productType && <Badge variant="secondary" size="sm">{PRODUCT_TYPES[prod.productType] ?? prod.productType}</Badge>}
      </div>
      {isCustomMade && (
        <FactList columns={1} className="mt-3 @sm:grid-cols-2 @2xl:grid-cols-4">
          {prod.fabricType && <Fact size="sm" label="ชนิดผ้า" value={FABRIC_TYPES[prod.fabricType] ?? prod.fabricType} />}
          {prod.material && <Fact size="sm" label="ส่วนผสมผ้า" value={prod.material} />}
          {prod.fabricWeight && <Fact size="sm" label="น้ำหนักผ้า" value={prod.fabricWeight} />}
          {prod.fabricColor && <Fact size="sm" label="สีผ้า" value={prod.fabricColor} />}
          {prod.collarType && <Fact size="sm" label="ทรงคอ" value={COLLAR_TYPES[prod.collarType] ?? prod.collarType} />}
          {prod.sleeveType && <Fact size="sm" label="แขน" value={SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType} />}
          {prod.bodyFit && <Fact size="sm" label="ทรงตัว" value={BODY_FITS[prod.bodyFit] ?? prod.bodyFit} />}
          {prod.packagingOption && <Fact size="sm" label="แพค" value={prod.packagingOption.name} />}
          {prod.patternNote && <Fact size="sm" label="หมายเหตุแพทเทิร์น" value={prod.patternNote} className="col-span-full" />}
        </FactList>
      )}
      {isCustomerProvided && (
        <FactList columns={1} className="mt-3 @sm:grid-cols-3">
          <Fact size="sm" label="สภาพเสื้อที่รับ" value={prod.garmentCondition ? GARMENT_CONDITIONS[prod.garmentCondition] ?? prod.garmentCondition : "ยังไม่บันทึก"} />
          <Fact size="sm" label="ตรวจรับแล้ว" value={prod.receivedInspected ? "ใช่" : "ยัง"} tone={prod.receivedInspected ? "success" : "warning"} />
          {prod.receiveNote && <Fact size="sm" label="หมายเหตุตรวจรับ" value={prod.receiveNote} />}
        </FactList>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ ชุดงานหนึ่งชุด */

function ItemBlock({ item, itemIdx, count, showMoney }: { item: DemoItem; itemIdx: number; count: number; showMoney: boolean }) {
  const totalQty = itemQty(item);
  const products = item.products ?? [];
  const prints = item.prints ?? [];
  const addons = item.addons ?? [];
  // ลาย/ส่วนเสริมต่อชิ้น คิดจากจำนวนเสื้อทั้งชุดงาน — สูตรเดียวกับ lib/pricing
  const printQty = totalQty;

  return (
    <section className="@container space-y-3">
      {count > 1 && (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {itemIdx + 1}
          </span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
            {item.description || `รายการที่ ${itemIdx + 1}`}
          </h3>
        </div>
      )}
      {count === 1 && item.description && (
        <h3 className="text-sm font-semibold text-strong [overflow-wrap:anywhere]">{item.description}</h3>
      )}

      {products.map((prod) => <ProductSpecs key={prod.id} prod={prod} />)}

      <table className="w-full">
        <thead className={TABLE_HEAD_SURFACE}>
          <tr>
            <th className={cn(TH, "text-left")}>รายการ</th>
            {showMoney && <th className={cn(TH, "hidden pr-3 text-right @xl:table-cell")}>ราคา/หน่วย</th>}
            <th className={cn(TH, "pr-3 text-right")}>จำนวน</th>
            {showMoney && <th className={cn(TH, "text-right")}>รวม</th>}
          </tr>
        </thead>
        <tbody>
          {/* เสื้อ — ตัวเดียวไซส์เดียว = บรรทัดเดียว · หลายไซส์ = แถวหัวชื่อ แล้วบรรทัดลูกแถวละสี+ไซส์ */}
          {products.flatMap((prod) => {
            const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
            const free = prod.itemSource === "CUSTOMER_PROVIDED";
            const name = prod.product?.name || prod.description || "สินค้า";
            const unit = netUnitPrice(prod);
            const variants = prod.variants ?? [];
            const meta = [
              source?.label,
              prod.product?.sku ? <span className="font-mono">{prod.product.sku}</span> : null,
              prod.packagingOption ? `แพค ${prod.packagingOption.name}` : null,
              showMoney && (prod.discount ?? 0) > 0 ? `ลด ${formatCurrency(prod.discount ?? 0)}/ชิ้น` : null,
            ];
            const sizeChips = (v: (typeof variants)[number]) => (
              <span className="inline-flex items-center gap-1 align-middle">
                {v.color && <Badge variant="outline" size="sm">{v.color}</Badge>}
                {v.size && <Badge variant="default" size="sm" className="font-semibold">{v.size}</Badge>}
              </span>
            );
            if (variants.length <= 1) {
              const v = variants[0];
              return [
                <Line
                  key={prod.id}
                  thumb={<ProductThumb prod={prod} />}
                  title={<>{name}{v && <span className="ml-2">{sizeChips(v)}</span>}</>}
                  meta={meta}
                  unitPrice={unit}
                  qty={v?.quantity ?? 0}
                  total={unit * (v?.quantity ?? 0)}
                  showMoney={showMoney}
                  free={free}
                />,
              ];
            }
            return [
              <tr key={`${prod.id}-head`}>
                <td colSpan={showMoney ? 4 : 2} className="pb-0 pt-2.5">
                  <div className="flex items-start gap-2">
                    <ProductThumb prod={prod} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">{name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        {meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}
                        {showMoney && !free && <span>{formatCurrency(unit)}/ตัว</span>}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>,
              ...variants.map((v) => (
                <Line
                  key={v.id}
                  sub
                  title={sizeChips(v)}
                  unitPrice={unit}
                  qty={v.quantity}
                  total={unit * v.quantity}
                  showMoney={showMoney}
                  free={free}
                />
              )),
            ];
          })}

          {/* ลาย — แถวละจุดพิมพ์ */}
          {prints.map((p) => (
            <Line
              key={p.id}
              thumb={<PrintThumb print={p} />}
              title={`${PRINT_TYPES[p.printType] ?? p.printType} · ${PRINT_POSITIONS[p.position] ?? p.position}`}
              meta={[
                `${printSizeLabel(p)} ${printDims(p) !== "—" ? `(${printDims(p)} ซม.)` : ""}`.trim(),
                p.colorCount != null ? `${p.colorCount} สี` : null,
                p.designNote,
              ]}
              unitPrice={p.unitPrice ?? 0}
              qty={printQty}
              total={(p.unitPrice ?? 0) * printQty}
              showMoney={showMoney}
            />
          ))}

          {/* ส่วนเสริม */}
          {addons.map((a) => {
            const q = addonQty(a, totalQty);
            return (
              <Line
                key={a.id}
                title={a.name || "ส่วนเสริม"}
                meta={[PRICING_TYPE_LABELS[a.pricingType as PricingType] ?? a.pricingType]}
                unitPrice={a.unitPrice ?? 0}
                qty={q}
                total={(a.unitPrice ?? 0) * q}
                showMoney={showMoney}
              />
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="pt-2.5 text-sm font-semibold text-strong">รวมชุดงานนี้</td>
            {showMoney && <td className="hidden @xl:table-cell" aria-hidden="true" />}
            <td className={cn("pr-3 pt-2.5 text-right text-sm font-semibold text-strong", NUM)}>{totalQty} ตัว</td>
            {showMoney && (
              <td className={cn("pt-2.5 text-right text-base font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</td>
            )}
          </tr>
          {showMoney && totalQty > 0 && (
            <tr>
              <td colSpan={2} className="text-xs text-muted">
                เฉลี่ย {formatCurrency(Math.round(((item.subtotal ?? 0) / totalQty) * 100) / 100)} / ตัว
              </td>
              <td colSpan={2} aria-hidden="true" />
            </tr>
          )}
        </tfoot>
      </table>

      {item.notes && <Fact label="หมายเหตุการผลิตชุดนี้" value={item.notes} />}
    </section>
  );
}

/* ---------------------------------------------------------------- ส่งออก */

export function InvoiceVariant({
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
      <ItemsCardFrame items={items} showMoney={showMoney}>
        <div className="space-y-8">
          {items.map((item, i) => (
            <ItemBlock key={item.id} item={item} itemIdx={i} count={items.length} showMoney={showMoney} />
          ))}
        </div>
      </ItemsCardFrame>
      <FeesCard fees={fees} showMoney={showMoney} />
    </div>
  );
}
