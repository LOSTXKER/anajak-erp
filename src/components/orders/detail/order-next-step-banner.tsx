import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextStep, NextStepAction } from "@/lib/order-next-step";
import { shouldGateOnReadiness } from "@/lib/order-tabs";

// รูปร่าง readiness ที่แถบต้องใช้ (มาจาก trpc.production.orderContext) — type-only เลี่ยงดึง server code
interface ReadinessLike {
  ready: boolean;
  checks: { key: string; label: string; ok: boolean; detail: string; waitingOn?: string | null }[];
}

interface NextStepBannerProps {
  nextStep: NextStep | null;
  readiness: ReadinessLike | null;
  isPending: boolean;
  onStatus: (to: string) => void;
  onEditItems: () => void;
  onAnchor: (target: "billing" | "design" | "production" | "delivery") => void;
}

/**
 * แถบ "ขั้นต่อไป" — จุดโฟกัสเดียวบนหน้าออเดอร์ (logic จาก lib/order-next-step.ts ที่ระบบจำให้)
 * แทนการให้ผู้ใช้ไล่เดาจากการ์ดเอง · terminal (COMPLETED/CANCELLED) = nextStep null → ไม่ render
 * ถ้าขั้นต่อไปคือ "เข้าคิวผลิต" (STATUS→PRODUCTION_QUEUE) แต่ด่านพร้อมผลิตไม่ผ่าน → โชว์ "ติดอะไร" แทนปุ่ม
 * (จุดเดียวที่ server ใช้ readiness เป็น soft-gate · ยืนยัน/ส่งออกแบบ/ปิดงาน server ไม่เช็ค readiness — ห้าม gate)
 */
export function OrderNextStepBanner({
  nextStep,
  readiness,
  isPending,
  onStatus,
  onEditItems,
  onAnchor,
}: NextStepBannerProps) {
  if (!nextStep) return null;

  const action = nextStep.action;
  const blockedByReadiness = shouldGateOnReadiness(action, readiness);

  function dispatch(a: NextStepAction) {
    switch (a.type) {
      case "EDIT_ITEMS":
        return onEditItems();
      case "STATUS":
        return onStatus(a.to);
      case "ANCHOR":
        return onAnchor(a.target);
      case "NONE":
        return;
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:bg-blue-950/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <ArrowRight className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-300/70">
            ขั้นต่อไป
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{nextStep.title}</p>
          <p className="text-[13px] text-slate-600 dark:text-slate-300">{nextStep.description}</p>
        </div>
      </div>

      {blockedByReadiness ? (
        <div className="shrink-0 rounded-xl bg-white/70 px-3 py-2 text-xs dark:bg-slate-900/40 sm:max-w-[340px]">
          <p className="mb-1 font-medium text-amber-700 dark:text-amber-400">ยังไปต่อไม่ได้ — ติด:</p>
          <ul className="space-y-1">
            {readiness!.checks
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={c.key} className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {c.waitingOn ? ` · ${c.waitingOn}` : c.detail ? ` — ${c.detail}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : action.type !== "NONE" && nextStep.buttonLabel ? (
        <Button onClick={() => dispatch(action)} disabled={isPending} className="shrink-0 self-start sm:self-auto">
          {nextStep.buttonLabel}
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
