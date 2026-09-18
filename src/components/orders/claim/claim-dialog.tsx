"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FileUpload } from "@/components/ui/file-upload";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import {
  CLAIM_FAULT_LABELS,
  CLAIM_RESOLUTION_LABELS,
  CLAIM_SOURCE_LABELS,
  CLAIM_STATE_LABELS,
  claimCloseBlockers,
  claimHeadline,
  resolutionNeedsRework,
} from "@/lib/claim";
import { describeReworkForCustomer } from "@/lib/claim-customer";

// กล่องงานแก้/เคลมของออเดอร์ — เปิดจากแถบบนหัวใบ (ไม่เพิ่มแท็บและไม่เพิ่มการ์ดในหน้า
// ตามที่เบสเคยตีกลับงานที่เพิ่มการ์ดจนรก) กล่องเดียวทำได้ครบวงจร: เปิดเรื่อง → ตัดสิน →
// สั่งงานแก้ → ปิดใบ · ทุกปุ่มยิงคำสั่งที่มีด่านฝั่ง server อยู่แล้ว ไม่มีกฎชุดที่สองที่นี่

type ClaimRow = {
  id: string;
  claimNumber: string;
  round: number;
  state: string;
  source: string;
  fault: string;
  resolution: string | null;
  title: string;
  detail: string | null;
  qtyClaimed: number;
  agreedCredit: number;
  agreedCharge: number;
  creditNoteTotal: number;
  debitNoteTotal: number;
  openReworkSteps: number;
  steps: { id: string }[];
  closeNote: string | null;
  customerMessage: string | null;
  photoUrls: string[];
  lines: { size: string; color: string | null; qtyClaimed: number }[];
};

/** ช่องกรอก "เสียกี่ตัว" รายไซซ์ — เบสยืนยันว่าหน้างานนับแบบนี้ ("S เสีย 3 M เสีย 2")
 *  โชว์จำนวนที่ส่งไปของแต่ละไซซ์กำกับ เพื่อให้กรอกเกินของที่ส่งไม่ได้ และเทียบได้ทันที */
function SizeGrid({
  sizes,
  value,
  onChange,
}: {
  sizes: { size: string; sent: number }[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const total = Object.values(value).reduce((sum, qty) => sum + qty, 0);
  if (sizes.length === 0) {
    return <p className="text-sm text-muted">ออเดอร์นี้ยังไม่ได้แยกไซซ์ — ระบุจำนวนในช่องเรื่องที่เกิดขึ้นแทน</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">เสียกี่ตัว</span>
        <span className="text-sm text-muted">กรอกเฉพาะไซซ์ที่มีปัญหา</span>
        <span className="flex-1" />
        <span className={`text-lg font-semibold tabular-nums ${total > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
          รวม {total} ตัว
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((row) => (
          <label
            key={row.size}
            htmlFor={`claim-qty-${row.size}`}
            className={`flex min-w-[92px] flex-1 flex-col gap-1.5 rounded-xl border p-2.5 ${
              (value[row.size] ?? 0) > 0 ? "border-amber-500/50 bg-surface-muted" : "border-border bg-surface-muted"
            }`}
          >
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold">{row.size}</span>
              <span className="text-xs text-muted">ส่งไป {row.sent}</span>
            </span>
            <Input
              id={`claim-qty-${row.size}`}
              type="number"
              min={0}
              max={row.sent}
              aria-label={`จำนวนที่เสียไซซ์ ${row.size}`}
              value={String(value[row.size] ?? 0)}
              onChange={(event) => {
                const next = Math.max(0, Math.min(row.sent, Number(event.target.value) || 0));
                onChange({ ...value, [row.size]: next });
              }}
              className="h-10 text-center text-base font-semibold tabular-nums"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** รูปหลักฐานของรอบแก้ — เบสเลือกให้เก็บในใบเคลม ไม่ใช่กองรวมกับไฟล์ออเดอร์ (2026-09-19)
 *  เคลมหลายรอบ รูปต้องอยู่กับรอบที่กำลังคุย ไม่ใช่ปนกันจนต้องไล่หาว่าของรอบไหน */
function ClaimPhotos({
  orderId,
  urls,
  onChange,
  disabled,
}: {
  orderId: string;
  urls: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">รูปที่ลูกค้าส่งมา</p>
      <div className="flex flex-wrap items-center gap-2">
        {urls.map((url) => (
          <div key={url} className="group relative h-16 w-16">
            {/* ใช้ img ตรง — รูปเสิร์ฟผ่าน /api/files ที่เช็ค session
                next/image optimizer ดึงฝั่ง server ไม่มี cookie จะได้ 401 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="รูปหลักฐานงานแก้" className="h-full w-full rounded-lg object-cover" />
            <ImageRemoveButton
              onClick={() => onChange(urls.filter((u) => u !== url))}
              label="ลบรูปหลักฐานงานแก้"
            />
          </div>
        ))}
        <FileUpload
          bucket="designs"
          pathPrefix={`claims/${orderId}`}
          accept="image/*"
          disabled={disabled}
          className="w-40"
          onUploaded={(url) => onChange([...urls, url])}
          onError={(message) => toast.error(message)}
        />
      </div>
    </div>
  );
}

const RESOLUTIONS = Object.keys(CLAIM_RESOLUTION_LABELS);
const FAULTS = Object.keys(CLAIM_FAULT_LABELS);

export function ClaimDialog({
  orderId,
  orderStatus,
  canDecide,
  canStartRework,
  onClose,
}: {
  orderId: string;
  orderStatus: string;
  /** สิทธิ์ decide_claims — เปิด/ตัดสิน/ปิดใบ */
  canDecide: boolean;
  /** สิทธิ์ supervise_operations — สั่งงานแก้ (ถอยสถานะข้ามเส้น) */
  canStartRework: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const claimsQuery = trpc.claim.byOrder.useQuery({ orderId });
  const sizesQuery = trpc.claim.orderSizes.useQuery({ orderId });
  const sizes = sizesQuery.data ?? [];
  const claims = (claimsQuery.data ?? []) as unknown as ClaimRow[];
  const active = claims.find((claim) => claim.state === "OPEN" || claim.state === "DECIDED") ?? null;

  const invalidate = [utils.claim.byOrder, utils.order.getById] as const;
  const open = useMutationWithInvalidation(trpc.claim.open, {
    invalidate: [...invalidate],
    onSuccess: () => toast.success("เปิดใบเคลมแล้ว"),
    onError: () => {},
  });
  const decide = useMutationWithInvalidation(trpc.claim.decide, {
    invalidate: [...invalidate],
    onSuccess: () => toast.success("บันทึกคำตัดสินแล้ว"),
    onError: () => {},
  });
  const startRework = useMutationWithInvalidation(trpc.claim.startRework, {
    invalidate: [...invalidate],
    onSuccess: () => toast.success("สั่งงานแก้เข้าสายผลิตแล้ว"),
    onError: () => {},
  });
  const saveLines = useMutationWithInvalidation(trpc.claim.setLines, {
    invalidate: [...invalidate],
    onSuccess: () => {
      setQty(null);
      setEditQty(false);
      toast.success("บันทึกจำนวนที่เสียแล้ว");
    },
    onError: () => {},
  });
  const savePhotos = useMutationWithInvalidation(trpc.claim.setPhotos, {
    invalidate: [...invalidate],
    onSuccess: () => {},
    onError: () => {},
  });
  const saveMessage = useMutationWithInvalidation(trpc.claim.setCustomerMessage, {
    invalidate: [...invalidate],
    onSuccess: () => {
      setCustomerMessage(null);
      toast.success("อัปเดตข้อความที่ลูกค้าเห็นแล้ว");
    },
    onError: () => {},
  });
  const closeClaim = useMutationWithInvalidation(trpc.claim.close, {
    invalidate: [...invalidate],
    onSuccess: () => toast.success("ปิดใบเคลมแล้ว"),
    onError: () => {},
  });

  // ฟอร์มเปิดเรื่อง
  const [title, setTitle] = useState("");
  const [showTitleError, setShowTitleError] = useState(false);
  // ฟอร์มตัดสิน
  const [resolution, setResolution] = useState("REWORK");
  const [fault, setFault] = useState("SHOP");
  const [amount, setAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");
  // ข้อความที่ลูกค้าเห็นบนลิงก์ติดตามงาน — null = ยังไม่ได้พิมพ์อะไรในรอบนี้ (ใช้ค่าจากใบ)
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  // จำนวนที่เสียรายไซซ์ · null = ยังไม่ได้แตะในรอบนี้ (ใช้ค่าจากใบ)
  const [qty, setQty] = useState<Record<string, number> | null>(null);
  const [editQty, setEditQty] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);

  const pending =
    open.isPending ||
    decide.isPending ||
    startRework.isPending ||
    saveLines.isPending ||
    savePhotos.isPending ||
    saveMessage.isPending ||
    closeClaim.isPending;
  const error =
    open.error?.message ??
    decide.error?.message ??
    startRework.error?.message ??
    saveLines.error?.message ??
    savePhotos.error?.message ??
    saveMessage.error?.message ??
    closeClaim.error?.message ??
    null;

  const needsAmount = resolution === "DISCOUNT" || resolution === "REFUND" || resolution === "EXTRA_CHARGE";

  // สิ่งที่ลูกค้าเห็นอยู่ตอนนี้ — คิดด้วยฟังก์ชันตัวเดียวกับที่ server ใช้ จะได้ไม่เพี้ยนกัน
  const customerView = active
    ? describeReworkForCustomer({
        round: active.round,
        state: active.state,
        resolution: active.resolution,
        customerMessage: (customerMessage ?? active.customerMessage ?? "").trim() || null,
        reworkSteps: active.steps.length,
        openReworkSteps: active.openReworkSteps,
      })
    : null;

  const savedQty: Record<string, number> = {};
  for (const line of active?.lines ?? []) savedQty[line.size] = (savedQty[line.size] ?? 0) + line.qtyClaimed;
  const qtyValue = qty ?? savedQty;
  const qtyTotal = Object.values(qtyValue).reduce((sum, n) => sum + n, 0);
  const qtySummary =
    Object.entries(qtyValue)
      .filter(([, n]) => n > 0)
      .map(([size, n]) => `${size} ${n}`)
      .join(" · ") || "ยังไม่ระบุไซซ์";
  const qtyDirty = qty !== null && JSON.stringify(qty) !== JSON.stringify(savedQty);
  const linesOf = (value: Record<string, number>) =>
    Object.entries(value)
      .filter(([, n]) => n > 0)
      .map(([size, n]) => ({ size, qtyClaimed: n }));

  const messageDirty =
    active !== null &&
    customerMessage !== null &&
    customerMessage.trim() !== (active.customerMessage ?? "").trim();

  const blockers = active
    ? claimCloseBlockers({
        state: active.state,
        resolution: active.resolution,
        agreedCredit: active.agreedCredit,
        agreedCharge: active.agreedCharge,
        creditNoteTotal: active.creditNoteTotal,
        debitNoteTotal: active.debitNoteTotal,
        reworkSteps: active.steps.length,
        openReworkSteps: active.openReworkSteps,
        orderBackToShipped: ["SHIPPED", "COMPLETED"].includes(orderStatus),
        closeNote: closeNote || null,
      })
    : [];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>งานแก้และเคลม</DialogTitle>
          <DialogDescription>
            {active
              ? `${active.claimNumber} · ${claimHeadline(active)}`
              : "ยังไม่มีเรื่องค้างของออเดอร์นี้"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}

          {!active ? (
            <>
              <Field
                label="เกิดอะไรขึ้น"
                required
                error={showTitleError && !title.trim() ? "ใส่เรื่องสั้นๆ ก่อน" : undefined}
                help="เช่น ลายลอกหลังซักครั้งแรก 12 ตัว — ลูกค้าส่งรูปมาทางไลน์"
              >
                <Textarea
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  rows={2}
                  placeholder="เรื่องที่ลูกค้าแจ้ง หรือสิ่งที่เราเจอเอง"
                />
              </Field>
              <SizeGrid sizes={sizes} value={qtyValue} onChange={setQty} />
              <ClaimPhotos orderId={orderId} urls={newPhotos} onChange={setNewPhotos} disabled={pending} />
              <Field
                label="ข้อความที่ลูกค้าเห็น"
                help="ขึ้นบนลิงก์ติดตามงานแทนคำปริยาย — ไม่ใส่ก็ได้ ลูกค้าจะเห็นว่า “รับเรื่องแล้ว”"
              >
                <Textarea
                  value={customerMessage ?? ""}
                  onChange={(event) => setCustomerMessage(event.target.value)}
                  rows={2}
                  placeholder="เช่น รับเรื่องแล้วค่ะ ขอตรวจของก่อน จะแจ้งกลับภายในพรุ่งนี้"
                />
              </Field>
              <Button
                disabled={!canDecide || pending}
                onClick={() => {
                  if (!title.trim()) {
                    setShowTitleError(true);
                    return;
                  }
                  open.mutate({
                    orderId,
                    source: "CUSTOMER_REPORT",
                    title: title.trim(),
                    customerMessage: customerMessage?.trim() || undefined,
                    lines: linesOf(qtyValue),
                    photoUrls: newPhotos,
                  });
                }}
              >
                เปิดใบเคลม
              </Button>
              {!canDecide ? (
                <p className="text-sm text-muted">เปิดใบเคลมได้เฉพาะเจ้าของ ผู้จัดการ และฝ่ายขาย</p>
              ) : null}
            </>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted">สถานะเรื่อง</dt>
                  <dd>{CLAIM_STATE_LABELS[active.state] ?? active.state}</dd>
                </div>
                <div>
                  <dt className="text-muted">มาจาก</dt>
                  <dd>{CLAIM_SOURCE_LABELS[active.source] ?? active.source}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">เรื่อง</dt>
                  <dd>{active.title}</dd>
                </div>
              </dl>

              {editQty ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <SizeGrid sizes={sizes} value={qtyValue} onChange={setQty} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!canDecide || pending || !qtyDirty}
                      onClick={() => saveLines.mutate({ id: active.id, lines: linesOf(qtyValue) })}
                    >
                      บันทึกจำนวน
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQty(null);
                        setEditQty(false);
                      }}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                /* ขั้นที่กรอกแล้วยุบเหลือบรรทัดเดียว — กล่องจะได้ไม่ยาวขึ้นเรื่อยๆ (เบสเคาะจากหน้าลอง 2026-09-19) */
                <button
                  type="button"
                  onClick={() => setEditQty(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg bg-surface-muted p-3 text-left text-sm"
                >
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="flex-1">
                    {qtyTotal > 0 ? (
                      <>
                        เสีย <span className="font-semibold text-strong">{qtyTotal} ตัว</span> · {qtySummary}
                      </>
                    ) : (
                      <span className="text-muted">ยังไม่ได้ระบุว่าเสียกี่ตัว</span>
                    )}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">แก้</span>
                </button>
              )}

              <ClaimPhotos
                orderId={orderId}
                urls={active.photoUrls}
                disabled={!canDecide || pending}
                onChange={(next) => savePhotos.mutate({ id: active.id, photoUrls: next })}
              />

              {/* ที่เดียวที่เขียนข้อความถึงลูกค้า — เห็นผลก่อนกดบันทึก เพราะกล่องบนคือหน้าจอจริงของเขา
                  (ยอดเงินและคนผิดไม่เคยขึ้นหน้านั้น บรรทัดนี้คือสิ่งเดียวที่ลูกค้าอ่าน) */}
              {customerView ? (
                <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
                  <div>
                    <p className="text-xs text-muted">ลูกค้าเห็นบนลิงก์ติดตามงานตอนนี้</p>
                    <p className="mt-0.5 text-sm font-medium text-strong">{customerView.headline}</p>
                    <p className="text-sm text-secondary">{customerView.note}</p>
                  </div>
                  <Textarea
                    value={customerMessage ?? active.customerMessage ?? ""}
                    onChange={(event) => setCustomerMessage(event.target.value)}
                    rows={2}
                    placeholder="เขียนเองได้ เช่น ทำใหม่ให้ 12 ตัว ส่งกลับวันศุกร์ที่ 25 ก.ย. ค่ะ"
                  />
                  {messageDirty ? (
                    <Button
                      size="sm"
                      disabled={!canDecide || pending}
                      onClick={() =>
                        saveMessage.mutate({ id: active.id, customerMessage: (customerMessage ?? "").trim() })
                      }
                    >
                      บันทึกข้อความ
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {active.state === "OPEN" ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <Field label="จะจัดการอย่างไร">
                    <Select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                      {RESOLUTIONS.map((key) => (
                        <option key={key} value={key}>
                          {CLAIM_RESOLUTION_LABELS[key]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="ใครรับผิดชอบ" help="ใช้ตอบทีหลังว่างานนี้กำไรหายไปกับอะไร">
                    <Select value={fault} onChange={(event) => setFault(event.target.value)}>
                      {FAULTS.map((key) => (
                        <option key={key} value={key}>
                          {CLAIM_FAULT_LABELS[key]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {needsAmount ? (
                    <Field
                      label={resolution === "EXTRA_CHARGE" ? "ยอดที่เก็บเพิ่ม (บาท)" : "ยอดที่ลด/คืน (บาท)"}
                      help="ยอดนี้คือข้อตกลง — ต้องออกใบลดหนี้/เพิ่มหนี้ให้ตรงกันก่อนถึงจะปิดใบได้"
                    >
                      <Input
                        type="number"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0"
                      />
                    </Field>
                  ) : null}
                  <Button
                    disabled={!canDecide || pending}
                    onClick={() =>
                      decide.mutate({
                        id: active.id,
                        resolution: resolution as never,
                        fault: fault as never,
                        agreedCredit:
                          resolution === "DISCOUNT" || resolution === "REFUND" ? Number(amount || 0) : 0,
                        agreedCharge: resolution === "EXTRA_CHARGE" ? Number(amount || 0) : 0,
                      })
                    }
                  >
                    บันทึกคำตัดสิน
                  </Button>
                </div>
              ) : null}

              {active.state === "DECIDED" ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm">
                    ตัดสินแล้ว: {active.resolution ? CLAIM_RESOLUTION_LABELS[active.resolution] : "—"}
                    {" · ใครรับผิดชอบ: "}
                    {CLAIM_FAULT_LABELS[active.fault] ?? active.fault}
                  </p>

                  {resolutionNeedsRework(active.resolution) && active.steps.length === 0 ? (
                    <>
                      <Button
                        disabled={!canStartRework || pending}
                        onClick={() => startRework.mutate({ id: active.id })}
                      >
                        สั่งงานแก้เข้าสายผลิต
                      </Button>
                      {!canStartRework ? (
                        <p className="text-sm text-muted">
                          ขานี้ถอยสถานะงานที่ออกจากโรงงานไปแล้ว — ต้องให้หัวหน้าเป็นคนกด
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {blockers.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">ปิดใบยังไม่ได้ เพราะ</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                        {blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <Field label="เหตุผลที่ปิดใบ (ถ้าปิดทั้งที่ยังค้างบางอย่าง)">
                    <Textarea
                      value={closeNote}
                      onChange={(event) => setCloseNote(event.target.value)}
                      rows={2}
                      placeholder="เช่น ส่งชดเชยครบแล้ว ใบส่งเดิมตีกลับทั้งใบจึงย้อนสถานะไม่ได้"
                    />
                  </Field>
                  <Button
                    disabled={!canDecide || pending || blockers.length > 0}
                    onClick={() =>
                      closeClaim.mutate({ id: active.id, closeNote: closeNote.trim() || undefined })
                    }
                  >
                    ปิดใบเคลม
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {claims.filter((claim) => claim.state === "CLOSED" || claim.state === "CANCELLED").length > 0 ? (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium">รอบที่จบไปแล้ว</p>
              <ul className="space-y-1 text-sm text-muted">
                {claims
                  .filter((claim) => claim.state === "CLOSED" || claim.state === "CANCELLED")
                  .map((claim) => (
                    <li key={claim.id}>
                      {claim.claimNumber} · {claimHeadline(claim)}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
