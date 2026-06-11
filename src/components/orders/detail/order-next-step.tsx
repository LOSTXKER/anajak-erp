"use client";

import { Button } from "@/components/ui/button";
import { getOrderNextStep, type NextStepInput } from "@/lib/order-next-step";
import { getNextStatuses } from "@/lib/order-status";
import type { OrderType, InternalStatus } from "@prisma/client";
import { ArrowRight, Compass } from "lucide-react";

// การ์ดจุดโฟกัสของหน้าออเดอร์ — บอกขั้นถัดไปที่แนะนำหนึ่งอย่าง พร้อมปุ่มทำได้เลย
// (ส่วน action ละเอียดยังอยู่ที่การ์ดเดิมของแต่ละเรื่อง — อันนี้คือเข็มทิศ)

interface OrderNextStepProps {
  order: {
    internalStatus: string;
    orderType: string;
    totalAmount: number;
    paymentTerms: string | null;
    items?: unknown[];
    invoices?: { type: string; totalAmount: number; isVoided: boolean }[];
    designs?: { approvalStatus: string }[];
    productions?: unknown[];
    deliveries?: unknown[];
  };
  onEditItems: () => void;
  onStatusChange: (status: string) => void;
  statusPending?: boolean;
  // ซ่อนปุ่ม STATUS ที่ role นี้กดแล้ว server ปฏิเสธ (default = อนุญาต)
  statusAllowed?: (to: string) => boolean;
}

function scrollToSection(target: "billing" | "design" | "production" | "delivery") {
  document
    .getElementById(`order-section-${target}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function OrderNextStep({
  order,
  onEditItems,
  onStatusChange,
  statusPending,
  statusAllowed,
}: OrderNextStepProps) {
  const invoices = order.invoices ?? [];
  const sumOf = (types: string[]) =>
    invoices
      .filter((inv) => !inv.isVoided && types.includes(inv.type))
      .reduce((s, inv) => s + inv.totalAmount, 0);
  const billed = sumOf(["DEPOSIT_INVOICE", "FINAL_INVOICE"]);
  const receipted = sumOf(["RECEIPT"]);

  const input: NextStepInput = {
    internalStatus: order.internalStatus,
    orderType: order.orderType,
    itemCount: order.items?.length ?? 0,
    totalAmount: order.totalAmount,
    paymentTerms: order.paymentTerms,
    hasInvoice: invoices.some(
      (inv) => !inv.isVoided && ["DEPOSIT_INVOICE", "FINAL_INVOICE"].includes(inv.type)
    ),
    hasPendingDesign: (order.designs ?? []).some((d) => d.approvalStatus === "PENDING"),
    hasApprovedDesign: (order.designs ?? []).some((d) => d.approvalStatus === "APPROVED"),
    hasProduction: (order.productions ?? []).length > 0,
    hasDelivery: (order.deliveries ?? []).length > 0,
    billingHandled:
      order.totalAmount <= 0 || Math.max(billed, receipted) >= order.totalAmount,
  };

  const step = getOrderNextStep(input);
  if (!step) return null;

  // ตาข่ายกันคำแนะนำ drift จาก state machine — ปลายทางไม่ valid = ซ่อนปุ่ม
  // (ดีกว่าปล่อยให้กดแล้วเจอ error จาก server)
  const statusActionValid =
    step.action.type !== "STATUS" ||
    (getNextStatuses(
      order.orderType as OrderType,
      order.internalStatus as InternalStatus
    ).includes(step.action.to as InternalStatus) &&
      (statusAllowed?.(step.action.to) ?? true));

  function handleAction() {
    if (!step) return;
    if (step.action.type === "EDIT_ITEMS") onEditItems();
    else if (step.action.type === "STATUS") onStatusChange(step.action.to);
    else if (step.action.type === "ANCHOR") scrollToSection(step.action.target);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="flex min-w-0 items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            ขั้นถัดไป: {step.title}
          </p>
          <p className="text-[12.5px] text-slate-600 dark:text-slate-400">{step.description}</p>
        </div>
      </div>
      {step.buttonLabel && statusActionValid && (
        <Button
          onClick={handleAction}
          disabled={statusPending}
          className="shrink-0 gap-1.5"
          size="sm"
        >
          {step.buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
