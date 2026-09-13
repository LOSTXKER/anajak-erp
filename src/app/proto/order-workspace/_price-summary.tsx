"use client";

import { ArrowRight, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PREVIEW_FEES, PREVIEW_ORDER, PREVIEW_PRICING } from "../ui-reset/_order-data";
import styles from "./_price-summary.module.css";

export function WorkspacePriceSummary({ onOpenMoney }: { onOpenMoney: () => void }) {
  return (
    <section className={styles.summary} aria-labelledby="workspace-price-title">
      <header className={styles.heading}>
        <h2 id="workspace-price-title"><ReceiptText size={18} />สรุปราคา</h2>
        <span>{PREVIEW_ORDER.estimatedQuantity} ชิ้น</span>
      </header>

      <div className={styles.total}>
        <span>ยอดรวมสุทธิ</span>
        <strong>{formatCurrency(PREVIEW_PRICING.grandTotal)}</strong>
        <small>รวม VAT 7%</small>
      </div>

      <dl className={styles.breakdown}>
        <div><dt>รายการสินค้า</dt><dd>{formatCurrency(PREVIEW_PRICING.subtotalItems)}</dd></div>
        {PREVIEW_FEES.map(fee => <div key={fee.id}><dt>{fee.name}</dt><dd>{formatCurrency(fee.amount ?? 0)}</dd></div>)}
        <div><dt>VAT 7%</dt><dd>{formatCurrency(PREVIEW_PRICING.taxAmount)}</dd></div>
      </dl>

      <footer>
        <Button variant="ghost" className={styles.openMoney} onClick={onOpenMoney}>เงิน & บิล<ArrowRight /></Button>
      </footer>
    </section>
  );
}
