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
import {
  CLAIM_FAULT_LABELS,
  CLAIM_RESOLUTION_LABELS,
  CLAIM_SOURCE_LABELS,
  CLAIM_STATE_LABELS,
  claimCloseBlockers,
  claimHeadline,
  resolutionNeedsRework,
} from "@/lib/claim";

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
};

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

  const pending =
    open.isPending || decide.isPending || startRework.isPending || closeClaim.isPending;
  const error =
    open.error?.message ??
    decide.error?.message ??
    startRework.error?.message ??
    closeClaim.error?.message ??
    null;

  const needsAmount = resolution === "DISCOUNT" || resolution === "REFUND" || resolution === "EXTRA_CHARGE";

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
              <Button
                disabled={!canDecide || pending}
                onClick={() => {
                  if (!title.trim()) {
                    setShowTitleError(true);
                    return;
                  }
                  open.mutate({ orderId, source: "CUSTOMER_REPORT", title: title.trim(), lines: [] });
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
