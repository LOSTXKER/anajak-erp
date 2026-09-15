"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CheckCircle2, Factory, ListTodo, Pause, Plus, Printer } from "lucide-react";
import { c, CardHead, StateBox, SubHead } from "@/components/kit/kit";
import { OUTSOURCE_ACTIVE_STATUSES, productionWorkflowSteps } from "@/lib/production-steps";
import { productionStepLabel } from "@/lib/order-progress";
import { differenceInBangkokDays } from "@/lib/date-utils";
import type { RouterOutput } from "@/lib/trpc";

/* ============================================================
   การ์ด "งานผลิต" ซ้ายของแท็บงานผลิต — ต้นแบบ tabProduction() ส่วน left (รื้อ 2026-09-15)
   อ่านอย่างเดียว ไม่มี dialog/ไม่มีเงิน — ตัวจัดการจริง (ขั้นตอน/QC/outsource/เบิกวัตถุดิบ) อยู่หน้าใบผลิต /production/[id]
   (แยกโมดูลผลิตออกจากหน้าออเดอร์ — เบสเคาะ 2026-06-12)

   มีใบผลิต: เลขใบที่หัวการ์ด + ปุ่มไปหน้าผลิต · เข้าคิวแล้วบอกว่ารอหัวหน้ากดเริ่ม
   ขั้นตอนเรียงลงมา: วงเขียว = เสร็จ, แถวฟ้า = กำลังทำ (ใคร/ร้านไหน, ร้านนอกช้า), วงเทา = รอ
   ยังไม่มีใบผลิต: ช่องสถานะบอกว่าติดอะไร (ไฟล์พิมพ์/พักงาน/ผ่านช่วงผลิต) พร้อมทางไปต่อ
   ไม่เขียนว่า "เปิดใบผลิตไม่ได้" ตอนขาดไฟล์พิมพ์ เพราะ server ไม่ได้กั้นจริง (ด่านพร้อมผลิตดูแค่แบบอนุมัติ)
   ============================================================ */

type OrderProductions = RouterOutput["order"]["getById"]["productions"];
type OrderProduction = OrderProductions[number];

interface ProductionSummaryCardProps {
  orderId: string;
  internalStatus: string;
  productions: OrderProductions;
  isManagerUp: boolean;
  productionV2Enabled: boolean;
  /** ชนิดงาน — ไม่ส่ง = ถือเป็นงานสั่งทำ (ต้องมีแบบ/ไฟล์พิมพ์) */
  orderType?: string;
  /** จำนวนไฟล์พิมพ์ของออเดอร์ · null/ไม่ส่ง = ยังไม่รู้ (โหลดอยู่หรือโหลดไม่ได้) จึงไม่เดา */
  printFileCount?: number | null;
  /** พาไปแท็บ "ม็อกอัพ & ไฟล์" เพื่อเพิ่มไฟล์พิมพ์ */
  onOpenFiles?: () => void;
}

type StepState = "done" | "cur" | "todo";

const PAST_PRODUCTION = ["READY_TO_SHIP", "SHIPPED", "COMPLETED"];
const IN_PRODUCTION = ["PRODUCING", "QUALITY_CHECK", "PACKING"];

export function ProductionSummaryCard({
  orderId,
  internalStatus,
  productions,
  isManagerUp,
  productionV2Enabled,
  orderType,
  printFileCount = null,
  onOpenFiles,
}: ProductionSummaryCardProps) {
  const [now] = useState(() => new Date());
  const hasProduction = productions.length > 0;

  // เปิดใบผลิต = อำนาจหัวหน้า + สถานะถึงเกณฑ์ (ชุดเดียวกับปุ่มเดิม)
  const canCreate =
    isManagerUp &&
    !hasProduction &&
    ["PRODUCTION_QUEUE", "DESIGN_APPROVED", "CONFIRMED"].includes(internalStatus);
  const openLabel = productionV2Enabled ? "เปิดใบสั่งผลิต" : "เปิดงานผลิต";
  const single = productions.length === 1 ? productions[0] : null;

  return (
    <section className={c("card")} aria-labelledby="prod-card-h">
      <CardHead
        icon={Factory}
        tone="warn"
        id="prod-card-h"
        title="งานผลิต"
        right={
          single ? (
            <>
              {single.workOrderNumber ? (
                <span className={c("chip blue mono")}>{single.workOrderNumber}</span>
              ) : null}
              <Link href={`/production/${single.id}`} className={c("btn sm")}>
                {openLabel}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </>
          ) : !hasProduction ? (
            <span className={c("chip gray")}>ยังไม่เปิดใบผลิต</span>
          ) : undefined
        }
      />
      <div className={c("cb")}>
        <div className={c("stack")} style={{ gap: 12 }}>
          {hasProduction ? (
            productions.map((prod) => (
              <ProductionSteps
                key={prod.id}
                prod={prod}
                internalStatus={internalStatus}
                showNumber={!single}
                openLabel={openLabel}
                now={now}
              />
            ))
          ) : (
            <NoProductionState
              orderId={orderId}
              internalStatus={internalStatus}
              orderType={orderType}
              printFileCount={printFileCount}
              canCreate={canCreate}
              onOpenFiles={onOpenFiles}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** ขั้นตอนของใบผลิตหนึ่งใบ — วางเป็นลูกตรงของ .stack ตามต้นแบบ (ช่องสถานะ → หัวย่อย → รายการ) */
function ProductionSteps({
  prod,
  internalStatus,
  showNumber,
  openLabel,
  now,
}: {
  prod: OrderProduction;
  internalStatus: string;
  showNumber: boolean;
  openLabel: string;
  now: Date;
}) {
  const workflowSteps = productionWorkflowSteps(prod.steps);
  const completed = workflowSteps.filter((s) => s.status === "COMPLETED").length;
  const total = workflowSteps.length;
  // ขั้นที่กำลังทำอยู่ = ขั้นแรกที่ยังไม่เสร็จ
  const currentStep = workflowSteps.find((s) => s.status !== "COMPLETED");
  const hasPendingLegacyPackaging = prod.steps.some(
    (s) => s.stepType === "PACKAGING" && s.status !== "COMPLETED",
  );
  const legacyReadyForQc =
    internalStatus === "PRODUCING" &&
    hasPendingLegacyPackaging &&
    workflowSteps.every((s) => s.status === "COMPLETED");
  // เข้าคิวแล้วแต่ยังไม่มีขั้นไหนเสร็จ — ปุ่มไปหน้าผลิตอยู่หัวการ์ดแล้ว ช่องนี้บอกว่ารอใคร
  const queued = internalStatus === "PRODUCTION_QUEUE" && completed === 0;

  return (
    <>
      {queued ? (
        <StateBox tone="on" icon={Factory}>
          {prod.workOrderNumber ?? "ใบผลิต"} เข้าคิวแล้ว · รอหัวหน้าผลิตกดเริ่ม
        </StateBox>
      ) : null}
      {legacyReadyForQc ? (
        <StateBox tone="warn" icon={CheckCircle2}>
          ขั้นผลิตจริงครบแล้ว · รอส่งเข้า QC จากใบผลิต
        </StateBox>
      ) : null}

      <SubHead
        icon={ListTodo}
        tone="warn"
        title="ขั้นตอนใบผลิต"
        right={
          <>
            {showNumber ? (
              <Link href={`/production/${prod.id}`} className={c("chip blue mono")}>
                {prod.workOrderNumber ?? openLabel}
              </Link>
            ) : null}
            <span className={c("chip", total > 0 && completed === total ? "good" : "gray")}>
              {completed}/{total} เสร็จ
            </span>
          </>
        }
      />

      {total === 0 ? (
        <StateBox icon={ListTodo}>ใบผลิตนี้ยังไม่มีขั้นตอน</StateBox>
      ) : (
        <ol className={c("inst")}>
          {workflowSteps.map((step, index) => {
            const state: StepState =
              step.status === "COMPLETED" ? "done" : step === currentStep ? "cur" : "todo";
            const activeOutsource = step.outsourceOrders.find((os) =>
              OUTSOURCE_ACTIVE_STATUSES.includes(os.status),
            );
            const backIn = activeOutsource?.expectedBackAt
              ? differenceInBangkokDays(activeOutsource.expectedBackAt, now)
              : null;
            const lateDays = backIn !== null && backIn < 0 ? -backIn : 0;
            const who = activeOutsource?.vendor?.name ?? step.assignedTo?.name ?? null;
            const chip: { tone: string; label: string } =
              state === "done"
                ? { tone: "good", label: "เสร็จ" }
                : step.status === "FAILED"
                  ? { tone: "bad", label: "มีปัญหา" }
                  : step.status === "ON_HOLD"
                    ? { tone: "warn", label: "พักไว้" }
                    : state === "cur"
                      ? lateDays > 0
                        ? { tone: "bad", label: "ร้านนอกช้า" }
                        : { tone: "blue", label: "กำลังทำ" }
                      : { tone: "gray", label: "รอ" };
            const detail = [
              state === "done" ? "เสร็จแล้ว" : state === "cur" ? "กำลังทำ" : "รอ",
              state !== "todo" ? who : null,
              lateDays > 0 ? `เลยกำหนดรับ ${lateDays} วัน` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={step.id} className={c(state === "done" && "done", state === "cur" && "cur") || undefined}>
                <span className={c("st")} aria-hidden="true">
                  {state === "done" ? <Check /> : index + 1}
                </span>
                <span className={c("tx")}>
                  <b>{productionStepLabel(step)}</b>
                  <small>{detail}</small>
                </span>
                <span className={c("chip", chip.tone)}>{chip.label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

/** ยังไม่มีใบผลิต — บอกว่าติดอะไรจากข้อมูลจริงเท่านั้น (สถานะ/ชนิดงาน/จำนวนไฟล์พิมพ์) */
function NoProductionState({
  orderId,
  internalStatus,
  orderType,
  printFileCount,
  canCreate,
  onOpenFiles,
}: {
  orderId: string;
  internalStatus: string;
  orderType?: string;
  printFileCount: number | null;
  canCreate: boolean;
  onOpenFiles?: () => void;
}) {
  const createLink = (primary: boolean) =>
    canCreate ? (
      <Link href={`/production?create=${orderId}`} className={c("btn sm", primary && "primary")}>
        <Factory aria-hidden="true" />
        เปิดใบผลิต
      </Link>
    ) : null;

  if (internalStatus === "ON_HOLD") {
    return (
      <StateBox tone="warn" icon={Pause}>
        งานพักอยู่ · ปลดพักก่อนเปิดใบผลิต
      </StateBox>
    );
  }
  if (internalStatus === "CANCELLED") {
    return <StateBox icon={Factory}>ออเดอร์ยกเลิกแล้ว ไม่มีงานผลิต</StateBox>;
  }
  if (PAST_PRODUCTION.includes(internalStatus)) {
    return (
      <StateBox tone="good" icon={CheckCircle2}>
        ผ่านช่วงผลิตแล้ว
      </StateBox>
    );
  }
  if (IN_PRODUCTION.includes(internalStatus)) {
    return <StateBox icon={Factory}>ยังไม่มีใบผลิตในระบบ</StateBox>;
  }

  // งานสำเร็จรูปไม่มีขั้นออกแบบ — ยืนยันแล้วเปิดใบผลิตได้เลย
  if (orderType === "READY_MADE") {
    if (internalStatus === "CONFIRMED" || internalStatus === "PRODUCTION_QUEUE") {
      return (
        <StateBox tone="on" icon={Factory} action={createLink(true)}>
          {canCreate ? "งานสำเร็จรูป พร้อมเปิดใบผลิต" : "รอหัวหน้าผลิตเปิดใบผลิต"}
        </StateBox>
      );
    }
    return <StateBox icon={Factory}>เปิดใบผลิตได้เมื่อยืนยันออเดอร์</StateBox>;
  }

  if (internalStatus === "DESIGN_APPROVED" || internalStatus === "PRODUCTION_QUEUE") {
    if (printFileCount === 0) {
      return (
        <StateBox
          tone="warn"
          icon={Printer}
          action={
            <>
              {onOpenFiles ? (
                <button type="button" className={c("btn sm")} onClick={onOpenFiles}>
                  <Plus aria-hidden="true" />
                  เพิ่มไฟล์พิมพ์
                </button>
              ) : null}
              {createLink(false)}
            </>
          }
        >
          แบบผ่านแล้ว แต่ยังไม่มีไฟล์พิมพ์
        </StateBox>
      );
    }
    return (
      <StateBox tone="on" icon={CheckCircle2} action={createLink(true)}>
        {printFileCount ? "แบบผ่านและมีไฟล์พิมพ์แล้ว" : "แบบผ่านแล้ว"}
      </StateBox>
    );
  }

  // งานสั่งทำก่อนแบบผ่าน (สอบถาม/ยืนยัน/ออกแบบ) — หัวหน้ายังเปิดก่อนได้ตามสิทธิ์เดิม
  return (
    <StateBox icon={Factory} action={createLink(false)}>
      ยังไม่มีใบผลิต · รอแบบผ่านและไฟล์พิมพ์
    </StateBox>
  );
}
