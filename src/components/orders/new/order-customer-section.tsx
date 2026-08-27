"use client";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
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

  return (
    <div>
      {/* ป้ายช่องบังคับช่องเดียวของหน้า ต้องหน้าตาเท่าป้ายช่องอื่นที่ <Field> วาดให้
          (14px/500/slate-700) — เดิมเป็น <p> 12px/400/slate-500 จึงเบากว่าช่องไม่บังคับ
          ที่อยู่ใต้มัน และดอกจันไม่มีคู่ dark: จนจมหายในธีมมืด (audit 2026-08-03)
          ใช้ <Label htmlFor> ไม่ใช่ <Field> เพราะ Field clone prop aria-* ลงลูก
          ซึ่ง CustomerPicker (ไม่ใช่ control เดี่ยว) ไม่รับ — กดที่ป้ายแล้วโฟกัสลงช่องได้เหมือนกัน */}
      <Label htmlFor="new-order-customer" className="mb-2 block">
        ลูกค้า
        <span aria-hidden="true" className="ml-1 text-red-700 dark:text-red-400">*</span>
        <span className="sr-only"> (จำเป็น)</span>
      </Label>
      <CustomerPicker
        id="new-order-customer"
        value={customerId}
        onChange={onSelect}
        initialSelected={selectedCustomer}
        disabled={Boolean(lockedReason)}
        required
        invalid={invalid}
        layout="inline"
        autoFocusSearch={!lockedReason}
      />
      {lockedReason && (
        <p className="mt-1.5 text-xs text-muted">{lockedReason}</p>
      )}
      {hasCustomerContext && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-surface-muted px-3 py-2.5">
          {selectedCustomer && isCorporate && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="accent" size="sm">
                นิติบุคคล
              </Badge>
              {selectedCustomer.taxId && (
                <span className="text-xs text-muted">
                  Tax ID: {selectedCustomer.taxId}
                </span>
              )}
            </div>
          )}
          {profileGaps.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              โปรไฟล์ยังไม่ครบ: {profileGaps.map((g) => g.label).join(" · ")} — เติมที่หน้าลูกค้า
            </p>
          )}
          {showCreditStatus && !shouldLoadCredit && (
            <p className="text-xs text-muted">
              ยังไม่ได้กำหนดวงเงินเครดิต
            </p>
          )}
          {creditLoading && (
            <div role="status" aria-label="กำลังโหลดสถานะเครดิต">
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </div>
          )}
          {creditError && (
            <Alert variant="error" className="text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>โหลดสถานะเครดิตไม่สำเร็จ</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void creditStatus.refetch()}
                >
                  ลองใหม่
                </Button>
              </div>
            </Alert>
          )}
          {shouldLoadCredit && creditStatus.data?.available != null && (
            <p
              className={`text-xs ${
                creditStatus.data.available < 0
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted"
              }`}
            >
              วงเงินเครดิต: ใช้ไป {formatCurrency(creditStatus.data.exposure)} /{" "}
              {formatCurrency(creditStatus.data.creditLimit ?? 0)}
              {creditStatus.data.available < 0
                ? ` — เกินวงเงินแล้ว ${formatCurrency(Math.abs(creditStatus.data.available))}`
                : ` (ใช้ได้อีก ${formatCurrency(creditStatus.data.available)})`}
            </p>
          )}
          {shouldLoadCredit &&
            !creditLoading &&
            !creditError &&
            creditStatus.data?.available == null && (
              <p className="text-xs text-muted">
                ยังไม่มีข้อมูลสถานะเครดิต
              </p>
            )}
          {selectedCustomer && filmCount > 0 && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              🎞️ ลูกค้ามีฟิล์มพร้อมรีดค้าง {filmCount} รายการ — เช็คที่{" "}
              <a
                href={`/production/films?search=${encodeURIComponent(selectedCustomer.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                คลังฟิล์ม
              </a>{" "}
              ก่อนเปิดรอบพิมพ์ใหม่
            </p>
          )}
          {selectedCustomer && artworkCount > 0 && (
            <p className="text-xs text-muted">
              ลูกค้ามีลายในคลัง {artworkCount} ลาย —{" "}
              <a
                href={`/customers/${customerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                ดูคลังลาย
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
