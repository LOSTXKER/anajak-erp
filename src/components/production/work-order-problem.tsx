"use client";

/**
 * ระบบแจ้งปัญหาของใบผลิต — เรื่องเดียวจบในการ์ดขั้น (เบสสั่ง 2026-09-19 "ใช้ยาก ไม่ตรงไปตรงมา กดไปแล้วไงต่อ")
 *
 * ของเดิม: กดแจ้ง → เด้งหน้าต่าง → ได้ข้อความมุมจอแล้วจบ ไม่รู้ว่าถึงใคร ต้องรออะไร ·
 * หัวหน้ามีสองทางที่เปิดคนละหน้าต่าง ("จัดการปัญหา" ในกล่องแดง กับ "แก้ให้" ที่จอหน้างาน)
 *
 * ของใหม่: แผ่นแจ้งเปิดตรงที่ปุ่มอยู่ · กล่องปัญหาบอกเส้นทาง แจ้งแล้ว → หัวหน้าตัดสิน → แก้เสร็จ
 * และปุ่มตัดสินของหัวหน้าอยู่ในกล่องเดียวกัน — ทุกปุ่มยังวิ่งผ่านคำสั่ง server ชุดเดิมทุกกติกา
 * (reportStationProblem / resolveStationProblem) ไม่มีทางลัดสถานะใหม่
 */

import { useState } from "react";
import { Check, Flag, ImageOff, Pause, ShieldCheck, ShirtIcon, TriangleAlert, Truck, UserRound, Wrench, X } from "lucide-react";

import { c } from "@/components/kit/kit";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { currentProductionProblemReason } from "@/lib/production-problem";
import { PROBLEM_REASON_MIN_LENGTH, STATION_PROBLEM_REASONS, composeProblemReason } from "@/lib/station-desk";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import type { WorkOrderController } from "./work-order-controller";
import { stepLabel } from "./work-order-pieces";

type Order = ProductionDetail["order"];

/** ไอคอนประจำเรื่องที่แจ้งบ่อย — ช่วยให้ช่างกวาดตาเจอปุ่มที่ต้องกดบนจอทัช */
const REASON_ICONS = [ShirtIcon, ShieldCheck, ImageOff, Wrench, Truck] as const;
const OTHER = "อื่น ๆ";

export const problemAnchor = (stepId: string) => `work-order-problem-${stepId}`;

/** ของเสียที่บันทึกไว้แล้วของขั้นนี้ แยกตามไซซ์ — อ่านจาก quantities ที่ getById ส่งมาอยู่แล้ว */
export function scrapBySize(step: ProductionStep, order: Order): { key: string; label: string; qty: number }[] {
  if (step.quantities.length === 0) return [];
  const sizeOf = new Map<string, string>();
  for (const item of order.items) {
    for (const prod of item.products) {
      for (const variant of prod.variants) {
        sizeOf.set(variant.id, [variant.color !== prod.fabricColor ? variant.color : null, variant.size].filter(Boolean).join(" ") || "ไม่ระบุไซซ์");
      }
    }
  }
  return step.quantities
    .filter((q) => q.qtyScrap > 0 && q.sourceOrderItemVariantId)
    .map((q) => ({ key: q.id, label: sizeOf.get(q.sourceOrderItemVariantId!) ?? "ไม่ระบุไซซ์", qty: q.qtyScrap }));
}

/* ───────────────────────── แผ่นแจ้งปัญหา ───────────────────────── */

export function ProblemReportSheet({
  step,
  ctl,
  onClose,
  intro,
}: {
  step: ProductionStep;
  ctl: WorkOrderController;
  onClose: () => void;
  /** ข้อความนำเมื่อเปิดสืบเนื่องจากการบันทึกของเสีย */
  intro?: string;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const other = reason === OTHER;
  const text = composeProblemReason(other ? "other" : reason, detail);
  const ready = text.length >= PROBLEM_REASON_MIN_LENGTH;
  return (
    <div className={c("rp")} id={problemAnchor(step.id)}>
      <div className={c("rh")}>
        <Flag aria-hidden="true" />
        <b>{intro ?? `แจ้งปัญหา · ${stepLabel(step)}`}</b>
        <button type="button" className={c("x")} onClick={onClose} aria-label="ปิดแผ่นแจ้งปัญหา">
          <X aria-hidden="true" />
        </button>
      </div>
      <div>
        <p className={c("lb")}>เกิดอะไรขึ้น</p>
        <div className={c("rchips")} role="group" aria-label="เรื่องที่เจอ">
          {[...STATION_PROBLEM_REASONS, OTHER].map((label, index) => {
            const Icon = REASON_ICONS[index] ?? Flag;
            return (
              <button
                key={label}
                type="button"
                className={c("rchip")}
                aria-pressed={reason === label}
                onClick={() => setReason(reason === label ? null : label)}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {reason ? (
        <textarea
          rows={1}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={other ? "พิมพ์สั้น ๆ ว่าเจออะไร" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"}
          aria-label="รายละเอียดเพิ่มเติม"
        />
      ) : null}
      <div className={c("rf")}>
        <span className={c("why")}>{reason ? "งานขั้นนี้จะหยุดไว้จนหัวหน้าตัดสิน" : "เลือกเรื่องที่เจอก่อน"}</span>
        <button type="button" className={c("btn lgt")} onClick={onClose} disabled={ctl.reportProblem.isPending}>
          ยกเลิก
        </button>
        <button
          type="button"
          className={c("btn primary lgt")}
          disabled={!ready || ctl.reportProblem.isPending}
          onClick={() => ctl.reportProblem.mutate({ stepId: step.id, reason: text }, { onSuccess: onClose })}
        >
          <Flag aria-hidden="true" />
          {ctl.reportProblem.isPending ? "กำลังแจ้ง…" : "แจ้งหัวหน้า"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── กล่องปัญหาที่เปิดอยู่ ───────────────────────── */

/** วิธีแก้สำเร็จรูปของหัวหน้า — กดชิปแล้วส่งเป็นเหตุผลที่บันทึกในประวัติ ไม่ต้องพิมพ์เอง */
const FIX_CHIPS = ["แก้เรียบร้อยแล้ว", "เติมของให้ครบแล้ว", "เปลี่ยนของตัวใหม่แล้ว", "ทำชดเชยให้ครบ"];

export function ProblemPanel({ step, ctl }: { step: ProductionStep; ctl: WorkOrderController }) {
  const [fixing, setFixing] = useState(false);
  const [chip, setChip] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const held = step.status === "ON_HOLD";
  const reason = currentProductionProblemReason(step) ?? step.notes ?? "ยังไม่ระบุเหตุ";
  const owner = step.assignedTo?.name ?? null;
  const scrap = ctl.order ? scrapBySize(step, ctl.order) : [];
  const canDecide = ctl.canSuperviseStep && ctl.hasProductionPermission;
  const resolution = [chip, note.trim()].filter(Boolean).join(" · ");
  const ready = resolution.length >= PROBLEM_REASON_MIN_LENGTH;

  const rail = [
    { state: "done", title: "แจ้งแล้ว", sub: owner ? `โดย ${owner}` : "" },
    { state: "cur", title: held ? "หัวหน้าพักไว้" : "หัวหน้าตัดสิน", sub: canDecide ? "ตัดสินได้ที่นี่" : "รอหัวหน้า" },
    { state: "", title: "แก้เสร็จ ทำต่อได้", sub: "" },
  ];

  return (
    <div className={c("pp", held && "held")} id={problemAnchor(step.id)} role="status">
      <div className={c("ph")}>
        <span className={c("ic")} aria-hidden="true">{held ? <Pause /> : <TriangleAlert />}</span>
        <span className={c("tt")}>
          <b>{reason}</b>
          <small>
            {stepLabel(step)} · {STEP_STATUS_LABELS[held ? "ON_HOLD" : "FAILED"]}
          </small>
        </span>
        <span className={c("chip")}>หยุดทั้งขั้น</span>
      </div>

      {scrap.length > 0 ? (
        <div className={c("hit")}>
          {scrap.map((row) => (
            <span key={row.key} className={c("q")}>
              {row.label} <b>{row.qty.toLocaleString("th-TH")}</b> เสีย
            </span>
          ))}
        </div>
      ) : null}

      <ol className={c("prail")}>
        {rail.map((node, index) => (
          <li key={node.title} className={c(node.state)}>
            <span className={c("c")} aria-hidden="true">{node.state === "done" ? <Check /> : index + 1}</span>
            <span className={c("t")}>
              <b>{node.title}</b>
              {node.sub ? <small>{node.sub}</small> : null}
            </span>
          </li>
        ))}
      </ol>

      {fixing && canDecide ? (
        <div className={c("fixform")}>
          <div className={c("qchips")} role="group" aria-label="แก้ยังไง">
            {FIX_CHIPS.map((label) => (
              <button key={label} type="button" className={c("qchip")} aria-pressed={chip === label} onClick={() => setChip(chip === label ? null : label)}>
                {label}
              </button>
            ))}
          </div>
          <textarea
            rows={1}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="จดเพิ่ม (ไม่บังคับ)"
            aria-label="รายละเอียดวิธีแก้"
          />
          <div className={c("pact")}>
            <button type="button" className={c("btn")} onClick={() => setFixing(false)} disabled={ctl.resolveProblem.isPending}>
              ยกเลิก
            </button>
            <button
              type="button"
              className={c("btn primary")}
              disabled={!ready || ctl.resolveProblem.isPending}
              onClick={() => ctl.resolveProblem.mutate({ stepId: step.id, resolutionReason: resolution }, { onSuccess: () => setFixing(false) })}
            >
              <Check aria-hidden="true" />
              {ctl.resolveProblem.isPending ? "กำลังส่งกลับ…" : "แก้แล้ว ทำต่อได้"}
            </button>
          </div>
        </div>
      ) : (
        <div className={c("pact")}>
          {canDecide ? (
            <>
              <button type="button" className={c("btn")} onClick={() => ctl.openEdit(step, "manager")}>
                <UserRound aria-hidden="true" />
                เปลี่ยนคนทำ
              </button>
              <button type="button" className={c("btn primary")} onClick={() => setFixing(true)}>
                <Check aria-hidden="true" />
                แก้แล้ว ทำต่อได้
              </button>
            </>
          ) : (
            <span className={c("turn")}>
              <TriangleAlert aria-hidden="true" />
              แจ้งหัวหน้าแล้ว — รอหัวหน้าตัดสินก่อนทำต่อ
            </span>
          )}
        </div>
      )}
    </div>
  );
}
