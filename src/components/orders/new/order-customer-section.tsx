"use client";

import { useState } from "react";
import { ChevronRight, Film, ImageIcon, Landmark, Users } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Section, SectionTitle } from "@/components/ui/section";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/customer-picker";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { formatCurrency } from "@/lib/utils";

// ช่องเลือกลูกค้า + ป้ายบริบทครบ (นิติบุคคล/โปรไฟล์ขาด/วงเงินเครดิต)
// แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12 — พฤติกรรมเดิมทุกอย่าง

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
  const isCorporate = selectedCustomer?.customerType === "CORPORATE";
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

  // เช็คฟิล์มค้าง+คลังลายตอนรับงานซ้ำ (หนี้ก้อน 2 — ลูกค้าทักมาสั่งซ้ำ แอดมินคีย์ใบใหม่
  // คือเคสที่พบบ่อยกว่าปุ่มสำเนา) — query count เบาๆ ตัวเดียว ไม่ลากแถวมานับเอง
  const summary = trpc.artwork.customerSummary.useQuery(
    { customerId },
    { enabled: !!customerId }
  );
  const filmCount = summary.data?.filmCount ?? 0;
  const artworkCount = summary.data?.artworkCount ?? 0;
  const hasCustomerContext =
    !!selectedCustomer &&
    (isCorporate ||
      profileGaps.length > 0 ||
      showCreditStatus ||
      filmCount > 0 ||
      artworkCount > 0);

  /* เลือกลูกค้าแล้ว = ยุบช่องค้นหาเหลือสรุปว่าใครถูกเลือก (ต้นแบบ 2026-09-18)
     ของเดิมช่องค้นหา/ช่องเลือก/ปุ่มใหม่ ค้างอยู่ตลอด ทั้งที่งานตรงนั้นจบไปแล้ว */
  const picked = Boolean(selectedCustomer) && !changing;
  const label = selectedCustomer?.company || selectedCustomer?.name || "";
  const contact = [
    selectedCustomer?.company ? selectedCustomer?.name : null,
    selectedCustomer?.phone,
    selectedCustomer?.lineId,
  ].filter(Boolean);

  return (
    <Section
      title={<SectionTitle icon={Users} tone="brand">ลูกค้า</SectionTitle>}
      action={
        picked ? (
          lockedReason ? (
            <InfoChip size="sm">ล็อกไว้</InfoChip>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setChanging(true)}>
              เปลี่ยนลูกค้า
            </Button>
          )
        ) : undefined
      }
    >
      {picked ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            >
              {initials(label)}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-strong [overflow-wrap:anywhere]">{label}</span>
                {isCorporate && <Badge variant="accent" size="sm">นิติบุคคล</Badge>}
              </p>
              <p className="text-xs text-muted [overflow-wrap:anywhere]">
                {contact.join(" · ")}
                {selectedCustomer?.taxId ? `${contact.length ? " · " : ""}เลขภาษี ${selectedCustomer.taxId}` : ""}
              </p>
            </div>
            {artworkCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => window.open(`/customers/${customerId}`, "_blank", "noopener")}
              >
                <ImageIcon />
                คลังลาย {artworkCount} ลาย
                <ChevronRight />
              </Button>
            )}
          </div>

          {/* วงเงินและเรื่องที่ต้องรู้ = ชิป ไม่ใช่ประโยคต่อจุด และไม่ใช่ก้อนใหญ่แย่งสายตา
             (เบสสั่ง 2026-09-18 "ไม่เป็น text ธรรมดา แต่ไม่ต้องเด่นไป") */}
          {(showCreditStatus || filmCount > 0 || profileGaps.length > 0) && (
            <InfoChipRow>
              {creditLoading && <Skeleton className="h-6 w-44" />}
              {creditError && (
                <Button type="button" variant="outline" size="sm" onClick={() => void creditStatus.refetch()}>
                  โหลดสถานะเครดิตไม่สำเร็จ — ลองใหม่
                </Button>
              )}
              {shouldLoadCredit && creditStatus.data?.available != null && (
                <InfoChip
                  icon={Landmark}
                  tone={creditStatus.data.available < 0 ? "error" : "neutral"}
                  strong={creditStatus.data.available < 0}
                >
                  {creditStatus.data.available < 0
                    ? `เกินวงเงิน ${formatCurrency(Math.abs(creditStatus.data.available))}`
                    : `วงเงินเหลือ ${formatCurrency(creditStatus.data.available)} จาก ${formatCurrency(creditStatus.data.creditLimit ?? 0)}`}
                </InfoChip>
              )}
              {filmCount > 0 && (
                <InfoChip icon={Film} tone="warning" strong>
                  ฟิล์มพร้อมรีดค้าง {filmCount} รายการ
                </InfoChip>
              )}
              {profileGaps.map((gap) => (
                <InfoChip key={gap.key} tone="warning">
                  {gap.label}
                </InfoChip>
              ))}
            </InfoChipRow>
          )}

          {lockedReason && <p className="text-xs text-muted">{lockedReason}</p>}
        </div>
      ) : (
        <div>
          <Label htmlFor="new-order-customer" className="mb-2 block">
            เลือกลูกค้า
            <span aria-hidden="true" className="ml-1 text-red-700 dark:text-red-400">*</span>
            <span className="sr-only"> (จำเป็น)</span>
          </Label>
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
          {lockedReason && <p className="mt-1.5 text-xs text-muted">{lockedReason}</p>}
        </div>
      )}
    </Section>
  );
}
