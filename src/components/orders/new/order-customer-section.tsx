"use client";

import { useState } from "react";
import { ChevronRight, Film, ImageIcon, Landmark, Users } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { c, CardHead } from "@/components/kit/kit";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/customer-picker";
import { CustomerTypeChip } from "@/components/customers/customer-type";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { formatBaht } from "@/lib/utils";
import { customerContactName, customerDisplayName } from "@/lib/customer-name";

// ช่องเลือกลูกค้า + ป้ายบริบทครบ (นิติบุคคล/โปรไฟล์ขาด/วงเงินเครดิต)
// แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12 — พฤติกรรมเดิมทุกอย่าง
// หน้าตาการ์ดลูกค้า = tabIntake ของต้นแบบ mockup-order-form-2026-09-18 (.cust)

interface OrderCustomerSectionProps {
  customerId: string;
  selectedCustomer: PickerCustomer | null;
  onSelect: (id: string, customer: PickerCustomer | null) => void;
  invalid?: boolean;
  lockedReason?: string;
}

/** ตัวย่อบนวงกลม — ตัดคำนำหน้านิติบุคคลออกก่อน ไม่งั้นทุกบริษัทขึ้น "บร" เหมือนกันหมด */
const NAME_PREFIXES = ["บริษัท ", "บจก.", "ห้างหุ้นส่วนจำกัด ", "หจก.", "ร้าน ", "คุณ "];
function initials(label: string): string {
  let text = label.trim();
  for (const prefix of NAME_PREFIXES) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  return text.slice(0, 2) || "?";
}

export function OrderCustomerSection({
  customerId,
  selectedCustomer,
  onSelect,
  invalid = false,
  lockedReason,
}: OrderCustomerSectionProps) {
  const profileGaps = selectedCustomer
    ? customerProfileGaps(selectedCustomer)
    : [];

  // วงเงินเครดิต = เงินฝั่งขาย — ช่าง/กราฟิกห้ามเห็น (Policy ⑦ · server requireRole แล้ว
  // หน้านี้เป็นของทีมขายอยู่แล้ว แต่กันไว้อีกชั้น) · me ยังไม่โหลด = ซ่อนก่อน (B12)
  const [changing, setChanging] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const canSeeCredit = permAllows(me?.permissions, "see_order_money");
  const showCreditStatus = canSeeCredit && !!customerId && !!selectedCustomer;
  const shouldLoadCredit =
    showCreditStatus && selectedCustomer.creditLimit != null;

  // ภาระหนี้เทียบวงเงิน — เตือนตั้งแต่ตอนเลือกลูกค้า (ด่านจริงอยู่ฝั่ง server ตอนยืนยันออเดอร์)
  const creditStatus = trpc.customer.creditStatus.useQuery(
    { customerId },
    { enabled: shouldLoadCredit }
  );
  const creditLoading =
    shouldLoadCredit &&
    !creditStatus.data &&
    (creditStatus.isLoading || creditStatus.isFetching);
  const creditError =
    shouldLoadCredit && !creditStatus.data && creditStatus.isError;
  const available = shouldLoadCredit ? creditStatus.data?.available : null;

  // เช็คฟิล์มค้าง+คลังลายตอนรับงานซ้ำ (หนี้ก้อน 2 — ลูกค้าทักมาสั่งซ้ำ แอดมินคีย์ใบใหม่
  // คือเคสที่พบบ่อยกว่าปุ่มสำเนา) — query count เบาๆ ตัวเดียว ไม่ลากแถวมานับเอง
  const summary = trpc.artwork.customerSummary.useQuery(
    { customerId },
    { enabled: !!customerId }
  );
  const filmCount = summary.data?.filmCount ?? 0;
  const artworkCount = summary.data?.artworkCount ?? 0;

  /* เลือกลูกค้าแล้ว = ยุบช่องค้นหาเหลือสรุปว่าใครถูกเลือก (ต้นแบบ 2026-09-18)
     ของเดิมช่องค้นหา/ช่องเลือก/ปุ่มใหม่ ค้างอยู่ตลอด ทั้งที่งานตรงนั้นจบไปแล้ว */
  const picked = Boolean(selectedCustomer) && !changing;
  const label = customerDisplayName(selectedCustomer);
  const contact = [
    // ชื่อผู้ติดต่อขึ้นเป็นบรรทัดรองเฉพาะตอนไม่ซ้ำกับชื่อหลัก — ไม่มีก็ข้ามไปเบอร์/LINE เลย
    customerContactName(selectedCustomer),
    selectedCustomer?.phone,
    selectedCustomer?.lineId,
  ].filter(Boolean);
  const taxId = selectedCustomer?.taxId;
  const hasChips =
    creditLoading ||
    creditError ||
    available != null ||
    filmCount > 0 ||
    profileGaps.length > 0;

  return (
    <section className={c("card")}>
      <CardHead
        icon={Users}
        tone="blue"
        title="ลูกค้า"
        right={
          picked ? (
            lockedReason ? (
              <span className={c("chip gray")}>ล็อกไว้</span>
            ) : (
              <button type="button" className={c("btn sm")} onClick={() => setChanging(true)}>
                เปลี่ยนลูกค้า
              </button>
            )
          ) : undefined
        }
      />
      <div className={c("cb")}>
        {picked ? (
          <>
            <div className={c("cust")}>
              <span className={c("av")} aria-hidden="true">
                {initials(label)}
              </span>
              <span className={c("who")}>
                <span className={c("nm")}>
                  {label}
                  {/* เดิมขึ้นเฉพาะนิติบุคคล คนคีย์จึงแยกไม่ออกว่า "ไม่มีป้าย" แปลว่าบุคคลธรรมดา
                      หรือแค่ยังไม่ได้กรอก — ป้ายกลางตอบทั้งสองประเภท (เบสเคาะ 2026-09-18) */}
                  <CustomerTypeChip type={selectedCustomer?.customerType} />
                </span>
                {(contact.length > 0 || taxId) && (
                  <span className={c("sub")}>
                    {contact.join(" · ")}
                    {taxId && (
                      <>
                        {contact.length > 0 ? " · " : ""}เลขภาษี <span className={c("mono")}>{taxId}</span>
                      </>
                    )}
                  </span>
                )}
                {/* วงเงินและเรื่องที่ต้องรู้ = ชิป ไม่ใช่ประโยคต่อจุด และไม่ใช่ก้อนใหญ่แย่งสายตา
                   (เบสสั่ง 2026-09-18 "ไม่เป็น text ธรรมดา แต่ไม่ต้องเด่นไป") */}
                {hasChips && (
                  <span className={c("chips")}>
                    {creditLoading && <Skeleton className="h-[22px] w-44 rounded-full" />}
                    {creditError && (
                      <button type="button" className={c("btn sm")} onClick={() => void creditStatus.refetch()}>
                        โหลดสถานะเครดิตไม่สำเร็จ — ลองใหม่
                      </button>
                    )}
                    {available != null &&
                      (available < 0 ? (
                        <span className={c("chip bad")}>
                          <Landmark aria-hidden="true" />
                          เกินวงเงิน <b className={c("mono")}>{formatBaht(Math.abs(available))}</b>
                        </span>
                      ) : (
                        <span className={c("chip line")}>
                          <Landmark aria-hidden="true" />
                          วงเงินเหลือ <b className={c("mono")}>{formatBaht(available)}</b> จาก{" "}
                          {formatBaht(creditStatus.data?.creditLimit ?? 0)}
                        </span>
                      ))}
                    {filmCount > 0 && (
                      <span className={c("chip warn")}>
                        <Film aria-hidden="true" />
                        ฟิล์มพร้อมรีดค้าง <b>{filmCount}</b> รายการ
                      </span>
                    )}
                    {profileGaps.map((gap) => (
                      <span key={gap.key} className={c("chip warn")} title={gap.label}>
                        <span className="min-w-0 truncate">{gap.label}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {artworkCount > 0 && (
                <button
                  type="button"
                  className={c("btn ghost sm")}
                  onClick={() => window.open(`/customers/${customerId}`, "_blank", "noopener")}
                >
                  <ImageIcon aria-hidden="true" />
                  คลังลาย {artworkCount} ลาย
                  <ChevronRight className={c("arrow")} aria-hidden="true" />
                </button>
              )}
            </div>
            {lockedReason && <p className={c("hint")}>{lockedReason}</p>}
          </>
        ) : (
          <div className={c("form")}>
            <Field label="เลือกลูกค้า" id="new-order-customer" required description={lockedReason}>
              <CustomerPicker
                id="new-order-customer"
                value={customerId}
                onChange={(id, customer) => {
                  onSelect(id, customer);
                  if (id) setChanging(false);
                }}
                initialSelected={selectedCustomer}
                disabled={Boolean(lockedReason)}
                required
                invalid={invalid}
                layout="inline"
                autoFocusSearch={!lockedReason}
              />
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}
