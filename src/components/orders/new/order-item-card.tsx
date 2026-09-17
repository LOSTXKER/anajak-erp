"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { c } from "@/components/kit/kit";
import { cn, formatBaht, formatCurrency } from "@/lib/utils";
import { buildOrderItemPriceSummary, createProductForSource, getProductSourcePresentation } from "@/lib/order-item-composer";
import {
  Plus,
  Trash,
  Copy,
  ImageIcon,
  Files,
  Shirt,
} from "lucide-react";
import type { OrderItemForm } from "@/types/order-form";
import {
  CUSTOM_ADDON_TYPE,
  PRICING_TYPE_LABELS,
  PRINT_TYPES,
  itemHasContent,
} from "@/types/order-form";
import { addonSelectValue, CUSTOM_ADDON_OPTION } from "@/lib/order-addon-ui";
import { PrintTableRow } from "./print-table-row";
import { PrintCardMobile } from "./print-card-mobile";
import { ProductTableRow } from "./product-table-row";
import { ProductCardMobile } from "./product-card-mobile";
import { AddProductPopover, PRODUCT_TYPE_OPTIONS } from "./add-product-popover";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

const groupHeadingClass =
  "text-sm font-semibold text-strong";

interface OrderItemCardProps {
  cardId: string;
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  printCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  addonCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  onUpdateItem: (idx: number, field: string, value: unknown) => void;
  onRemoveItem: (idx: number) => void;
  /** คัดลอกชุดงานทั้งใบไปท้ายรายการ — หน้าเพจทำ เพราะต้องขยับตัวชี้ชุดเป้าหมายและพาไปยังชุดใหม่ */
  onDuplicateItem: (idx: number) => void;
  onAddPrint: (idx: number) => void;
  onRemovePrint: (itemIdx: number, pIdx: number) => void;
  onUpdatePrint: (itemIdx: number, pIdx: number, field: string, value: unknown) => void;
  onAddAddon: (idx: number) => void;
  onRemoveAddon: (itemIdx: number, aIdx: number) => void;
  onUpdateAddon: (itemIdx: number, aIdx: number, field: string, value: unknown) => void;
  onOpenPicker: () => void;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
  showPrints?: boolean;
  showAddons?: boolean;
  // โหมดกระชับ (หน้าแก้รายการ): ตัดสรุปราคาต่อรายการ (sidebar มีรวมแล้ว) (redesign 2026-06-12)
  compact?: boolean;
}

const unique = <T,>(values: T[]) => [...new Set(values)];

/* ความกว้างคอลัมน์แยกตามตาราง (ต้นแบบ 2026-09-18) — ช่องที่ยืดคือช่องที่ต้องใช้ที่จริง
   เดิมบังคับ 3 ตารางใช้ชุดเดียวกัน (เบส 2026-08-03) แล้ว "วิธีพิมพ์" กว้างจนหัวคอลัมน์ลอยห่างข้อมูล
   ตัวเลข 0 = ยืดตามที่เหลือ */
function Cols({ widths }: { widths: number[] }) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={index} style={width ? { width } : undefined} />
      ))}
    </colgroup>
  );
}

// ============================================================
// หัวการ์ดชุดงาน
// ============================================================

// เลขในกรอบ · ชื่อพิมพ์แก้ในที่ · ชิปแหล่ง/วิธีพิมพ์ · จำนวนตัว · ยอด (ต้นแบบ .ch.ih)
// ทุกรายการกางเห็นหมด ไม่ accordion — เบส: ไม่ต้องซ่อน
function OrderItemRow({
  item, itemIdx, canRemove, canDuplicate, headingId, onUpdateItem, onRemoveItem, onDuplicateItem,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  canDuplicate: boolean;
  headingId: string;
  onUpdateItem: (idx: number, field: string, value: unknown) => void;
  onRemoveItem: (idx: number) => void;
  onDuplicateItem: () => void;
}) {
  // ยอด/จำนวนจาก pricing helper ชุดเดียวกับสรุปยอด — แสดงเสมอแม้ยังว่าง (ต้นแบบ: 0 ตัว ฿0.00)
  const { totalQuantity, subtotal } = buildOrderItemPriceSummary(item);
  const sources = unique(
    item.products
      .map((product) => product.itemSource)
      .filter((source) => source && source !== "FROM_STOCK"),
  );
  const techs = unique(item.prints.map((print) => PRINT_TYPES[print.printType] || print.printType));

  return (
    <div className={c("ch ih")}>
      <h2 id={headingId}>
        <span className={c("item-no")} aria-hidden="true">{itemIdx + 1}</span>
        <span className="sr-only">รายการที่ {itemIdx + 1}</span>
        <input
          className={c("gname")}
          value={item.description}
          onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)}
          aria-label={`ชื่อชุดงานที่ ${itemIdx + 1}`}
          placeholder="ตั้งชื่อชุดงาน เช่น เสื้อทีมหน้าร้าน 30 ตัว"
        />
        {sources.map((source) => (
          <span key={source} className={c("chip line")}>
            {getProductSourcePresentation(source).label}
          </span>
        ))}
        {techs.map((tech) => (
          <span key={tech} className={c("chip blue")}>{tech}</span>
        ))}
      </h2>
      <div className={c("r")}>
        <span className={c("iq")}>{totalQuantity.toLocaleString("th-TH")} ตัว</span>
        <b className={c("it mono")}>{formatBaht(subtotal)}</b>
        {/* คำสั่งของชุดงานนี้: คัดลอกทั้งชุด แล้วลบ — ปุ่มลบมีเส้นคั่นและระยะห่างกว่าปกติ
            เพราะสองปุ่มหน้าตาเหมือนกันและปุ่มลบกู้คืนไม่ได้ (ชุดว่างคัดลอกไม่ได้ ไม่มีอะไรให้คัดลอก) */}
        <button
          type="button"
          className={c("ibtn")}
          onClick={onDuplicateItem}
          disabled={!canDuplicate}
          title={canDuplicate ? "คัดลอกรายการ" : "กรอกรายการนี้ก่อนจึงคัดลอกได้"}
          aria-label={`คัดลอกรายการที่ ${itemIdx + 1}`}
        >
          <Copy aria-hidden="true" />
        </button>
        {canRemove && (
          <button type="button" className={cn(c("ibtn"), "ml-1.5 border-l border-divider pl-2.5")} onClick={() => onRemoveItem(itemIdx)} title="ลบรายการ" aria-label={`ลบรายการที่ ${itemIdx + 1}`}>
            <Trash aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN ORDER ITEM CARD
// ============================================================

export function OrderItemCard({
  cardId, item, itemIdx, canRemove, isExpanded,
  printCatalog, addonCatalog,
  onUpdateItem, onRemoveItem, onDuplicateItem,
  onAddPrint, onRemovePrint, onUpdatePrint,
  onAddAddon, onRemoveAddon, onUpdateAddon,
  onOpenPicker, onSetItems,
  showPrints = true, showAddons = true,
  compact = false,
}: OrderItemCardProps) {
  const expanded = isExpanded;

  const applyPrintFromCatalog = (pIdx: number, catalogId: string) => {
    const catalogItem = printCatalog?.find((entry) => entry.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const prints = [...copy[itemIdx].prints];
      prints[pIdx] = { ...prints[pIdx], printType: catalogItem.type, unitPrice: catalogItem.defaultPrice };
      copy[itemIdx] = { ...copy[itemIdx], prints };
      return copy;
    });
  };

  /** "อื่นๆ (พิมพ์เอง)" — รหัสเป็น CUSTOM คงชื่อเดิมไว้ให้แก้ต่อ (เลือกจากแค็ตตาล็อกแล้วอยากเปลี่ยนชื่อก็ทางนี้) */
  const markAddonCustom = (aIdx: number) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const addons = [...copy[itemIdx].addons];
      addons[aIdx] = { ...addons[aIdx], addonType: CUSTOM_ADDON_TYPE };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  /** พิมพ์ชื่อเอง = เป็น CUSTOM อัตโนมัติ (ไม่มีแค็ตตาล็อกก็ไม่ค้างเป็นรหัสว่าง) */
  const setAddonName = (aIdx: number, name: string) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const addons = [...copy[itemIdx].addons];
      addons[aIdx] = { ...addons[aIdx], name, addonType: addons[aIdx].addonType || CUSTOM_ADDON_TYPE };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  // ช่อง "ส่วนเสริม" ช่องเดียว (เบสเคาะ 2026-09-06 "ประเภทกับชื่อซ้ำซ้อน"): ดรอปดาวน์ชื่อจากแค็ตตาล็อก
  // + "อื่นๆ (พิมพ์เอง)" เปิดช่องชื่อ · รหัสประเภทตามแค็ตตาล็อกไปเงียบๆ ไม่โชว์ SIZE_LABEL ให้คนอ่านอีก
  const renderAddonField = (a: OrderItemForm["addons"][number], aIdx: number, dense: boolean) => {
    const hasCatalog = !!addonCatalog && addonCatalog.length > 0;
    const value = hasCatalog ? addonSelectValue(a, addonCatalog!) : CUSTOM_ADDON_OPTION;
    const custom = value === CUSTOM_ADDON_OPTION;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasCatalog && (
          <Select
            aria-label={`ส่วนเสริม ${aIdx + 1}`}
            value={value}
            size={dense ? "dense" : undefined}
            className="min-w-[10rem] flex-1"
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM_ADDON_OPTION) markAddonCustom(aIdx);
              else if (v) applyAddonFromCatalog(aIdx, v);
            }}
          >
            <option value="">เลือกส่วนเสริม...</option>
            {addonCatalog!.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            <option value={CUSTOM_ADDON_OPTION}>อื่นๆ (พิมพ์เอง)</option>
          </Select>
        )}
        {custom && (
          <Input
            aria-label={`ชื่อส่วนเสริม ${aIdx + 1}`}
            value={a.name}
            onChange={(e) => setAddonName(aIdx, e.target.value)}
            placeholder="เช่น ปักชื่อรายตัว ป้ายคอ"
            size={dense ? "dense" : undefined}
            className="min-w-[10rem] flex-1"
          />
        )}
      </div>
    );
  };

  const applyAddonFromCatalog = (aIdx: number, catalogId: string) => {
    const catalogItem = addonCatalog?.find((entry) => entry.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const addons = [...copy[itemIdx].addons];
      addons[aIdx] = {
        ...addons[aIdx],
        addonType: catalogItem.type,
        name: catalogItem.name,
        pricingType: catalogItem.pricingType as "PER_PIECE" | "PER_ORDER",
        unitPrice: catalogItem.defaultPrice,
        // เปลี่ยน identity ของส่วนเสริมแล้วต้องไม่แบก metadata/จำนวน override
        // ที่ UI ไม่ได้แสดงจากรายการเดิมไปคิดราคากับรายการใหม่
        description: undefined,
        quantity: undefined,
        notes: undefined,
      };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  const addProductWithSource = (source: string) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const newProd = createProductForSource(source);
      copy[itemIdx] = { ...copy[itemIdx], products: [...copy[itemIdx].products, newProd] };
      return copy;
    });
  };

  const itemPriceSummary = buildOrderItemPriceSummary(item);
  const { totalQuantity: totalQty, subtotal } = itemPriceSummary;
  // ค่าสกรีนรวมทุกจุดต่อเสื้อหนึ่งตัว — ตัวคูณจำนวนตัวใน pricing (ผลรวม unitPrice ของลาย)
  const printPerPiece = item.prints.reduce((sum, print) => sum + (print.unitPrice || 0), 0);
  const headingId = `${cardId}-heading`;

  // ── ลาย ── หัวย่อยกับเนื้อเป็นลูกตรงของ .ibody (ระยะห่างแบบต้นแบบ) จึงคืนเป็น fragment
  const printsSection = (
    <>
      {/* หัวข้อย่อยมีไอคอนนำ (เบสสั่ง 2026-09-18) — กล่อง .tm 26px ของชุดกลาง เล็กกว่าหัวการ์ด
          และใช้ไอคอนเดียวกับปุ่มเพิ่มของส่วนนั้น ให้สแกนเจอว่าแต่ละก้อนคือเรื่องอะไร */}
      <div className={c("sub-h")}>
        <h3>
          <span className={c("tm violet")} aria-hidden="true"><ImageIcon /></span>
          ลายและงานพิมพ์
        </h3>
        {item.prints.length > 0 && (
          <div className={c("r")}>
            <button type="button" className={c("btn ghost sm")} onClick={() => onAddPrint(itemIdx)}>
              <Plus aria-hidden="true" />เพิ่มลาย
            </button>
          </div>
        )}
      </div>
      {item.prints.length === 0 ? (
        <button type="button" className={c("drop act")} onClick={() => onAddPrint(itemIdx)}>
          <ImageIcon aria-hidden="true" />
          <b>เพิ่มลาย</b>
        </button>
      ) : (
        <>
          {/* min-width: คอลัมน์ยืดสองช่องไม่ถูกบีบจนอ่านไม่ออก — แคบกว่านี้เลื่อนแนวนอน */}
          <div className={cn(c("tblw"), "hidden @2xl:block")}>
            <table className={cn(c("tbl itbl"), "min-w-[780px]")}>
              <Cols widths={[60, 0, 0, 120, 132, 74, 112, 34]} />
              <thead>
                <tr>
                  <th className={c("ctr")}>ไฟล์</th>
                  <th>วิธีพิมพ์</th>
                  <th>ขนาด</th>
                  <th className={c("ctr")}>กว้าง × สูง</th>
                  <th>ตำแหน่ง</th>
                  <th className={c("ctr")}>จำนวนสี</th>
                  <th className={c("num")}>ค่าสกรีน/ตัว</th>
                  <th><span className="sr-only">ลบลาย</span></th>
                </tr>
              </thead>
              <tbody>
                {item.prints.map((print, printIdx) => (
                  <PrintTableRow
                    key={printIdx}
                    print={print}
                    printIdx={printIdx}
                    onUpdate={(field, value) =>
                      onUpdatePrint(itemIdx, printIdx, field, value)
                    }
                    onRemove={() => onRemovePrint(itemIdx, printIdx)}
                    printCatalog={printCatalog}
                    onApplyCatalog={(catalogId) =>
                      applyPrintFromCatalog(printIdx, catalogId)
                    }
                  />
                ))}
              </tbody>
              {/* ค่าสกรีนรวมทุกจุดต่อเสื้อหนึ่งตัว — โผล่ทุกครั้งที่มีลาย แม้ยังเป็น ฿0.00 (ต้นแบบ) */}
              <tfoot>
                <tr>
                  <td colSpan={6}>รวมค่าสกรีนต่อตัว {item.prints.length} ลาย</td>
                  <td className={c("num mono")}><b>{formatBaht(printPerPiece)}</b></td>
                  <td aria-hidden="true" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="space-y-2.5 @2xl:hidden">
            {item.prints.map((print, printIdx) => (
              <PrintCardMobile
                key={printIdx}
                print={print}
                printIdx={printIdx}
                onUpdate={(field, value) =>
                  onUpdatePrint(itemIdx, printIdx, field, value)
                }
                onRemove={() => onRemovePrint(itemIdx, printIdx)}
                printCatalog={printCatalog}
                onApplyCatalog={(catalogId) =>
                  applyPrintFromCatalog(printIdx, catalogId)
                }
              />
            ))}
            <p className={c("srow")}>
              <span>รวมค่าสกรีนต่อตัว {item.prints.length} ลาย</span>
              <b>{formatBaht(printPerPiece)}</b>
            </p>
          </div>
        </>
      )}
    </>
  );

  // ── สินค้า ──
  const productsSection = (
    <>
      <div className={c("sub-h")}>
        <h3>
          <span className={c("tm blue")} aria-hidden="true"><Shirt /></span>
          สินค้าในชุดงาน
        </h3>
        {item.products.length > 0 && (
          <div className={c("r")}>
            <AddProductPopover
              onAddFromStock={onOpenPicker}
              onAddCustomMade={() => addProductWithSource("CUSTOM_MADE")}
              onAddCustomerProvided={() => addProductWithSource("CUSTOMER_PROVIDED")}
            />
          </div>
        )}
      </div>
      {item.products.length === 0 ? (
        // เลือกแหล่งก่อน → แถวที่ได้โชว์เฉพาะช่องที่แหล่งนั้นใช้ (guided by type)
        <div className={c("add3")}>
          {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className={c("drop act")}
              onClick={() => {
                if (key === "stock") onOpenPicker();
                else if (key === "custom") addProductWithSource("CUSTOM_MADE");
                else addProductWithSource("CUSTOMER_PROVIDED");
              }}
            >
              <Icon aria-hidden="true" />
              <b>{label}</b>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* ทุกแหล่งอยู่ตารางเดียวกัน — ตัดเย็บ/ลูกค้าส่งมาได้แถวลูกใต้แถว (เบสเคาะ D 2026-09-06 เลิกกล่องเทา) */}
          <div className={cn(c("tblw"), "hidden @2xl:block")}>
            <table className={cn(c("tbl itbl"), "min-w-[880px]")}>
              <Cols widths={[104, 0, 150, 104, 104, 78, 110, 34]} />
              <thead>
                <tr>
                  <th>แหล่ง</th>
                  <th>สินค้า</th>
                  <th>แพค</th>
                  <th className={c("num")}>ราคา/ตัว</th>
                  <th className={c("num")}>ส่วนลด/ตัว</th>
                  <th className={c("ctr")}>จำนวน</th>
                  <th className={c("num")}>รวม</th>
                  <th><span className="sr-only">จัดลำดับและลบสินค้า</span></th>
                </tr>
              </thead>
              <tbody>
                {item.products.map((prod, pIdx) => (
                  <ProductTableRow
                    key={prod.formKey ?? `stock-table-${pIdx}`}
                    product={prod}
                    prodIdx={pIdx}
                    itemIdx={itemIdx}
                    totalProducts={item.products.length}
                    onSetItems={onSetItems}
                  />
                ))}
              </tbody>
              {/* ยอดชุดงานรวมลายและส่วนเสริมแล้ว — ตัวเลขเดียวกับหัวการ์ด (ต้นแบบที่เบสเคาะ) */}
              <tfoot>
                <tr>
                  <td colSpan={5}>รวมชุดงานนี้</td>
                  <td className={c("ctr")}><b>{totalQty.toLocaleString("th-TH")}</b></td>
                  <td className={c("num mono")}><b>{formatBaht(subtotal)}</b></td>
                  <td aria-hidden="true" />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* พื้นที่แคบใช้การ์ด ไม่บีบตาราง 8 คอลัมน์ลงมือถือ/แท็บเล็ต */}
          <div className="space-y-2.5 @2xl:hidden">
            {item.products.map((prod, pIdx) => (
              <ProductCardMobile
                key={prod.formKey ?? `stock-mobile-${pIdx}`}
                product={prod}
                prodIdx={pIdx}
                itemIdx={itemIdx}
                totalProducts={item.products.length}
                onSetItems={onSetItems}
              />
            ))}
            <p className={c("srow")}>
              <span>รวมชุดงานนี้ {totalQty.toLocaleString("th-TH")} ตัว</span>
              <b>{formatBaht(subtotal)}</b>
            </p>
          </div>
        </>
      )}
    </>
  );

  // ── ส่วนเสริม ──
  const addonsSection = (
    <>
      <div className={c("sub-h")}>
        <h3>
          <span className={c("tm")} aria-hidden="true"><Files /></span>
          ส่วนเสริมในชุดงาน
        </h3>
        {item.addons.length > 0 && (
          <div className={c("r")}>
            <button type="button" className={c("btn ghost sm")} onClick={() => onAddAddon(itemIdx)}>
              <Plus aria-hidden="true" />เพิ่มส่วนเสริม
            </button>
          </div>
        )}
      </div>
      {item.addons.length === 0 ? (
        <button type="button" className={c("drop act")} onClick={() => onAddAddon(itemIdx)}>
          <Files aria-hidden="true" />
          <b>เพิ่มส่วนเสริม</b>
        </button>
      ) : (
        <>
          <div className={cn(c("tblw"), "hidden @2xl:block")}>
            <table className={c("tbl itbl")}>
              <Cols widths={[0, 150, 110, 34]} />
              <thead>
                <tr>
                  <th>ส่วนเสริม</th>
                  <th>คิดราคา</th>
                  <th className={c("num")}>ราคา</th>
                  <th><span className="sr-only">ลบส่วนเสริม</span></th>
                </tr>
              </thead>
              <tbody>
                {item.addons.map((a, aIdx) => (
                  <tr key={aIdx}>
                    <td>{renderAddonField(a, aIdx, true)}</td>
                    <td>
                      <Select aria-label={`วิธีคิดราคาส่วนเสริม ${aIdx + 1}`} value={a.pricingType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")} size="dense">
                        <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                        <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                      </Select>
                    </td>
                    <td className={c("num")}>
                      <MoneyInput currency aria-label={`ราคาส่วนเสริม ${aIdx + 1}`} value={a.unitPrice} onValueChange={(v) => onUpdateAddon(itemIdx, aIdx, "unitPrice", v)} size="dense" />
                    </td>
                    <td className={c("act")}>
                      <button type="button" className={c("ibtn")} aria-label={`ลบส่วนเสริม ${aIdx + 1}`} onClick={() => onRemoveAddon(itemIdx, aIdx)}>
                        <Trash aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2.5 @2xl:hidden">
            {item.addons.map((addon, addonIdx) => (
              <div key={addonIdx} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted">
                    ส่วนเสริม #{addonIdx + 1}
                  </p>
                  <button type="button" className={c("ibtn")} aria-label={`ลบส่วนเสริม ${addonIdx + 1}`} onClick={() => onRemoveAddon(itemIdx, addonIdx)}>
                    <Trash aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ส่วนเสริม" className="col-span-2">{renderAddonField(addon, addonIdx, false)}</Field>
                  <Field label="คิดราคา">
                    <Select aria-label={`วิธีคิดราคาส่วนเสริม ${addonIdx + 1}`} value={addon.pricingType} onChange={(e) => onUpdateAddon(itemIdx, addonIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")}>
                      <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                      <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                    </Select>
                  </Field>
                  <Field label="ราคา">
                    <MoneyInput currency aria-label={`ราคาส่วนเสริม ${addonIdx + 1}`} value={addon.unitPrice} onValueChange={(v) => onUpdateAddon(itemIdx, addonIdx, "unitPrice", v)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  // ── หมายเหตุ ──
  const notesField = (
    <Field label="หมายเหตุการผลิตชุดนี้" className={c("full meas")}>
      <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="รายละเอียดที่ทีมผลิตต้องรู้..." />
    </Field>
  );

  // ── สรุปราคาต่อรายการ (เฉพาะโหมดปกติ — compact ใช้สรุปรวมที่ sidebar) ──
  const priceSummary = totalQty > 0 ? (
    <div className="border-t border-border/70 pt-3/60">
      <p className={cn(groupHeadingClass, "mb-2")}>สรุปราคารายการ</p>
      <table className="w-full text-xs">
        <tbody className="text-secondary">
          {itemPriceSummary.lines.map((line) => {
            return (
              <tr key={line.key}>
                <td className="py-1">
                  <span className="text-secondary">{line.label}</span>
                  {line.detail && (
                    <span className={cn("ml-1 text-muted", line.kind === "addon" && "text-xs")}>
                      ({line.detail})
                    </span>
                  )}
                  {line.kind === "product" && (line.discount || 0) > 0 && (
                    <span className="ml-1 text-red-500">-{formatCurrency(line.discount || 0)}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-muted">{formatCurrency(line.unitPrice)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-muted">×{line.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(line.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/70/60">
            <td colSpan={2} className="pt-2 text-sm font-semibold text-strong">
              รวมทั้งหมด
            </td>
            <td className="px-2 pt-2 text-right text-xs tabular-nums text-muted">
              {totalQty} ตัว
            </td>
            <td className="pt-2 text-right text-sm font-semibold tabular-nums text-strong">
              {formatCurrency(subtotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="text-xs text-muted">
              เฉลี่ย {formatCurrency(itemPriceSummary.averageUnitPrice ?? 0)} / ตัว
            </td>
            <td aria-hidden="true" />
          </tr>
        </tfoot>
      </table>
    </div>
  ) : null;

  return (
    // หนึ่งชุดงาน = หนึ่งการ์ด (.card ของ kit) ไม่มี card ใหญ่ครอบ
    // (เบส 2026-08-14: รายการที่ 2 ต้องแยกเป็นการ์ดใหม่) · id/tabIndex = ปลายทางโฟกัสตอนเพิ่มรายการ
    <article
      id={cardId}
      tabIndex={-1}
      role="listitem"
      aria-labelledby={headingId}
      className={cn(c("card"), "scroll-mt-24 outline-none", FOCUS_BUTTON)}
    >
      <OrderItemRow
        item={item} itemIdx={itemIdx} canRemove={canRemove}
        headingId={headingId}
        onUpdateItem={onUpdateItem}
        onRemoveItem={onRemoveItem}
        onDuplicateItem={() => onDuplicateItem(itemIdx)}
        canDuplicate={itemHasContent(item)}
      />

      {expanded && (
        // ลำดับในการ์ดเดียวกันทั้งหน้าเปิดงานและหน้าแก้: ลาย → สินค้า → ส่วนเสริม → หมายเหตุ (มติ 2026-08-14)
        // @container = จุดวัดความกว้างที่สลับตาราง ↔ การ์ดจอแคบ
        <div className={cn(c("cb ibody"), "@container")}>
          {showPrints && printsSection}
          {productsSection}
          {showAddons && addonsSection}
          {notesField}
          {!compact && priceSummary}
        </div>
      )}
    </article>
  );
}
