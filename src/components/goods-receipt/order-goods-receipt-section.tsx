"use client";

import { useState } from "react";
import { AlertTriangle, PackageCheck, PackageOpen, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
import { c, CardHead, Rw, StateBox } from "@/components/orders/orders-ui";
import { GoodsReceiptDialog } from "./goods-receipt-dialog";

// การ์ด "ของเข้า / ตรวจรับ" ในแท็บงานผลิตของหน้าออเดอร์ — จุดเดียวที่แอดมินบันทึกของเข้าโรงงาน
// (เสื้อลูกค้า/เสื้อโรงเย็บ) + คืนของลูกค้า · รับกลับร้านนอกบันทึกที่หน้า /outsource
// โชว์เฉพาะออเดอร์ที่มีของต้องรับ (เสื้อลูกค้า/โรงเย็บ) หรือมีใบแล้ว · ใช้เฉพาะ flow เดิม (V2 ไม่วาง)
// หน้าตาตามต้นแบบรอบ 2 (รื้อ 2026-09-15): หัวการ์ดมีปุ่มรับของ · ใบตรวจรับเป็นแถว ไอคอนแดง = มีตำหนิ ส้ม = ขาด/เกิน

interface OrderGoodsReceiptSectionProps {
  orderId: string;
  // แหล่งเสื้อในออเดอร์ — หน้าออเดอร์มีข้อมูลอยู่แล้ว ส่งมาเพื่อเลือกปุ่มที่เกี่ยว
  itemSources: string[];
  canReceive: boolean;
}

export function OrderGoodsReceiptSection({
  orderId,
  itemSources,
  canReceive,
}: OrderGoodsReceiptSectionProps) {
  const [dialogType, setDialogType] = useState<ReceiptType | null>(null);
  const hasCustomerGarment = itemSources.includes("CUSTOMER_PROVIDED");
  const hasSewingGarment = itemSources.includes("CUSTOM_MADE");

  const { data: receipts, isLoading, isError, refetch } = trpc.goodsReceipt.listByOrder.useQuery(
    { orderId },
    { enabled: hasCustomerGarment || hasSewingGarment }
  );

  if (!hasCustomerGarment && !hasSewingGarment && (receipts?.length ?? 0) === 0) {
    return null;
  }

  const list = receipts ?? [];
  const actions = canReceive
    ? [
        hasCustomerGarment ? (
          <button
            key="customer"
            type="button"
            className={c("btn sm")}
            onClick={() => setDialogType("CUSTOMER_GARMENT")}
          >
            <PackageOpen aria-hidden="true" />
            รับเสื้อลูกค้า
          </button>
        ) : null,
        hasSewingGarment ? (
          <button
            key="sewing"
            type="button"
            className={c("btn sm")}
            onClick={() => setDialogType("SEWING_GARMENT")}
          >
            <PackageOpen aria-hidden="true" />
            รับเสื้อโรงเย็บ
          </button>
        ) : null,
        hasCustomerGarment && list.length > 0 ? (
          <button
            key="return"
            type="button"
            className={c("btn ghost sm")}
            onClick={() => setDialogType("CUSTOMER_RETURN")}
          >
            <Undo2 aria-hidden="true" />
            คืนของลูกค้า
          </button>
        ) : null,
      ].filter(Boolean)
    : [];

  return (
    <section className={c("card")} aria-labelledby="gr-card-h">
      <CardHead
        icon={PackageCheck}
        tone="warn"
        id="gr-card-h"
        title="ของเข้า / ตรวจรับ"
        right={actions.length > 0 ? <>{actions}</> : undefined}
      />
      <div className={c("cb")}>
        {isError ? (
          <StateBox
            tone="bad"
            icon={AlertTriangle}
            action={
              <button type="button" className={c("btn sm")} onClick={() => void refetch()}>
                ลองใหม่
              </button>
            }
          >
            โหลดรายการตรวจรับไม่สำเร็จ
          </StateBox>
        ) : isLoading ? (
          <span className={c("sk skrow")} aria-hidden="true" />
        ) : list.length === 0 ? (
          <StateBox icon={PackageOpen}>
            ยังไม่มีใบตรวจรับ — ของเข้าแล้วกดรับ นับจริงต่อไซส์
          </StateBox>
        ) : (
          <div className={c("rows")}>
            {list.map((r) => {
              const counted = r.lines.reduce((s, l) => s + l.qtyCounted, 0);
              const defects = r.lines.reduce((s, l) => s + l.defectQty, 0);
              const shortages = r.lines.filter(
                (l) => r.receiptType !== "CUSTOMER_RETURN" && l.qtyCounted !== l.qtyExpected
              ).length;
              const hasFlags = r.photoUrls.length > 0 || defects > 0 || shortages > 0;
              return (
                <Rw
                  key={r.id}
                  icon={PackageCheck}
                  tone={defects > 0 ? "bad" : shortages > 0 ? "warn" : "good"}
                  title={
                    <>
                      {RECEIPT_TYPE_LABELS[r.receiptType as ReceiptType] ?? r.receiptType}{" "}
                      <span className={c("soft")}>{counted.toLocaleString("th-TH")} ตัว</span>
                    </>
                  }
                  sub={[formatDate(r.receivedAt), r.receivedBy.name, r.notes].filter(Boolean).join(" · ")}
                  right={
                    hasFlags ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {r.photoUrls.length > 0 ? (
                          <span className={c("chip gray")}>{r.photoUrls.length} รูป</span>
                        ) : null}
                        {defects > 0 ? <span className={c("chip bad")}>ตำหนิ {defects}</span> : null}
                        {shortages > 0 ? (
                          <span className={c("chip warn")}>ขาด/เกิน {shortages} รายการ</span>
                        ) : null}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {dialogType && (
        <GoodsReceiptDialog
          orderId={orderId}
          receiptType={dialogType}
          onClose={() => setDialogType(null)}
        />
      )}
    </section>
  );
}
