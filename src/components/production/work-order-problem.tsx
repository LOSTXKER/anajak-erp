"use client";

/**
 * ระบบแจ้งปัญหา — เรื่องเดียวจบในการ์ดขั้น (เบสสั่ง 2026-09-19 "ใช้ยาก ไม่ตรงไปตรงมา กดไปแล้วไงต่อ")
 *
 * ของเดิม: กดแจ้ง → เด้งหน้าต่าง → ได้ข้อความมุมจอแล้วจบ ไม่รู้ว่าถึงใคร ต้องรออะไร ·
 * หัวหน้ามีสองทางที่เปิดคนละหน้าต่าง ("จัดการปัญหา" ในกล่องแดง กับ "แก้ให้" ที่จอหน้างาน)
 *
 * ของใหม่: แผ่นแจ้งเปิดตรงที่ปุ่มอยู่ · กล่องปัญหาบอกเส้นทาง แจ้งแล้ว → หัวหน้ารับเรื่อง → แก้เสร็จ
 * และปุ่มตัดสินของหัวหน้าอยู่ในกล่องเดียวกัน · ตั้งแต่ 2026-09-20 หนึ่งเรื่อง = หนึ่งแถวจริงในฐาน
 * (`production_exceptions`) จึงมีหลายเรื่องต่อขั้นได้ และมีเรื่องที่ "ทำตัวที่เหลือต่อได้" โดยไม่หยุดขั้น
 *
 * ชิ้นในไฟล์นี้ใช้ทั้งใบผลิต `/production/[id]` และจอช่าง `/production/floor` (prop `touch` = จอทัช)
 * ทุกปุ่มวิ่งผ่านคำสั่ง server ชุดเดิม (reportStationProblem / acknowledgeProblem / resolveStationProblem)
 */

import { useState } from "react";
import { Check, Flag, ImageOff, Pause, Play, ShieldCheck, ShirtIcon, TriangleAlert, Truck, UserRound, Wrench, X } from "lucide-react";

import { c } from "@/components/kit/kit";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { openProblemsOf, type StepProblem } from "@/lib/production-problem";
import { PROBLEM_REASON_MIN_LENGTH, STATION_PROBLEM_REASONS, composeProblemReason, defaultBlocksStep } from "@/lib/station-desk";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { formatDateTime } from "@/lib/utils";
import { routeWaitingOn } from "@/lib/work-order-route";
import type { WorkOrderController } from "./work-order-controller";
import { activeOutsource, stepLabel } from "./work-order-pieces";

type Order = ProductionDetail["order"];

/** ไอคอนประจำเรื่องที่แจ้งบ่อย — ช่วยให้ช่างกวาดตาเจอปุ่มที่ต้องกดบนจอทัช */
const REASON_ICONS = [ShirtIcon, ShieldCheck, Flag, ImageOff, Wrench, Truck] as const;
const OTHER = "อื่น ๆ";

export const problemAnchor = (stepId: string) => `work-order-problem-${stepId}`;

/**
 * แจ้งปัญหาขั้นนี้ได้ไหม — ตัวตัดสินชุดเดียวของใบผลิตและจอช่าง ให้ตรงกับด่านของ server ทุกข้อ
 * (ขั้นยังไม่ปิด · ยังไม่มีเรื่องที่หยุดขั้นค้าง · ไม่ได้พักไว้ · ของไม่ได้อยู่ร้านนอก ·
 *  ไม่ได้อยู่ในรอบพิมพ์ · ออเดอร์ยังอยู่ระหว่างผลิต · ไม่ใช่งานของคนอื่นถ้าไม่ใช่หัวหน้า ·
 *  ขั้นก่อนหน้าในสายงานไม่ค้าง) — ไม่มีปุ่มที่กดแล้ว server ปฏิเสธ
 */
export function canReportProblem(step: ProductionStep, ctl: WorkOrderController): boolean {
  if (!ctl.canUpdateStep || !ctl.canOwnOrSupervise(step)) return false;
  if (step.status === "COMPLETED" || step.status === "FAILED" || step.status === "ON_HOLD") return false;
  if (activeOutsource(step)) return false;
  if (step.stepType === "DTF_PRINT" && step.printRunItems.length > 0) return false;
  return routeWaitingOn(step, ctl.workflowSteps).length === 0;
}

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

/** ของเสียของ "เรื่องนั้น" — แถวจริงเก็บ snapshot ไว้ตอนแจ้ง · ใบเก่าถอยไปอ่านยอดปัจจุบันของขั้น */
function scrapOf(problem: StepProblem, step: ProductionStep, order: Order | undefined) {
  if (problem.lines.length > 0) {
    return problem.lines.map((line) => ({
      key: line.id,
      label: [line.color, line.size].filter(Boolean).join(" ") || "ไม่ระบุไซซ์",
      qty: line.qty,
    }));
  }
  return problem.legacy && order ? scrapBySize(step, order) : [];
}

/* ───────────────────────── แผ่นแจ้งปัญหา ───────────────────────── */

export function ProblemReportSheet({
  step,
  ctl,
  onClose,
  intro,
  touch = false,
}: {
  step: ProductionStep;
  ctl: WorkOrderController;
  onClose: () => void;
  /** ข้อความนำเมื่อเปิดสืบเนื่องจากการบันทึกของเสีย */
  intro?: string;
  /** จอทัชโรงงาน — ปุ่มและตัวหนังสือใหญ่ขึ้น */
  touch?: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [blocks, setBlocks] = useState<boolean | null>(null);
  const other = reason === OTHER;
  const text = composeProblemReason(other ? "other" : reason, detail);
  const ready = text.length >= PROBLEM_REASON_MIN_LENGTH;
  const stops = blocks ?? defaultBlocksStep(reason);
  return (
    <div className={c("rp", touch && "touch")} id={problemAnchor(step.id)}>
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
                onClick={() => {
                  setReason(reason === label ? null : label);
                  setBlocks(null);
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {reason ? (
        <>
          <div>
            <p className={c("lb")}>แล้วงานขั้นนี้</p>
            <div className={c("rchips two")} role="group" aria-label="งานขั้นนี้เดินต่อได้ไหม">
              <button type="button" className={c("rchip")} aria-pressed={stops} onClick={() => setBlocks(true)}>
                <Pause aria-hidden="true" />
                หยุดทั้งขั้น รอหัวหน้าตัดสิน
              </button>
              <button type="button" className={c("rchip")} aria-pressed={!stops} onClick={() => setBlocks(false)}>
                <Play aria-hidden="true" />
                ทำตัวที่เหลือต่อได้
              </button>
            </div>
          </div>
          <textarea
            rows={1}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder={other ? "พิมพ์สั้น ๆ ว่าเจออะไร" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"}
            aria-label="รายละเอียดเพิ่มเติม"
          />
        </>
      ) : null}
      <div className={c("rf")}>
        <span className={c("why")}>
          {!reason
            ? "เลือกเรื่องที่เจอก่อน"
            : stops
              ? "งานขั้นนี้จะหยุดไว้จนหัวหน้าตัดสิน"
              : "หัวหน้าจะได้รับเรื่อง ส่วนงานที่เหลือทำต่อได้เลย"}
        </span>
        <button type="button" className={c("btn lgt")} onClick={onClose} disabled={ctl.reportProblem.isPending}>
          ยกเลิก
        </button>
        <button
          type="button"
          className={c("btn primary lgt")}
          disabled={!ready || ctl.reportProblem.isPending}
          onClick={() =>
            ctl.reportProblem.mutate(
              { stepId: step.id, reason: other ? text : reason!, detail: other ? undefined : detail.trim() || undefined, blocksStep: stops },
              { onSuccess: onClose },
            )
          }
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

/** ทุกเรื่องที่ยังไม่จบของขั้นนี้ — เรื่องที่หยุดขั้นขึ้นก่อนเสมอ */
export function ProblemPanel({ step, ctl, touch = false }: { step: ProductionStep; ctl: WorkOrderController; touch?: boolean }) {
  const problems = openProblemsOf(step);
  if (problems.length === 0) return null;
  return (
    <>
      {[...problems]
        .sort((a, b) => Number(b.stopsWork) - Number(a.stopsWork))
        .map((problem, index) => (
          <ProblemBox key={problem.id} problem={problem} step={step} ctl={ctl} touch={touch} first={index === 0} />
        ))}
    </>
  );
}

function ProblemBox({
  problem,
  step,
  ctl,
  touch,
  first,
}: {
  problem: StepProblem;
  step: ProductionStep;
  ctl: WorkOrderController;
  touch: boolean;
  first: boolean;
}) {
  const [fixing, setFixing] = useState(false);
  const [chip, setChip] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const scrap = scrapOf(problem, step, ctl.order);
  const canDecide = ctl.canSuperviseStep && ctl.hasProductionPermission;
  const resolution = [chip, note.trim()].filter(Boolean).join(" · ");
  const ready = resolution.length >= PROBLEM_REASON_MIN_LENGTH;
  const seen = Boolean(problem.acknowledgedAt);
  const stops = problem.stopsWork;
  const tone = problem.held ? "held" : stops ? "" : "soft";

  const rail = [
    {
      state: "done",
      title: "แจ้งแล้ว",
      sub: [problem.raisedBy?.name ? `โดย ${problem.raisedBy.name}` : "", problem.legacy ? "" : formatDateTime(problem.createdAt)].filter(Boolean).join(" · "),
    },
    {
      state: seen ? "done" : "cur",
      title: seen ? "หัวหน้ารับเรื่องแล้ว" : problem.held ? "หัวหน้าพักไว้" : "รอหัวหน้ารับเรื่อง",
      sub: seen ? (problem.owner?.name ?? "") : canDecide ? "ตัดสินได้ที่นี่" : "รอหัวหน้า",
    },
    {
      state: seen ? "cur" : "",
      title: stops ? "แก้เสร็จ ทำต่อได้" : "ปิดเรื่อง",
      sub: "",
    },
  ];

  return (
    <div className={c("pp", tone, touch && "touch")} id={first ? problemAnchor(step.id) : undefined} role="status">
      <div className={c("ph")}>
        <span className={c("ic")} aria-hidden="true">
          {problem.held ? <Pause /> : stops ? <TriangleAlert /> : <Flag />}
        </span>
        <span className={c("tt")}>
          <b>{problem.title}</b>
          <small>
            {stepLabel(step)}
            {stops ? ` · ${STEP_STATUS_LABELS[problem.held ? "ON_HOLD" : "FAILED"]}` : ""}
            {problem.description ? ` · ${problem.description}` : ""}
          </small>
        </span>
        <span className={c("chip")}>{stops ? "หยุดทั้งขั้น" : "ทำต่อได้"}</span>
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
            <span className={c("c")} aria-hidden="true">
              {node.state === "done" ? <Check /> : index + 1}
            </span>
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
          <textarea rows={1} value={note} onChange={(event) => setNote(event.target.value)} placeholder="จดเพิ่ม (ไม่บังคับ)" aria-label="รายละเอียดวิธีแก้" />
          <div className={c("pact")}>
            <button type="button" className={c("btn")} onClick={() => setFixing(false)} disabled={ctl.resolveProblem.isPending}>
              ยกเลิก
            </button>
            <button
              type="button"
              className={c("btn primary")}
              disabled={!ready || ctl.resolveProblem.isPending}
              onClick={() =>
                ctl.resolveProblem.mutate(
                  { stepId: step.id, resolutionReason: resolution, ...(problem.legacy ? {} : { problemId: problem.id }) },
                  { onSuccess: () => setFixing(false) },
                )
              }
            >
              <Check aria-hidden="true" />
              {ctl.resolveProblem.isPending ? "กำลังส่งกลับ…" : stops ? "แก้แล้ว ทำต่อได้" : "ปิดเรื่องนี้"}
            </button>
          </div>
        </div>
      ) : (
        <div className={c("pact")}>
          {canDecide ? (
            <>
              {!seen && !problem.legacy ? (
                <button
                  type="button"
                  className={c("btn")}
                  onClick={() => ctl.acknowledgeProblem.mutate({ problemId: problem.id })}
                  disabled={ctl.acknowledgeProblem.isPending}
                >
                  <ShieldCheck aria-hidden="true" />
                  รับเรื่องไว้ก่อน
                </button>
              ) : null}
              {stops ? (
                <button type="button" className={c("btn")} onClick={() => ctl.openEdit(step, "manager")}>
                  <UserRound aria-hidden="true" />
                  เปลี่ยนคนทำ
                </button>
              ) : null}
              <button type="button" className={c("btn primary")} onClick={() => setFixing(true)}>
                <Check aria-hidden="true" />
                {stops ? "แก้แล้ว ทำต่อได้" : "ปิดเรื่องนี้"}
              </button>
            </>
          ) : (
            <span className={c("turn")}>
              {stops ? <TriangleAlert aria-hidden="true" /> : <Flag aria-hidden="true" />}
              {seen
                ? `หัวหน้ารับเรื่องแล้ว${problem.owner?.name ? ` (${problem.owner.name})` : ""} — ${stops ? "กำลังหาทางแก้ให้" : "จดไว้แล้ว ทำต่อได้เลย"}`
                : stops
                  ? "แจ้งหัวหน้าแล้ว — รอหัวหน้าตัดสินก่อนทำต่อ"
                  : "แจ้งหัวหน้าแล้ว — ทำตัวที่เหลือต่อได้เลย"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
