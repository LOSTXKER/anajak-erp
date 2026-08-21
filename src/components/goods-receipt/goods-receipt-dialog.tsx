"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { cn } from "@/lib/utils";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

import { FOCUS_FIELD } from "@/components/ui/tokens";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";

// ใบตรวจรับของเข้า/ใบคืนของลูกค้า — นับจริงต่อไซส์ + รูป + ตำหนิ (mobile-first:
// คนนับถือมือถือหน้ากองเสื้อ — แถวใหญ่ กดง่าย ไม่มีเรื่องเงิน)

interface PresetLine {
  orderItemProductId?: string;
  description: string;
  size?: string;
  color?: string | null;
  qtyExpected: number;
}

interface LineState {
  orderItemProductId?: string;
  description: string;
  size?: string;
  color?: string | null;
  qtyExpected: number;
  qtyCounted: number;
  defectQty: number;
  defectNote: string;
}

interface GoodsReceiptDialogProps {
  orderId: string;
  receiptType: ReceiptType;
  // OUTSOURCE_RETURN ส่งบรรทัดมาเอง (จากใบ outsource) — ชนิดอื่น prefill จากเนื้อออเดอร์
  presetLines?: PresetLine[];
  outsourceOrderId?: string;
  // จอสถานีต้องผูกคำสั่งกับ GARMENT_RECEIVE ที่กำลังทำจริง; หน้าออเดอร์ทั่วไปไม่ส่ง
  productionStepId?: string;
  onClose: () => void;
  onCreated?: () => void;
}

export function GoodsReceiptDialog(props: GoodsReceiptDialogProps) {
  const needContext = !props.presetLines;
  const { data: context, isLoading, isError, refetch } = trpc.goodsReceipt.context.useQuery(
    { orderId: props.orderId, receiptType: props.receiptType },
    { enabled: needContext, gcTime: 0, staleTime: 0 }
  );

  if (needContext && isError) {
    return (
      <Dialog open onOpenChange={(open) => !open && props.onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{RECEIPT_TYPE_LABELS[props.receiptType]}</DialogTitle>
          </DialogHeader>
          <QueryError
            message="โหลดรายการสำหรับตรวจรับไม่สำเร็จ"
            onRetry={() => void refetch()}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (needContext && (isLoading || !context)) {
    return (
      <Dialog open onOpenChange={(open) => !open && props.onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{RECEIPT_TYPE_LABELS[props.receiptType]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const lines: PresetLine[] =
    props.presetLines ??
    (context?.lines ?? []).map((l) => ({
      orderItemProductId: l.orderItemProductId,
      description: l.description,
      size: l.size,
      color: l.color,
      // ใบรับ: คาดว่าจะได้ส่วนที่ยังขาด · ใบคืน: คืนจากที่รับมาแล้ว (default 0 ให้คนกรอกเอง)
      qtyExpected:
        props.receiptType === "CUSTOMER_RETURN"
          ? Math.max(0, l.qtyReceivedNet)
          : Math.max(0, l.qtyExpected - l.qtyReceivedNet),
    }));

  return <ReceiptForm {...props} initialLines={lines} />;
}

function ReceiptForm({
  orderId,
  receiptType,
  outsourceOrderId,
  productionStepId,
  onClose,
  onCreated,
  initialLines,
}: GoodsReceiptDialogProps & { initialLines: PresetLine[] }) {
  const isReturn = receiptType === "CUSTOMER_RETURN";
  const [lines, setLines] = useState<LineState[]>(() =>
    initialLines.map((l) => ({
      ...l,
      // ใบรับ default = ที่คาด (นับแล้วตรงก็กดบันทึกได้เลย — แก้เฉพาะตัวที่ไม่ตรง)
      qtyCounted: isReturn ? 0 : l.qtyExpected,
      defectQty: 0,
      defectNote: "",
    }))
  );
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  // คง key เดิมตลอดอายุ dialog: network/notification error แล้วกดซ้ำต้องได้ใบเดิม
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const utils = trpc.useUtils();
  const create = useMutationWithInvalidation(trpc.goodsReceipt.create, {
    invalidate: [
      utils.goodsReceipt.listByOrder,
      utils.goodsReceipt.context,
      utils.order.getById,
      utils.production.getById,
      utils.production.kanban,
      utils.factory.stationQueue,
    ],
    onSuccess: () => {
      toast.success(`บันทึก${RECEIPT_TYPE_LABELS[receiptType]}แล้ว`);
      onCreated?.();
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    },
  });
  const confirmExistingEvidence = useMutationWithInvalidation(
    trpc.goodsReceipt.confirmCustomerGarmentEvidence,
    {
      invalidate: [
        utils.goodsReceipt.listByOrder,
        utils.goodsReceipt.context,
        utils.order.getById,
        utils.production.getById,
        utils.production.kanban,
        utils.factory.stationQueue,
      ],
      onSuccess: () => {
        toast.success("ยืนยันหลักฐานรับเสื้อและปิดขั้นแล้ว");
        onCreated?.();
        onClose();
      },
      onError: (err: { message?: string }) => {
        toast.error("ยืนยันหลักฐานไม่สำเร็จ", { description: err.message });
      },
    },
  );

  const update = (idx: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const totalCounted = lines.reduce((s, l) => s + l.qtyCounted, 0);
  const totalDefect = lines.reduce((s, l) => s + l.defectQty, 0);
  const isStationInspection =
    receiptType === "CUSTOMER_GARMENT" && !!productionStepId;
  const canConfirmExistingEvidence =
    isStationInspection &&
    lines.length > 0 &&
    lines.every((line) => line.qtyExpected === 0);

  function handleSave() {
    if (canConfirmExistingEvidence && productionStepId) {
      confirmExistingEvidence.mutate({ productionStepId });
      return;
    }
    create.mutate({
      orderId,
      idempotencyKey,
      receiptType,
      outsourceOrderId,
      productionStepId,
      notes: notes || undefined,
      photoUrls,
      lines: (isStationInspection
        ? lines
        : lines.filter((l) => l.qtyCounted > 0 || l.defectQty > 0))
        .map((l) => ({
          orderItemProductId: l.orderItemProductId,
          description: l.description,
          size: l.size || undefined,
          color: l.color || undefined,
          qtyExpected: isReturn ? 0 : l.qtyExpected,
          qtyCounted: l.qtyCounted,
          defectQty: l.defectQty,
          defectNote: l.defectNote || undefined,
        })),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{RECEIPT_TYPE_LABELS[receiptType]}</DialogTitle>
          <DialogDescription>
            {isReturn
              ? "ยอดคืนจะหักออกจากยอดรับของออเดอร์นี้"
              : canConfirmExistingEvidence
                ? "รายการนี้มีหลักฐานรับครบแล้ว — ยืนยันเพื่อปิดเฉพาะขั้นของสถานีนี้"
              : "นับจริงต่อไซส์ — ขาด/เกิน/มีตำหนิ ระบบแจ้งแอดมินให้ทันที"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {lines.length === 0 && (
            <p className="py-3 text-center text-sm text-slate-400">
              ไม่มีรายการให้{isReturn ? "คืน" : "ตรวจรับ"}
            </p>
          )}
          {lines.map((l, idx) => (
            <div
              key={`${l.orderItemProductId ?? "x"}-${l.size ?? ""}-${l.color ?? ""}-${idx}`}
              className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {l.description}
                    {l.size && (
                      <span className="ml-1.5 text-muted">
                        {l.size}
                        {l.color ? `/${l.color}` : ""}
                      </span>
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {isReturn ? `รับมาแล้วสุทธิ ${l.qtyExpected}` : `ที่คาด ${l.qtyExpected}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`receipt-count-${idx}`} className="text-xs text-muted">{isReturn ? "คืน" : "นับได้"}</label>
                  <Input
                    id={`receipt-count-${idx}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={l.qtyCounted}
                    onChange={(e) =>
                      update(idx, {
                        qtyCounted: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className={cn(
                      "w-20 text-center text-base tabular-nums",
                      !isReturn &&
                        l.qtyCounted !== l.qtyExpected &&
                        cn("border-amber-400", FOCUS_FIELD)
                    )}
                  />
                </div>
              </div>
              {!isReturn && (
                <div className="flex items-center gap-2">
                  <label htmlFor={`receipt-defect-${idx}`} className="text-xs text-muted">ตำหนิ</label>
                  <Input
                    id={`receipt-defect-${idx}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={l.defectQty}
                    onChange={(e) =>
                      update(idx, {
                        defectQty: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className="w-16 text-center tabular-nums"
                  />
                  {l.defectQty > 0 && (
                    <Input
                      value={l.defectNote}
                      onChange={(e) => update(idx, { defectNote: e.target.value })}
                      placeholder="ตำหนิอะไร เช่น รอยเปื้อน/รูขาด"
                      className="flex-1 text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* รูปถ่ายของจริง — แนบได้หลายรูป (กองเสื้อ/จุดตำหนิ) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">รูปถ่าย (ถ้ามี)</p>
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url) => (
                  <div key={url} className="group relative h-16 w-16">
                    {/* <img> ธรรมดา — รูปเสิร์ฟผ่าน /api/files (เช็ค session)
                        next/image optimizer fetch ฝั่ง server ไม่มี cookie จะ 401 */}
                    <img
                      src={url}
                      alt="รูปตรวจรับ"
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <ImageRemoveButton
                      onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                      label="ลบรูปตรวจรับ"
                    />
                  </div>
                ))}
              </div>
            )}
            <FileUpload
              bucket="designs"
              pathPrefix={`receipts/${orderId}`}
              accept="image/*"
              onUploaded={(url) => setPhotoUrls((prev) => [...prev, url])}
              onError={(msg) => toast.error(msg)}
            />
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="หมายเหตุ (ถ้ามี)"
          />
        </div>

        <DialogSubmitFooter
          pending={create.isPending || confirmExistingEvidence.isPending}
          disabled={
            !canConfirmExistingEvidence &&
            !isStationInspection &&
            totalCounted <= 0 &&
            totalDefect <= 0
          }
          submitLabel={
            canConfirmExistingEvidence
              ? "ยืนยันหลักฐานเดิมและปิดขั้น"
              : isStationInspection && totalCounted === 0 && totalDefect === 0
                ? "บันทึกผลตรวจ: ไม่พบของ"
                : `บันทึก ${totalCounted} ตัว`
          }
          submitIcon={<ClipboardCheck />}
          onCancel={onClose}
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
