import { Alert } from "@/components/ui/alert";
import { DISPLAY_AMOUNT } from "@/components/ui/tokens";
import { formatCurrency } from "@/lib/utils";

type QuotationAmounts = {
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  items: readonly { totalPrice: number }[];
};

export function QuotationAmountSummary({ quotation }: { quotation: QuotationAmounts }) {
  const itemSubtotal = quotation.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemsMismatch = Math.round(itemSubtotal * 100) !== Math.round(quotation.subtotal * 100);

  return (
    <div className="mt-4 space-y-2 border-t border-divider pt-4">
      {itemsMismatch && (
        <Alert variant="warning" title="ยอดรายการไม่ตรงกับยอดที่บันทึก">
          รายการรวม {formatCurrency(itemSubtotal)} แต่ยอดก่อนส่วนลดและภาษีในใบเสนอราคาเป็น {formatCurrency(quotation.subtotal)} กรุณาตรวจสอบรายการก่อนปรับราคา
        </Alert>
      )}
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted">ยอดก่อนส่วนลดและภาษี</span>
        <span className="tabular-nums text-strong">{formatCurrency(quotation.subtotal)}</span>
      </div>
      {quotation.discount > 0 && (
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-muted">ส่วนลด</span>
          <span className="tabular-nums text-red-600 dark:text-red-400">-{formatCurrency(quotation.discount)}</span>
        </div>
      )}
      {quotation.tax > 0 && (
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-muted">ภาษี</span>
          <span className="tabular-nums text-strong">+{formatCurrency(quotation.tax)}</span>
        </div>
      )}
      <div className="flex justify-between gap-3 border-t border-border pt-3">
        <span className="text-base font-semibold text-strong">ยอดรวมทั้งหมด</span>
        <span className={DISPLAY_AMOUNT}>{formatCurrency(quotation.totalAmount)}</span>
      </div>
    </div>
  );
}
