"use client";

/**
 * ตรวจรับเสื้อลูกค้าในกล่องขั้นเลย ไม่เด้ง dialog (เบสสั่ง 2026-09-10 "ขอแบบไม่ต้องมี popup
 * เวลากดบันทึกตรวจรับเสื้อลูกค้า รู้สึกมันจะไม่ต่อเนื่อง และมันควรจะบันทึกได้ด้วย เพราะบางที
 * ลูกค้าส่งมาไม่ครบ")
 *
 * ใช้ service/mutation ชุดเดียวกับกล่องใบตรวจรับเดิมทุกอย่าง (`goodsReceipt.context` /
 * `goodsReceipt.create` / `confirmCustomerGarmentEvidence`) — ต่างแค่ที่วางและหน้าตาแถว
 * จึงยังได้ยอดนับจริงต่อไซซ์ ตำหนิ รูป หมายเหตุ และ idempotency เหมือนเดิม
 * รับไม่ครบก็บันทึกได้: ยอดที่เหลือยังค้างให้รับรอบหน้า และขั้นจะยังไม่ปิดจนกว่าจะครบ
 */

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { NumberInput } from "@/components/ui/number-input";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CONTROL_H } from "@/components/ui/control-size";
import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const TH = "px-3 py-3 text-xs font-medium";
const TD = "px-3 py-3 align-middle text-sm";

type Row = {
  orderItemProductId?: string;
  description: string;
  size?: string;
  color?: string | null;
  /** ยอดที่ยังค้างรับของแถวนี้ (แผนทั้งหมด − ที่รับมาแล้วสุทธิ) */
  remaining: number;
  planned: number;
  counted: number;
  defect: number;
};

export function GarmentReceiveInline({
  orderId,
  productionStepId,
  canRecord,
  footer,
}: {
  orderId: string;
  productionStepId: string;
  canRecord: boolean;
  /** ปุ่มอื่นของขั้น (แจ้งปัญหา) — วางแถวเดียวกับปุ่มบันทึก */
  footer?: React.ReactNode;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, refetch } = trpc.goodsReceipt.context.useQuery(
    { orderId, receiptType: "CUSTOMER_GARMENT" },
    { staleTime: 30_000 },
  );

  const [draft, setDraft] = useState<Record<string, { counted: number; defect: number }>>({});
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  // คงคีย์เดิมตลอดอายุฟอร์ม: ยิงซ้ำหลัง network error ต้องได้ใบเดิม ไม่ใช่ใบใหม่
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const invalidate = [
    utils.goodsReceipt.listByOrder,
    utils.goodsReceipt.context,
    utils.order.getById,
    utils.production.getById,
    utils.production.kanban,
    utils.factory.stationQueue,
  ];
  const create = useMutationWithInvalidation(trpc.goodsReceipt.create, {
    invalidate,
    onSuccess: () => {
      toast.success("บันทึกตรวจรับเสื้อลูกค้าแล้ว");
      setDraft({});
      setNotes("");
      setPhotoUrls([]);
    },
    onError: (err: { message?: string }) => toast.error("บันทึกไม่สำเร็จ", { description: err.message }),
  });
  const confirmExisting = useMutationWithInvalidation(trpc.goodsReceipt.confirmCustomerGarmentEvidence, {
    invalidate,
    onSuccess: () => toast.success("ยืนยันหลักฐานรับเสื้อและปิดขั้นแล้ว"),
    onError: (err: { message?: string }) => toast.error("ยืนยันหลักฐานไม่สำเร็จ", { description: err.message }),
  });

  if (isLoading) return <div className="px-5 py-4"><Skeleton className="h-24 rounded-xl" /></div>;
  if (isError || !data) {
    return (
      <div className="px-5 py-4">
        <QueryError message="โหลดรายการเสื้อลูกค้าไม่สำเร็จ" onRetry={() => void refetch()} />
      </div>
    );
  }

  const rows: Row[] = data.lines.map((line) => {
    const key = `${line.orderItemProductId}:${line.size ?? ""}:${line.color ?? ""}`;
    const remaining = Math.max(0, line.qtyExpected - line.qtyReceivedNet);
    const value = draft[key];
    return {
      orderItemProductId: line.orderItemProductId,
      description: line.description,
      size: line.size,
      color: line.color,
      remaining,
      planned: line.qtyExpected,
      // ค่าเริ่มต้น = ที่ยังค้าง (นับแล้วตรงก็กดบันทึกได้เลย แก้เฉพาะไซซ์ที่ไม่ตรง)
      counted: value?.counted ?? remaining,
      defect: value?.defect ?? 0,
    };
  });
  const keyOf = (row: Row) => `${row.orderItemProductId}:${row.size ?? ""}:${row.color ?? ""}`;
  const setRow = (row: Row, patch: Partial<{ counted: number; defect: number }>) =>
    setDraft((d) => ({ ...d, [keyOf(row)]: { counted: row.counted, defect: row.defect, ...patch } }));

  const totalPlanned = rows.reduce((n, r) => n + r.planned, 0);
  const totalRemaining = rows.reduce((n, r) => n + r.remaining, 0);
  const totalCounted = rows.reduce((n, r) => n + r.counted, 0);
  const totalDefect = rows.reduce((n, r) => n + r.defect, 0);
  // รับครบไปแล้วทั้งใบ = ไม่มีอะไรให้นับ เหลือแค่ยืนยันว่าหลักฐานเดิมครบเพื่อปิดขั้น
  const alreadyReceived = rows.length > 0 && totalRemaining === 0;
  const pending = create.isPending || confirmExisting.isPending;

  function save() {
    if (alreadyReceived) {
      confirmExisting.mutate({ productionStepId });
      return;
    }
    create.mutate({
      orderId,
      idempotencyKey,
      receiptType: "CUSTOMER_GARMENT",
      productionStepId,
      notes: notes || undefined,
      photoUrls,
      lines: rows.map((row) => ({
        orderItemProductId: row.orderItemProductId,
        description: row.description,
        size: row.size || undefined,
        color: row.color || undefined,
        qtyExpected: row.remaining,
        qtyCounted: row.counted,
        defectQty: row.defect,
      })),
    });
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">ออเดอร์นี้ไม่มีรายการเสื้อที่ลูกค้าส่งมา</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <caption className="sr-only">นับเสื้อลูกค้าต่อไซซ์</caption>
            <colgroup>
              <col />
              <col style={{ width: canRecord ? "23%" : "35%" }} />
              {canRecord ? <col style={{ width: "26%" }} /> : null}
              {canRecord ? <col style={{ width: "26%" }} /> : null}
            </colgroup>
            <thead className={TABLE_HEAD_SURFACE}>
              <tr>
                <th scope="col" className={cn(TH, "pl-5 text-left")}>ไซซ์</th>
                <th scope="col" className={cn(TH, "text-right", !canRecord && "pr-5")}>ยังไม่ได้รับ</th>
                {canRecord ? <th scope="col" className={cn(TH, "text-right")}>นับได้</th> : null}
                {canRecord ? <th scope="col" className={cn(TH, "pr-5 text-right")}>ตำหนิ</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {rows.map((row) => {
                const label = [row.description, row.color, row.size].filter(Boolean).join(" ");
                return (
                  <tr key={keyOf(row)} className="focus-within:bg-surface-muted">
                    <td className={cn(TD, "pl-5")}>
                      <p className="text-base font-semibold text-strong">{row.size ?? "ไม่ระบุ"}</p>
                      {row.color ? <p className="text-xs text-secondary [overflow-wrap:anywhere]">{row.color}</p> : null}
                    </td>
                    <td className={cn(TD, "text-right text-base font-semibold tabular-nums text-strong", !canRecord && "pr-5")}>
                      {row.remaining.toLocaleString("th-TH")}
                    </td>
                    {canRecord ? (
                      <td className={cn(TD, "text-right")}>
                        <NumberInput
                          integer
                          min={0}
                          value={row.counted}
                          onValueChange={(n) => setRow(row, { counted: n })}
                          disabled={pending || alreadyReceived}
                          placeholder="0"
                          aria-label={`นับได้ ${label}`}
                          className={cn(CONTROL_H, "w-full text-right")}
                        />
                      </td>
                    ) : null}
                    {canRecord ? (
                      <td className={cn(TD, "pr-5 text-right")}>
                        <NumberInput
                          integer
                          min={0}
                          value={row.defect}
                          onValueChange={(n) => setRow(row, { defect: n })}
                          disabled={pending || alreadyReceived}
                          placeholder="0"
                          aria-label={`ตำหนิ ${label}`}
                          className={cn(CONTROL_H, "w-full text-right")}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={cn("grid items-center border-t border-divider py-4", canRecord ? "grid-cols-[25%_23%_26%_26%]" : "grid-cols-[65%_35%]")}>
            <span className="pl-5 text-xs text-muted">รวมทั้งใบ</span>
            <span className={cn("px-3 text-right text-sm font-semibold tabular-nums text-strong", !canRecord && "pr-5")}>
              {totalRemaining.toLocaleString("th-TH")}
            </span>
            {canRecord ? (
              <span className="px-3 text-right text-sm font-semibold tabular-nums text-strong">{totalCounted.toLocaleString("th-TH")}</span>
            ) : null}
            {canRecord ? (
              <span className={cn("pl-3 pr-5 text-right text-sm font-semibold tabular-nums", totalDefect > 0 ? "text-amber-700 dark:text-amber-300" : "text-strong")}>
                {totalDefect.toLocaleString("th-TH")}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {canRecord && rows.length > 0 ? (
        <div className="space-y-3 border-t border-divider px-5 py-4">
          {alreadyReceived ? (
            <p className="text-sm text-secondary">
              รับเสื้อครบ {totalPlanned.toLocaleString("th-TH")} ตัวแล้ว — กดยืนยันเพื่อปิดขั้นนี้
            </p>
          ) : null}

          {extraOpen ? (
            <div className="space-y-2">
              {photoUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photoUrls.map((url) => (
                    <span key={url} className={cn("relative overflow-hidden border border-border", RADIUS.inner)}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- รูปหลักฐานที่เพิ่งอัปโหลด */}
                      <img src={url} alt="" className="h-16 w-16 object-cover" />
                      <ImageRemoveButton onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))} label="ลบรูปนี้" />
                    </span>
                  ))}
                </div>
              ) : null}
              <FileUpload
                bucket="designs"
                pathPrefix={`receipts/${orderId}`}
                accept="image/*"
                onUploaded={(url) => setPhotoUrls((prev) => [...prev, url])}
                onError={(msg) => toast.error(msg)}
              />
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                aria-label="หมายเหตุการตรวจรับ"
                rows={2}
                placeholder="หมายเหตุ (ถ้ามี) เช่น เสื้อมีคราบ 2 ตัว"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending}>
              {alreadyReceived ? "ยืนยันหลักฐานเดิมและปิดขั้น" : `บันทึกตรวจรับ ${totalCounted.toLocaleString("th-TH")} ตัว`}
            </Button>
            {!alreadyReceived ? (
              <Button variant="outline" onClick={() => setExtraOpen((v) => !v)}>
                {extraOpen ? "ซ่อนรูป/หมายเหตุ" : "เพิ่มรูป/หมายเหตุ"}
              </Button>
            ) : null}
            {footer}
          </div>
        </div>
      ) : footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-divider px-5 py-4">{footer}</div>
      ) : null}
    </div>
  );
}
