"use client";

import { useState } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
import { ClipboardCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

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
  onClose: () => void;
  onCreated?: () => void;
}

export function GoodsReceiptDialog(props: GoodsReceiptDialogProps) {
  const needContext = !props.presetLines;
  const { data: context, isLoading } = trpc.goodsReceipt.context.useQuery(
    { orderId: props.orderId, receiptType: props.receiptType },
    { enabled: needContext, gcTime: 0, staleTime: 0 }
  );

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

  const utils = trpc.useUtils();
  const create = useMutationWithInvalidation(trpc.goodsReceipt.create, {
    invalidate: [
      utils.goodsReceipt.listByOrder,
      utils.goodsReceipt.context,
      utils.order.getById,
      utils.production.getById,
      utils.production.kanban,
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

  const update = (idx: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const totalCounted = lines.reduce((s, l) => s + l.qtyCounted, 0);
  const totalDefect = lines.reduce((s, l) => s + l.defectQty, 0);

  function handleSave() {
    create.mutate({
      orderId,
      receiptType,
      outsourceOrderId,
      notes: notes || undefined,
      photoUrls,
      lines: lines
        .filter((l) => l.qtyCounted > 0 || l.defectQty > 0)
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
              className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {l.description}
                    {l.size && (
                      <span className="ml-1.5 text-slate-500">
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
                  <label className="text-xs text-slate-500">{isReturn ? "คืน" : "นับได้"}</label>
                  <Input
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
                      "h-11 w-20 text-center text-base tabular-nums",
                      !isReturn &&
                        l.qtyCounted !== l.qtyExpected &&
                        "border-amber-400 focus-visible:ring-amber-400"
                    )}
                  />
                </div>
              </div>
              {!isReturn && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">ตำหนิ</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={l.defectQty}
                    onChange={(e) =>
                      update(idx, {
                        defectQty: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className="h-9 w-16 text-center tabular-nums"
                  />
                  {l.defectQty > 0 && (
                    <Input
                      value={l.defectNote}
                      onChange={(e) => update(idx, { defectNote: e.target.value })}
                      placeholder="ตำหนิอะไร เช่น รอยเปื้อน/รูขาด"
                      className="h-9 flex-1 text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* รูปถ่ายของจริง — แนบได้หลายรูป (กองเสื้อ/จุดตำหนิ) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">รูปถ่าย (ถ้ามี)</p>
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url) => (
                  <div key={url} className="group relative h-16 w-16">
                    <Image
                      src={url}
                      alt="รูปตรวจรับ"
                      fill
                      sizes="64px"
                      className="rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={create.isPending || (totalCounted <= 0 && totalDefect <= 0)}
            className="gap-1.5"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            บันทึก {totalCounted} ตัว
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
