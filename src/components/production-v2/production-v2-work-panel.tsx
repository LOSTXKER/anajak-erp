"use client";

/* ============================================================
   แผงลงมือทำ — ครึ่งขวาของแบบ R3 (เบสเลือกจาก /proto/work-order-control 2026-09-01)

   โจทย์คำต่อคำ: *"ให้หน้านี้หัวหน้าฝ่ายผลิตสามารถควบคุมได้เหมือน station ด้วย …
   จะได้ไม่ต้องสลับจอไปมา เพราะพนักงานสกรีนเขาใช้ไม่เป็นหรอก"*

   กติกาที่ยึด:
   ① **ปุ่มมาจาก `availableCommands` ของ server เท่านั้น** — ไม่เดาเองว่าขั้นนี้ทำอะไรได้
      (server รู้เรื่อง readiness · dependency · สิทธิ์ · ปัญหาที่บล็อกอยู่)
   ② **ขั้นที่ต้องมีหลักฐาน (เตรียมเสื้อ · DTF · QC · ร้านนอก) ไม่ทำปุ่มปลอมไว้ที่นี่** —
      บอกตรง ๆ ว่าต้องทำที่จอสถานี พร้อมทางเข้า · การมีปุ่มที่กดแล้วพังคือระบบโกหก
   ③ **บันทึกจำนวนแยกตามสี/ไซซ์** ตามที่ระบบบังคับ (ยิงยอดรวมถูกปฏิเสธ — เจอตอนซ้อม)
   ④ **หัวหน้ากดแทนช่างได้ แต่ระบบบันทึกว่าใครกดเสมอ** และไม่แตะผู้รับผิดชอบของขั้น
      (เบสอนุมัติค่าปริยายนี้ 2026-09-02) — actorId มาจาก session ที่ server อยู่แล้ว
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CirclePause, ExternalLink, Factory } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { StatusLabel } from "@/components/ui/status-label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";

type WorkOrder = RouterOutput["manufacturing"]["workOrder"];
type Operation = WorkOrder["operations"][number];
type QuantityLine = WorkOrder["quantityLines"][number];

function commandId() {
  return globalThis.crypto?.randomUUID?.() ?? `panel-${Date.now()}-${Math.random()}`;
}

const STATE_META: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  PLANNED: { label: "ยังไม่ถึงคิว", tone: "neutral" },
  READY: { label: "พร้อมทำ", tone: "accent" },
  RUNNING: { label: "กำลังทำ", tone: "warning" },
  BLOCKED: { label: "ติดปัญหา", tone: "danger" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "neutral" },
};

/** ขั้นที่ต้องผ่านหน้าจอเฉพาะเพราะต้องผูกหลักฐาน — ไม่ทำปุ่มลัดไว้ที่นี่ */
const SPECIALIZED_HINT: Record<string, string> = {
  recordPrep: "ขั้นเตรียมเสื้อต้องบันทึกการรับ/เบิกเสื้อที่จอสถานี",
  manageDtfBatch: "ขั้น DTF ต้องเริ่มจากรอบพิมพ์ที่ผูกหลักฐานจริง ทำที่จอสถานี",
  recordQuality: "ขั้นตรวจคุณภาพต้องบันทึกผลตรวจที่จอสถานี",
  manageOutsource: "ขั้นร้านนอกจัดการผ่านใบสั่งร้านนอกในรายการข้างล่าง",
};

export function ProductionV2WorkPanel({
  workOrder,
  operation,
  stale,
}: {
  workOrder: WorkOrder;
  operation: Operation | null;
  stale: boolean;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const refresh = async () => {
    await Promise.all([
      utils.manufacturing.workOrder.invalidate(),
      utils.manufacturing.controlList.invalidate(),
      utils.manufacturing.stationDispatch.invalidate(),
      utils.manufacturing.workCenterLoad.invalidate(),
    ]);
  };

  const start = trpc.manufacturing.startOperation.useMutation({
    onSuccess: async () => {
      toast.success("เริ่มงานแล้ว");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const pause = trpc.manufacturing.pauseOperation.useMutation({
    onSuccess: async () => {
      toast.success("พักงานแล้ว");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const report = trpc.manufacturing.reportOutput.useMutation({
    onSuccess: async () => {
      setDraft({});
      toast.success("บันทึกผลงานแล้ว");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const complete = trpc.manufacturing.completeOperation.useMutation({
    onSuccess: async () => {
      toast.success("ปิดขั้นแล้ว");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending =
    start.isPending || pause.isPending || report.isPending || complete.isPending;

  if (!operation) {
    return (
      <Section title="ลงมือทำ" icon={Factory} tone="production">
        <p className="text-sm text-secondary">
          กดขั้นงานในผังด้านบนเพื่อเปิดงานนั้นที่นี่
        </p>
      </Section>
    );
  }

  const meta = STATE_META[operation.state] ?? { label: operation.state, tone: "neutral" as const };
  const commands = operation.availableCommands ?? [];
  const specialized = (Object.keys(SPECIALIZED_HINT) as string[]).find((key) =>
    commands.includes(key as never),
  );
  const lines: QuantityLine[] = workOrder.quantityLines.filter(
    (line) => line.productionStepId === operation.id,
  );
  const reportable = lines.filter((line) => line.qtyPlanned > line.qtyGood);

  const submitReport = () => {
    const quantityLines = reportable
      .map((line) => ({
        quantityLineId: line.id,
        expectedRevision: line.revision,
        qtyGood: Number(draft[line.id] ?? 0),
        qtyScrap: 0,
        qtyRework: 0,
      }))
      .filter((line) => line.qtyGood > 0);

    if (quantityLines.length === 0) {
      toast.error("ใส่จำนวนที่ทำได้อย่างน้อยหนึ่งช่องก่อนบันทึก");
      return;
    }
    report.mutate({
      operationJobId: operation.id,
      commandId: commandId(),
      expectedRevision: operation.revision,
      qtyGood: quantityLines.reduce((sum, line) => sum + line.qtyGood, 0),
      qtyScrap: 0,
      qtyRework: 0,
      quantityLines,
    });
  };

  return (
    <Section
      title="ลงมือทำ"
      icon={Factory}
      tone="production"
      meta="ขั้นที่เลือกจากผังด้านบน"
    >
      <div className="space-y-3">
        <div>
          <p className="text-base font-semibold text-strong">{operation.name}</p>
          <p className="text-xs text-muted">
            {operation.workCenter?.name ?? "ยังไม่ระบุศูนย์งาน"}
            {operation.assignee ? ` · ${operation.assignee.name}` : " · ยังไม่มอบหมายคน"}
          </p>
        </div>
        <StatusLabel label={meta.label} tone={meta.tone} />

        {operation.blockers.length > 0 ? (
          <Alert variant="error" title="มีปัญหาค้างอยู่">
            {operation.blockers.map((blocker) => blocker.title).join(" · ")}
          </Alert>
        ) : null}

        {commands.length === 0 ? (
          <p className="text-sm text-secondary">
            {operation.state === "COMPLETED"
              ? "ขั้นนี้ปิดแล้ว"
              : "ยังทำอะไรกับขั้นนี้ไม่ได้ตอนนี้ — รอขั้นก่อนหน้า หรือยังไม่ได้ปล่อยงาน"}
          </p>
        ) : null}

        {specialized ? (
          /* ขั้นที่ต้องมีหลักฐาน — ส่งไปจอสถานีแทนการทำปุ่มลัดที่กดแล้วพัง */
          <Alert variant="info" title="ขั้นนี้ทำที่จอสถานี">
            <span className="flex flex-wrap items-center gap-2">
              {SPECIALIZED_HINT[specialized]}
              <Link
                href="/factory/station"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดจอสถานี
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </span>
          </Alert>
        ) : null}

        {commands.includes("reportOutput" as never) && reportable.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-secondary">
              บันทึกจำนวนที่ทำได้ <span className="text-muted">(แยกตามสี/ไซซ์ ตามที่ระบบบังคับ)</span>
            </p>
            <div className="space-y-2">
              {reportable.map((line) => {
                const remaining = line.qtyPlanned - line.qtyGood;
                return (
                  <label
                    key={line.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                    htmlFor={`qty-${line.id}`}
                  >
                    <span className="min-w-0 flex-1 text-sm text-strong">
                      {[line.color, line.size].filter(Boolean).join(" · ") ||
                        line.description ||
                        line.scopeKey}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {line.qtyGood}/{line.qtyPlanned}
                    </span>
                    <Input
                      id={`qty-${line.id}`}
                      className="w-20 shrink-0 text-right tabular-nums"
                      inputMode="numeric"
                      placeholder={String(remaining)}
                      value={draft[line.id] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [line.id]: event.target.value }))
                      }
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={cn("flex flex-wrap gap-2", stale && "opacity-60")}>
          {commands.includes("startOperation" as never) ? (
            <Button
              size="lg"
              className="min-h-14 flex-1 text-base"
              disabled={pending || stale}
              onClick={() =>
                start.mutate({
                  operationJobId: operation.id,
                  commandId: commandId(),
                  expectedRevision: operation.revision,
                })
              }
            >
              เริ่มงาน
            </Button>
          ) : null}

          {commands.includes("reportOutput" as never) && reportable.length > 0 ? (
            <Button
              size="lg"
              className="min-h-14 flex-1 text-base"
              disabled={pending || stale}
              onClick={submitReport}
            >
              บันทึกผลงาน
            </Button>
          ) : null}

          {commands.includes("completeOperation" as never) ? (
            <Button
              size="lg"
              className="min-h-14 flex-1 text-base"
              disabled={pending || stale}
              onClick={() =>
                complete.mutate({
                  operationJobId: operation.id,
                  commandId: commandId(),
                  expectedRevision: operation.revision,
                })
              }
            >
              ปิดขั้นนี้
            </Button>
          ) : null}

          {commands.includes("pauseOperation" as never) ? (
            <Button
              variant="outline"
              disabled={pending || stale}
              onClick={() =>
                pause.mutate({
                  operationJobId: operation.id,
                  commandId: commandId(),
                  expectedRevision: operation.revision,
                  reason: "หัวหน้าพักงานจากหน้าใบสั่งผลิต",
                })
              }
            >
              <CirclePause />
              พักงาน
            </Button>
          ) : null}
        </div>

        {commands.includes("raiseException" as never) ? (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            แจ้งปัญหาของขั้นนี้ทำได้ที่ปุ่มในรายการข้างล่าง
          </p>
        ) : null}

        {stale ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            ข้อมูลบนจออาจไม่ใช่ล่าสุด — ปุ่มถูกปิดไว้จนกว่าจะเชื่อมต่อได้
          </p>
        ) : null}
      </div>
    </Section>
  );
}
