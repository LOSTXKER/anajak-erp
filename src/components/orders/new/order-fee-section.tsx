"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { c, CardHead } from "@/components/kit/kit";
import { Plus, Trash, ReceiptText } from "lucide-react";
import { resolveFeeCatalogSelection } from "@/lib/order-item-composer";
import type { OrderFeeForm } from "@/types/order-form";
import { cn, formatBaht } from "@/lib/utils";

/** ค่าที่ตรงกับคอมเมนต์ใน schema (DESIGN_FEE, SCREEN_SETUP, ..., CUSTOM) */
const CUSTOM_FEE_TYPE = "CUSTOM";
/** ค่าใน <option> เท่านั้น ไม่ได้เก็บลงฐานข้อมูล */
const OTHER_FEE_OPTION = "__other";

interface FeeCatalogItem {
  id: string;
  name: string;
  type: string;
  defaultPrice: number;
  pricingType: string;
}

interface OrderFeeSectionProps {
  fees: OrderFeeForm[];
  onAddFee: () => void;
  onRemoveFee: (idx: number) => void;
  onUpdateFee: (idx: number, field: string, value: unknown) => void;
  feeCatalog?: FeeCatalogItem[];
}

export function OrderFeeSection({
  fees,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
  feeCatalog,
}: OrderFeeSectionProps) {
  const hasCatalog = !!feeCatalog && feeCatalog.length > 0;

  /* ช่อง "ประเภท" ที่เคยให้พิมพ์เองถูกถอดออก (เบส 2026-08-04 "ประเภทจะมีไว้ทำไม") —
     มันคือรหัสภายในอย่าง SHIPPING/SETUP ที่คนขายไม่ควรต้องจำหรือพิมพ์
     ตอนนี้ระบบตั้งให้เองจากรายการที่เลือก · เลือก "อื่นๆ" = CUSTOM แล้วพิมพ์ชื่อเอง */
  const currentValue = (f: OrderFeeForm) => {
    const hit = feeCatalog?.find((entry) => entry.name === f.name && entry.type === f.feeType);
    if (hit) return hit.id;
    return f.feeType ? OTHER_FEE_OPTION : "";
  };

  const handleCatalogSelect = (fIdx: number, catalogId: string) => {
    if (catalogId === OTHER_FEE_OPTION) {
      // เลือก "อื่นๆ" = ตั้งประเภทเป็น CUSTOM แล้วปล่อยให้พิมพ์ชื่อ/ยอดเอง
      onUpdateFee(fIdx, "feeType", CUSTOM_FEE_TYPE);
      onUpdateFee(fIdx, "description", undefined);
      onUpdateFee(fIdx, "notes", undefined);
      return;
    }
    const selection = resolveFeeCatalogSelection(feeCatalog, catalogId);
    if (!selection) return;
    onUpdateFee(fIdx, "feeType", selection.feeType);
    onUpdateFee(fIdx, "name", selection.name);
    onUpdateFee(fIdx, "amount", selection.amount);
    // เปลี่ยนรายการจาก catalog = เริ่ม metadata ของรายการใหม่ ไม่ปนคำอธิบายเดิมที่ซ่อนอยู่
    onUpdateFee(fIdx, "description", undefined);
    onUpdateFee(fIdx, "notes", undefined);
  };

  const catalogOptions = (
    <>
      <option value="">เลือก...</option>
      {hasCatalog &&
        feeCatalog!.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name} — {formatBaht(entry.defaultPrice)}
          </option>
        ))}
      <option value={OTHER_FEE_OPTION}>อื่นๆ (พิมพ์ชื่อเอง)</option>
    </>
  );

  const removeButton = (fIdx: number) => (
    <button
      type="button"
      className={c("ibtn")}
      aria-label={`ลบค่าใช้จ่าย ${fIdx + 1}`}
      onClick={() => onRemoveFee(fIdx)}
    >
      <Trash aria-hidden="true" />
    </button>
  );

  // การ์ดของตัวเอง (ต้นแบบ tabPricing) — ปุ่มเพิ่มอยู่หัวการ์ดเสมอ ว่างแล้วมีกล่องเส้นประให้กดอีกทาง
  return (
    <section className={c("card")}>
      <CardHead
        icon={ReceiptText}
        tone="good"
        title="ค่าใช้จ่ายเพิ่มเติม"
        right={
          <button type="button" className={c("btn ghost sm")} onClick={onAddFee}>
            <Plus aria-hidden="true" />
            เพิ่มค่าใช้จ่าย
          </button>
        }
      />
      <div className={c("cb")}>
        {fees.length === 0 ? (
          <button type="button" className={c("drop act")} onClick={onAddFee}>
            <ReceiptText aria-hidden="true" />
            <b>เพิ่มค่าใช้จ่าย</b>
          </button>
        ) : (
          <>
            {/* ตาราง 1 ค่าใช้จ่าย = 1 แถว (เบสสั่ง 2026-08-04) — หัวคอลัมน์ครั้งเดียว ไม่ซ้ำทุกแถว
                · เกณฑ์ใช้ sm: (ขนาดจอ) เท่านั้น — container query ไม่ทำงานบนหน้านี้ */}
            <div className={cn(c("tblw"), "hidden sm:block")}>
              <table className={c("tbl ftbl")}>
                <colgroup>
                  <col style={{ width: 210 }} />
                  <col />
                  <col style={{ width: 124 }} />
                  <col style={{ width: 34 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>ชื่อที่ขึ้นบนบิล</th>
                    <th className={c("num")}>จำนวนเงิน</th>
                    <th>
                      <span className="sr-only">ลบค่าใช้จ่าย</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f, fIdx) => (
                    <tr key={fIdx}>
                      <td>
                        <Select
                          size="sm"
                          aria-label={`รายการค่าใช้จ่ายแถว ${fIdx + 1}`}
                          value={currentValue(f)}
                          onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                        >
                          {catalogOptions}
                        </Select>
                      </td>
                      <td>
                        <Input
                          size="sm"
                          aria-label={`ชื่อค่าใช้จ่าย ${fIdx + 1}`}
                          value={f.name}
                          onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                          placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                        />
                      </td>
                      <td className={c("num")}>
                        <MoneyInput
                          currency
                          size="sm"
                          required
                          aria-label={`จำนวนเงินค่าใช้จ่าย ${fIdx + 1}`}
                          value={f.amount}
                          onValueChange={(v) => onUpdateFee(fIdx, "amount", v)}
                        />
                      </td>
                      <td className={c("act")}>{removeButton(fIdx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* จอแคบ: ตาราง 4 คอลัมน์ลงไม่ไหว — ใช้ชุดช่องต่อรายการเหมือนที่อื่นในหน้านี้ */}
            <div className="space-y-4 sm:hidden">
              {fees.map((f, fIdx) => (
                <div key={fIdx} className="space-y-2">
                  <Field label="รายการ">
                    <Select
                      value={currentValue(f)}
                      onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                    >
                      {catalogOptions}
                    </Select>
                  </Field>
                  <Field label="ชื่อที่ขึ้นบนบิล">
                    <Input
                      value={f.name}
                      onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                      placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    <Field label="จำนวนเงิน" required className="min-w-0 flex-1">
                      <MoneyInput
                        currency
                        value={f.amount}
                        onValueChange={(v) => onUpdateFee(fIdx, "amount", v)}
                      />
                    </Field>
                    <span className="flex min-h-11 items-center">{removeButton(fIdx)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
