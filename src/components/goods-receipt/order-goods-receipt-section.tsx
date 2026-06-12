"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
import { GoodsReceiptDialog } from "./goods-receipt-dialog";
import { ClipboardCheck, PackageOpen, Undo2, ImageIcon } from "lucide-react";

// การ์ด "ของเข้า / ตรวจรับ" บนหน้าออเดอร์ — จุดเดียวที่แอดมินบันทึกของเข้าโรงงาน
// (เสื้อลูกค้า/เสื้อโรงเย็บ) + คืนของลูกค้า · รับกลับร้านนอกบันทึกที่หน้า /outsource
// โชว์เฉพาะออเดอร์ที่มีของต้องรับ (เสื้อลูกค้า/โรงเย็บ) หรือมีใบแล้ว

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

  const { data: receipts } = trpc.goodsReceipt.listByOrder.useQuery(
    { orderId },
    { enabled: hasCustomerGarment || hasSewingGarment }
  );

  if (!hasCustomerGarment && !hasSewingGarment && (receipts?.length ?? 0) === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4 text-slate-400" />
            ของเข้า / ตรวจรับ
          </CardTitle>
          {canReceive && (
            <div className="flex flex-wrap gap-2">
              {hasCustomerGarment && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setDialogType("CUSTOMER_GARMENT")}
                >
                  <PackageOpen className="h-3.5 w-3.5" />
                  รับเสื้อลูกค้า
                </Button>
              )}
              {hasSewingGarment && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setDialogType("SEWING_GARMENT")}
                >
                  <PackageOpen className="h-3.5 w-3.5" />
                  รับเสื้อโรงเย็บ
                </Button>
              )}
              {hasCustomerGarment && (receipts?.length ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-slate-500"
                  onClick={() => setDialogType("CUSTOMER_RETURN")}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  คืนของลูกค้า
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {(receipts ?? []).length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-400">
            ยังไม่มีใบตรวจรับ — ของเข้าโรงงานเมื่อไหร่ กดนับทันที (นับจริงต่อไซส์)
          </p>
        ) : (
          (receipts ?? []).map((r) => {
            const counted = r.lines.reduce((s, l) => s + l.qtyCounted, 0);
            const defects = r.lines.reduce((s, l) => s + l.defectQty, 0);
            const shortages = r.lines.filter(
              (l) => r.receiptType !== "CUSTOMER_RETURN" && l.qtyCounted !== l.qtyExpected
            ).length;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {RECEIPT_TYPE_LABELS[r.receiptType as ReceiptType] ?? r.receiptType}
                    <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">
                      {counted} ตัว
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(r.receivedAt)} · {r.receivedBy.name}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.photoUrls.length > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-slate-400">
                      <ImageIcon className="h-3 w-3" />
                      {r.photoUrls.length}
                    </span>
                  )}
                  {defects > 0 && (
                    <Badge variant="destructive" size="sm">
                      ตำหนิ {defects}
                    </Badge>
                  )}
                  {shortages > 0 && (
                    <Badge variant="warning" size="sm">
                      ขาด/เกิน {shortages} รายการ
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {dialogType && (
        <GoodsReceiptDialog
          orderId={orderId}
          receiptType={dialogType}
          onClose={() => setDialogType(null)}
        />
      )}
    </Card>
  );
}
