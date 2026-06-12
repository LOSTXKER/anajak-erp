"use client";

import { useState } from "react";
import Image from "next/image";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import {
  QC_DEFECT_REASONS,
  QC_DEFECT_REASON_LABELS,
  qcReasonLabel,
  type QcDefectReason,
} from "@/lib/qc";
import {
  ShieldCheck,
  ClipboardCheck,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// การ์ด "ตรวจนับ QC" บนหน้าออเดอร์ — นับของจุดที่ 2 ก่อนแพ็ค (FLOW-REDESIGN ก้อน 3)
// นับจริง "ดีกี่ตัว เสียกี่ตัว" · ดีล้วน→เด้งแพ็คเอง · มีเสีย→ถอยกลับผลิต+งานแก้อัตโนมัติ
// โชว์เฉพาะตอนอยู่ขั้นตรวจคุณภาพ หรือมีประวัติตรวจแล้ว (mobile-first: คนนับถือมือถือหน้ากองเสื้อ)

type QcContext = RouterOutput["qc"]["context"];

interface OrderQcSectionProps {
  orderId: string;
  internalStatus: string;
}

export function OrderQcSection({ orderId, internalStatus }: OrderQcSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isQualityCheck = internalStatus === "QUALITY_CHECK";
  const { data: records } = trpc.qc.listByOrder.useQuery({ orderId });

  if (!isQualityCheck && (records?.length ?? 0) === 0) return null;

  const rounds = records ?? [];
  const totalGood = rounds.reduce((s, r) => s + r.qtyGood, 0);
  const totalDefect = rounds.reduce((s, r) => s + r.qtyDefect, 0);
  // เรียง checkedAt desc — ตัวแรกคือรอบล่าสุด
  const latest = rounds[0];
  const latestReasons =
    latest && latest.qtyDefect > 0
      ? [...new Set(latest.defects.map((d) => qcReasonLabel(d.reason)))].join("/")
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            ตรวจนับ QC
          </CardTitle>
          {isQualityCheck && (
            <Button size="sm" className="h-9 gap-1 text-xs" onClick={() => setDialogOpen(true)}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              ตรวจนับ
            </Button>
          )}
        </div>
        {rounds.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ตรวจแล้ว {rounds.length} รอบ · ดี {totalGood} ตัว · เสีย {totalDefect} ตัว
            {latestReasons ? ` · รอบล่าสุดเสีย: ${latestReasons}` : ""}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {rounds.length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-400">
            ยังไม่มีผลตรวจ — นับจริงก่อนแพ็ค: ดีกี่ตัว เสียกี่ตัว
          </p>
        ) : (
          rounds.map((r, idx) => {
            const expanded = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="rounded-md border border-slate-100 dark:border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      ตรวจรอบที่ {rounds.length - idx}
                      <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">
                        ดี {r.qtyGood} · เสีย {r.qtyDefect}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(r.checkedAt)} · {r.checkedBy.name}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.qtyDefect > 0 ? (
                      <Badge variant="destructive" size="sm">
                        เสีย {r.qtyDefect}
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        ดีล้วน
                      </Badge>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-400 transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                    {r.defects.length === 0 ? (
                      <p className="text-xs text-slate-400">ไม่มีของเสียในรอบนี้</p>
                    ) : (
                      r.defects.map((d) => (
                        <div
                          key={d.id}
                          className="space-y-1.5 rounded-md bg-slate-50 p-2 dark:bg-slate-800/50"
                        >
                          <p className="text-xs">
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {d.qty} ตัว · {qcReasonLabel(d.reason)}
                            </span>
                            {d.size && (
                              <span className="text-slate-500">
                                {" "}
                                · ไซส์ {d.size}
                                {d.color ? `/${d.color}` : ""}
                              </span>
                            )}
                            {d.printLabel && (
                              <span className="text-slate-500"> · ลาย {d.printLabel}</span>
                            )}
                          </p>
                          {d.note && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{d.note}</p>
                          )}
                          {d.photoUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {d.photoUrls.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="relative block h-14 w-14"
                                >
                                  <Image
                                    src={url}
                                    alt="รูปของเสีย"
                                    fill
                                    sizes="56px"
                                    className="rounded-md object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      {dialogOpen && <QcCountDialog orderId={orderId} onClose={() => setDialogOpen(false)} />}
    </Card>
  );
}

// ============================================================
// Dialog นับจริง — โหลดบริบท (ยอดคาด/ลาย/เสื้อสำรอง) ก่อนเปิดฟอร์ม
// ============================================================

function QcCountDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: context, isLoading } = trpc.qc.context.useQuery(
    { orderId },
    { gcTime: 0, staleTime: 0 }
  );

  if (isLoading || !context) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>นับจริง: ดีกี่ตัว เสียกี่ตัว</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <QcCountForm orderId={orderId} context={context} onClose={onClose} />;
}

const NONE = "__NONE__";

interface DefectRow {
  qty: number;
  size: string; // "" = ไม่ระบุ
  printLabel: string; // "" = ไม่ระบุ
  reason: QcDefectReason | "";
  photoUrls: string[];
  note: string;
}

function QcCountForm({
  orderId,
  context,
  onClose,
}: {
  orderId: string;
  context: QcContext;
  onClose: () => void;
}) {
  // default = เหลือที่ยังไม่ผ่านตรวจ (ดีล้วนกดบันทึกเดียวจบ — ห้ามเพิ่มงานกรอกหน้างาน)
  const remaining = Math.max(0, context.totalExpected - context.checkedGood);
  const [qtyGood, setQtyGood] = useState(remaining);
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [notes, setNotes] = useState("");

  const sizes = [...new Set(context.lines.map((l) => l.size).filter(Boolean))] as string[];

  const utils = trpc.useUtils();
  const create = useMutationWithInvalidation(trpc.qc.create, {
    invalidate: [
      utils.qc.listByOrder,
      utils.qc.context,
      utils.order.getById,
      utils.production.kanban,
      utils.task.myToday,
    ],
    // toast ต้องบอกผลจริงตาม flags จาก server (qc.ts) — พักรอของ/งานแก้เปิดหรือไม่/
    // เข้าแพ็คหรือยังเหลือตรวจ ห้ามเดาเองจากแค่จำนวนเสีย
    onSuccess: (data: {
      qtyDefect: number;
      spareAvailable: number;
      movedToPacking: boolean;
      heldForStock: boolean;
      reworkOpened: boolean;
    }) => {
      if (data.heldForStock) {
        toast.warning("เสื้อสำรองไม่พอ — งานพักรอของ คุยลูกค้าก่อน", {
          description: `ของเสีย ${data.qtyDefect} ตัว · เสื้อสำรองเหลือ ${data.spareAvailable} ตัว — แจ้งแอดมินแล้ว`,
        });
      } else if (data.qtyDefect > 0 && data.reworkOpened) {
        toast.warning(`QC พบของเสีย ${data.qtyDefect} ตัว — ถอยกลับผลิต เปิดขั้นงานแก้แล้ว`, {
          description: `เสื้อสำรองเหลือ ${data.spareAvailable} ตัว`,
        });
      } else if (data.qtyDefect > 0) {
        toast.warning(
          `QC พบของเสีย ${data.qtyDefect} ตัว — ถอยกลับผลิตแล้ว แต่ยังไม่มีใบผลิต`,
          { description: "ไปเปิดใบผลิตงานแก้ที่หน้าการผลิต" }
        );
      } else if (data.movedToPacking) {
        toast.success("QC ผ่านครบ — งานเข้าคิวแพ็คแล้ว");
      } else {
        // ดีบางส่วน — งานค้างที่ด่านตรวจ รอตรวจส่วนที่เหลือ
        toast.success(`บันทึกแล้ว — ยังเหลือตรวจอีก ${Math.max(0, remaining - qtyGood)} ตัว`);
      }
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    },
  });

  const update = (idx: number, patch: Partial<DefectRow>) =>
    setDefects((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const removeRow = (idx: number) => setDefects((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () =>
    setDefects((prev) => [
      ...prev,
      { qty: 1, size: "", printLabel: "", reason: "", photoUrls: [], note: "" },
    ]);

  const qtyDefectTotal = defects.reduce((s, d) => s + d.qty, 0);
  const missingReason = defects.some((d) => d.qty <= 0 || !d.reason);
  const canSave = !missingReason && qtyGood + qtyDefectTotal > 0;

  function handleSave() {
    create.mutate({
      orderId,
      qtyGood,
      notes: notes || undefined,
      defects: defects.map((d) => ({
        qty: d.qty,
        size: d.size || undefined,
        printLabel: d.printLabel || undefined,
        reason: d.reason as QcDefectReason,
        photoUrls: d.photoUrls,
        note: d.note || undefined,
      })),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>นับจริง: ดีกี่ตัว เสียกี่ตัว</DialogTitle>
          <DialogDescription>
            ยอดงาน {context.totalExpected} ตัว · เสื้อสำรองเบิกเผื่อไว้ {context.spareAvailable} ตัว
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* ของดี — default เหลือที่ยังไม่ผ่านตรวจ นับตรงกดบันทึกได้เลย */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">ของดี (ตัว)</p>
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                เหลือที่ยังไม่ผ่านตรวจ {remaining} ตัว
              </p>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={qtyGood}
              onChange={(e) =>
                setQtyGood(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
              className="h-11 w-24 text-center text-base tabular-nums"
            />
          </div>

          {/* ของเสีย — default ว่าง เพิ่มเฉพาะตอนเจอจริง */}
          {defects.map((d, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/20"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  ของเสีย #{idx + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label="ลบแถวของเสีย"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">จำนวน (ตัว)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={d.qty}
                    onChange={(e) =>
                      update(idx, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                    className="h-11 text-center text-base tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">ไซส์</label>
                  <Select
                    value={d.size === "" ? NONE : d.size}
                    onValueChange={(v) => update(idx, { size: v === NONE ? "" : v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
                      {sizes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {context.printLabels.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">ลาย</label>
                    <Select
                      value={d.printLabel === "" ? NONE : d.printLabel}
                      onValueChange={(v) => update(idx, { printLabel: v === NONE ? "" : v })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
                        {context.printLabels.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div
                  className={cn(
                    "space-y-1",
                    context.printLabels.length === 0 && "col-span-2"
                  )}
                >
                  <label className="text-xs text-slate-500">สาเหตุ</label>
                  <Select
                    value={d.reason || undefined}
                    onValueChange={(v) => update(idx, { reason: v as QcDefectReason })}
                  >
                    <SelectTrigger
                      className={cn("h-11", !d.reason && "border-amber-400")}
                    >
                      <SelectValue placeholder="เลือกสาเหตุ" />
                    </SelectTrigger>
                    <SelectContent>
                      {QC_DEFECT_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {QC_DEFECT_REASON_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* รูปจุดเสีย — แนบได้หลายรูป */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500">รูปจุดเสีย (ถ้ามี)</p>
                {d.photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.photoUrls.map((url) => (
                      <div key={url} className="group relative h-16 w-16">
                        <Image
                          src={url}
                          alt="รูปของเสีย"
                          fill
                          sizes="64px"
                          className="rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            update(idx, { photoUrls: d.photoUrls.filter((u) => u !== url) })
                          }
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
                  pathPrefix={`qc/${orderId}`}
                  accept="image/*"
                  onUploaded={(url) => update(idx, { photoUrls: [...d.photoUrls, url] })}
                  onError={(msg) => toast.error(msg)}
                />
              </div>

              <Input
                value={d.note}
                onChange={(e) => update(idx, { note: e.target.value })}
                placeholder="หมายเหตุ เช่น จุดไหนของตัวเสื้อ"
                className="h-11 text-sm"
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            className="h-11 w-full gap-1.5 border-dashed text-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มของเสีย
          </Button>

          {/* แถบเตือนผลที่จะเกิดก่อนกด — คนกดต้องรู้ว่างานจะไปทางไหน (ตรรกะเดียวกับ server) */}
          {qtyDefectTotal > 0 ? (
            context.spareAvailable < qtyDefectTotal ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                เสื้อสำรองไม่พอ (เหลือ {context.spareAvailable}/{qtyDefectTotal} ตัว) —
                บันทึกแล้วงานจะพักรอของ คุยลูกค้า/สั่งเสื้อเพิ่มก่อน
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                บันทึกแล้วงานจะถอยกลับผลิต + เปิดขั้นงานแก้อัตโนมัติ
              </div>
            )
          ) : qtyGood > 0 ? (
            qtyGood >= remaining ? (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ครบแล้วงานจะเข้าคิวแพ็คเอง
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ดีบางส่วน — บันทึกแล้วงานยังอยู่ด่านตรวจ เหลือตรวจอีก {remaining - qtyGood} ตัว
              </div>
            )
          ) : null}

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="หมายเหตุรอบตรวจ (ถ้ามี)"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={create.isPending || !canSave}
            className="h-11 gap-1.5"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            บันทึก ดี {qtyGood} · เสีย {qtyDefectTotal}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
