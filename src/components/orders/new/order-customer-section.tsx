"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/customer-picker";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { formatCurrency } from "@/lib/utils";

// ช่องเลือกลูกค้า + ป้ายบริบทครบ (นิติบุคคล/โปรไฟล์ขาด/วงเงินเครดิต)
// แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12 — พฤติกรรมเดิมทุกอย่าง

const labelClass = "mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400";

interface OrderCustomerSectionProps {
  customerId: string;
  selectedCustomer: PickerCustomer | null;
  onSelect: (id: string, customer: PickerCustomer | null) => void;
}

export function OrderCustomerSection({
  customerId,
  selectedCustomer,
  onSelect,
}: OrderCustomerSectionProps) {
  const isCorporate = selectedCustomer?.customerType === "CORPORATE";

  // ภาระหนี้เทียบวงเงิน — เตือนตั้งแต่ตอนเลือกลูกค้า (ด่านจริงอยู่ฝั่ง server ตอนยืนยันออเดอร์)
  const creditStatus = trpc.customer.creditStatus.useQuery(
    { customerId },
    { enabled: !!customerId && selectedCustomer?.creditLimit != null }
  );

  return (
    <div>
      <label className={labelClass}>ลูกค้า *</label>
      <CustomerPicker value={customerId} onChange={onSelect} required />
      {selectedCustomer && isCorporate && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge variant="accent" size="sm">
            นิติบุคคล
          </Badge>
          {selectedCustomer.taxId && (
            <span className="text-[11px] text-slate-500">
              Tax ID: {selectedCustomer.taxId}
            </span>
          )}
        </div>
      )}
      {selectedCustomer && customerProfileGaps(selectedCustomer).length > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          โปรไฟล์ยังไม่ครบ:{" "}
          {customerProfileGaps(selectedCustomer)
            .map((g) => g.label)
            .join(" · ")}{" "}
          — ขอจากลูกค้าแล้วเติมได้ที่หน้าลูกค้า
        </p>
      )}
      {creditStatus.data?.available != null && (
        <p
          className={`mt-1.5 text-[11px] ${
            creditStatus.data.available < 0
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-slate-500"
          }`}
        >
          วงเงินเครดิต: ใช้ไป {formatCurrency(creditStatus.data.exposure)} /{" "}
          {formatCurrency(creditStatus.data.creditLimit ?? 0)}
          {creditStatus.data.available < 0
            ? ` — เกินวงเงินแล้ว ${formatCurrency(Math.abs(creditStatus.data.available))}`
            : ` (ใช้ได้อีก ${formatCurrency(creditStatus.data.available)})`}
        </p>
      )}
    </div>
  );
}
