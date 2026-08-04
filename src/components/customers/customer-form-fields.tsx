"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { PAYMENT_TERMS } from "@/lib/payment-terms";
import { cn } from "@/lib/utils";
import {
  hasCorporateDetails,
  type CustomerEditErrors,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { Building2, User } from "lucide-react";

// field ชุดเดียวของฟอร์มลูกค้า — ใช้ทั้งฟอร์มเพิ่ม (customers/page.tsx) และแก้ไข
// (customer-edit-dialog) กัน drift ที่ audit จับ: ฝั่งสร้างเคยเขียนช่องซ้ำเองแล้วหลุด
// validation (เลขภาษี/วงเงินไม่ถูกตรวจ) · โครง/ลำดับ/เงื่อนไขยึดฝั่งแก้ไขซึ่งครบกว่า
// ส่วนที่มีเฉพาะแก้ไข (กลุ่มลูกค้า segment, คำเตือน corporate ค้าง) คุมด้วย mode

const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "NEW", label: "ใหม่" },
  { value: "REGULAR", label: "ขาประจำ" },
  { value: "VIP", label: "VIP" },
  { value: "WHOLESALE", label: "ค้าส่ง" },
  { value: "RETAIL", label: "ค้าปลีก" },
  { value: "INACTIVE", label: "ไม่เคลื่อนไหว" },
];

const NONE = "__NONE__";

export function CustomerFormFields({
  form,
  set,
  errors,
  canEditCredit,
  mode = "edit",
}: {
  form: CustomerEditForm;
  set: (patch: Partial<CustomerEditForm>) => void;
  errors: CustomerEditErrors;
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES เห็นช่องแต่แก้ไม่ได้ (ตรง server)
  canEditCredit: boolean;
  mode?: "create" | "edit";
}) {
  const isEdit = mode === "edit";
  const isCorporate = form.customerType === "CORPORATE";
  // สลับเป็นบุคคลธรรมดาแล้วยังมีข้อมูลภาษี/บิล/วงเงินค้าง — ต้องเห็น section นี้ต่อ
  // (review B7 จับ MAJOR: เดิมซ่อนแต่ submit ส่งค่าเดิมกลับ → เลขภาษีบริษัทเก่าไหลเข้า
  // ใบกำกับของลูกค้าบุคคลแบบมองไม่เห็นและล้างไม่ได้) — โชว์พร้อมคำเตือนให้คนตัดสินใจล้างเอง
  // ฟอร์มสร้างเริ่มจากค่าว่างเสมอ เลยยังใช้เงื่อนไข isCorporate เดิม
  const hasCorporateLeftover = isEdit && !isCorporate && hasCorporateDetails(form);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset className={cn("space-y-2", !isEdit && "sm:col-span-2")}>
          <legend className="text-sm font-medium">ประเภทลูกค้า</legend>
          <SegmentedControl
            value={form.customerType}
            onChange={(v) => set({ customerType: v })}
            aria-label="ประเภทลูกค้า"
            className={isEdit ? "w-full" : undefined}
            options={[
              { value: "INDIVIDUAL", label: "บุคคลธรรมดา", icon: User },
              { value: "CORPORATE", label: "นิติบุคคล", icon: Building2 },
            ]}
          />
        </fieldset>
        {isEdit && (
          <Field label="กลุ่มลูกค้า" id="customer-segment">
            <Select
              className="w-full"
              value={form.segment}
              onChange={(e) =>
                set({ segment: e.target.value as CustomerEditForm["segment"] })
              }
            >
              {SEGMENT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label={`ชื่อ${isCorporate ? "ผู้ติดต่อ" : "ลูกค้า"}`}
          required
          error={errors.name}
        >
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field
          label="บริษัท"
          required={isCorporate}
          error={errors.company}
        >
          <Input
            value={form.company}
            onChange={(e) => set({ company: e.target.value })}
            required={isCorporate}
          />
        </Field>
        <Field label="โทรศัพท์">
          <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="LINE ID">
          <Input value={form.lineId} onChange={(e) => set({ lineId: e.target.value })} />
        </Field>
        <Field label="ชื่อในแชท">
          <Input
            value={form.chatName}
            onChange={(e) => set({ chatName: e.target.value })}
            placeholder="เช่น ร้านเสื้อพี่หนึ่ง"
          />
        </Field>
        <Field label="ลิงก์แชท" description="กดจากรายการออเดอร์แล้วเปิดห้องแชทได้เลย">
          <Input
            type="url"
            inputMode="url"
            value={form.chatUrl}
            onChange={(e) => set({ chatUrl: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="อีเมล">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field label="ที่อยู่ (จัดส่ง)">
          <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
      </div>

      {(isCorporate || hasCorporateLeftover) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            ข้อมูลนิติบุคคล
          </h4>
          {hasCorporateLeftover && (
            <Alert variant="warning" className="mb-3 text-xs" role="status">
              ลูกค้าเป็นบุคคลธรรมดาแต่ยังมีข้อมูลภาษี/วงเงินค้างอยู่ — ค่าพวกนี้ยังถูกใช้ออกใบกำกับ/กันวงเงินจริง
              ถ้าไม่ใช้แล้วให้ลบออกให้ว่างแล้วบันทึก
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="เลขผู้เสียภาษี"
              required={isCorporate}
              error={errors.taxId}
            >
              {/* required ทั้งสร้างและแก้ — นิติบุคคลไม่มีเลขภาษี = ใบกำกับผิดองค์ ม.86/4 */}
              <Input
                value={form.taxId}
                onChange={(e) => set({ taxId: e.target.value })}
                placeholder="เลข 13 หลัก"
                required={isCorporate}
              />
            </Field>
            <Field label="สาขา">
              <Input
                value={form.branchNumber}
                onChange={(e) => set({ branchNumber: e.target.value })}
                placeholder="00000 = สำนักงานใหญ่"
              />
            </Field>
            <Field
              label="วงเงินเครดิต (บาท)"
              description={!canEditCredit ? "ผู้จัดการ/บัญชีเป็นคนกำหนด" : undefined}
              error={errors.creditLimit}
            >
              <Input
                type="number"
                value={form.creditLimit}
                onChange={(e) => set({ creditLimit: e.target.value })}
                disabled={!canEditCredit}
                title={canEditCredit ? undefined : "ฝ่ายขายแก้วงเงินไม่ได้ — ผู้จัดการ/บัญชีกำหนด"}
              />
            </Field>
          </div>
          <Field
            label="เงื่อนไขการชำระเงิน (ค่าเริ่มต้น)"
            id="customer-payment-terms"
            className="mt-4"
          >
            <Select
              className="w-full sm:w-64"
              placeholder="ไม่กำหนด"
              value={form.defaultPaymentTerms || NONE}
              onChange={(e) =>
                set({
                  defaultPaymentTerms:
                    e.target.value === NONE ? "" : e.target.value,
                })
              }
            >
              <option value={NONE}>ไม่กำหนด</option>
              {PAYMENT_TERMS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ที่อยู่ออกใบกำกับภาษี" className="sm:col-span-2">
              <Input
                value={form.billingAddress}
                onChange={(e) => set({ billingAddress: e.target.value })}
                placeholder="เลขที่ ถนน"
              />
            </Field>
            <Field label="แขวง/ตำบล">
              <Input
                value={form.billingSubDistrict}
                onChange={(e) => set({ billingSubDistrict: e.target.value })}
              />
            </Field>
            <Field label="เขต/อำเภอ">
              <Input
                value={form.billingDistrict}
                onChange={(e) => set({ billingDistrict: e.target.value })}
              />
            </Field>
            <Field label="จังหวัด">
              <Input
                value={form.billingProvince}
                onChange={(e) => set({ billingProvince: e.target.value })}
              />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <Input
                value={form.billingPostalCode}
                onChange={(e) => set({ billingPostalCode: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}

      <Field label="หมายเหตุ">
        <Textarea
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
        />
      </Field>
    </>
  );
}
