"use client";

/* สี่แบบที่กำลังเทียบ — โจทย์เดียว: หัวหน้าคุมงานจบในหน้าใบงาน ไม่ต้องสลับไปจอสถานี
   ทุกแบบใช้ข้อมูลชุดเดียวกันและ component จริงชุดเดียวกัน ต่างกันแค่ "ปุ่มลงมืออยู่ตรงไหน" */

import type * as React from "react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { ArrowRight, ClipboardList, Factory, Info, Maximize2, Route } from "lucide-react";

import {
  PROTO_WORK_ORDER,
  quantityTotals,
  type ProtoOperation,
} from "./_data";
import {
  OperationActions,
  OperationMeta,
  OperationStatus,
  OperationTable,
  QuantityGrid,
  WorkOrderHeader,
} from "./_pieces";
import { FlowHint, HorizontalFlow, TwoLaneFlow, VerticalRail } from "./_flow";
import { TwoLaneFullVariant } from "./_r3-page";

/** ขั้นที่ควรถูกเลือกไว้ก่อน — งานที่กำลังทำ ถ้าไม่มีก็ขั้นแรกที่พร้อมทำ */
function defaultOperation() {
  return (
    PROTO_WORK_ORDER.operations.find((operation) => operation.state === "RUNNING") ??
    PROTO_WORK_ORDER.operations.find((operation) => operation.state === "READY") ??
    PROTO_WORK_ORDER.operations[0]!
  );
}

/* ------------------------------------------------------ ของจริงตอนนี้ */

export function CurrentVariant() {
  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <Alert variant="info" title="หน้านี้ดูอย่างเดียว">
        หัวหน้าเห็นทุกอย่างในใบงาน แต่ปุ่ม “เริ่มงาน / บันทึกผล / ปิดขั้น” อยู่ที่จอสถานีเท่านั้น —
        ต้องเปิดอีกจอแล้วหางานให้เจอเองอีกที
      </Alert>
      <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
        <OperationTable />
      </Section>
      <div className="flex justify-end">
        <Button variant="outline">
          ไปจอสถานี
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------ A · ปุ่มลงมือในแถวขั้นงาน */

export function InlineVariant() {
  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
        {/* ปุ่มอยู่ท้ายแถวของขั้นนั้นเลย — เห็นทั้งใบพร้อมกัน กดได้ทุกขั้นที่พร้อม */}
        <OperationTable withActions />
      </Section>
      <p className="text-xs text-muted">
        การกรอกจำนวนแยกสี/ไซซ์จะเปิดเป็นหน้าต่างซ้อนเมื่อกด “บันทึกผลงาน”
      </p>
    </div>
  );
}

/* --------------------------------- B · แผงงานปัจจุบันด้านข้าง (จอสถานีย่อ) */

export function SideVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const totals = quantityTotals(selected);

  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
          <OperationTable onSelect={setSelected} selectedId={selected.id} />
        </Section>

        {/* แผงลงมือ — เนื้อเดียวกับจอสถานี แต่ย่อมาอยู่ข้างตาราง */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Section
            title="ลงมือทำ"
            icon={Factory}
            tone="production"
            meta="เลือกขั้นจากตารางทางซ้าย"
          >
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-strong">{selected.name}</p>
                <OperationMeta operation={selected} />
              </div>
              <OperationStatus operation={selected} />

              {selected.gate ? (
                <Alert variant="warning" title="ขั้นนี้มีเงื่อนไขเฉพาะ">
                  {selected.gate}
                </Alert>
              ) : null}
              {selected.problem ? (
                <Alert variant="error" title="มีปัญหาค้างอยู่">
                  {selected.problem}
                </Alert>
              ) : null}

              {selected.state === "PLANNED" ? (
                <p className="text-sm text-secondary">
                  ยังเริ่มไม่ได้ — รอ{" "}
                  {selected.waitsFor
                    .map(
                      (code) =>
                        PROTO_WORK_ORDER.operations.find((item) => item.code === code)?.name ??
                        code,
                    )
                    .join(" · ")}
                </p>
              ) : (
                <>
                  {totals.planned > 0 ? (
                    <QuantityGrid operation={selected} compact />
                  ) : null}
                  <OperationActions operation={selected} size="lg" full />
                </>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------- C · แถบลงมือติดขอบล่างจอ */

export function BottomBarVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const totals = quantityTotals(selected);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-4 pb-40">
      <WorkOrderHeader />
      <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
        <OperationTable onSelect={setSelected} selectedId={selected.id} />
      </Section>

      {/* แถบเดียวกับจอสถานี — เกาะขอบล่าง กดทำงานได้โดยไม่เสียพื้นที่ตาราง */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-divider bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-strong">{selected.name}</p>
            <span className="flex flex-wrap items-center gap-2">
              <OperationMeta operation={selected} />
              {totals.planned > 0 ? (
                <span className="text-xs tabular-nums text-muted">
                  เหลือ {totals.remaining} ตัว
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totals.planned > 0 && selected.state !== "PLANNED" ? (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
                {expanded ? "ซ่อนช่องกรอก" : "กรอกจำนวน"}
              </Button>
            ) : null}
            <OperationActions operation={selected} size="lg" />
          </div>
        </div>
        {expanded && totals.planned > 0 && selected.state !== "PLANNED" ? (
          <div className="mt-3 border-t border-divider pt-3">
            <QuantityGrid operation={selected} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------ D · สลับมุมในหน้าเดียว */

export function TabsVariant() {
  const [mode, setMode] = useState<"control" | "work">("work");
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const workable = PROTO_WORK_ORDER.operations.filter(
    (operation) => operation.state === "READY" || operation.state === "RUNNING",
  );

  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <SegmentedControl
        options={[
          { value: "control", label: "ควบคุม (ภาพรวมทั้งใบ)" },
          { value: "work", label: `ลงมือทำ (${workable.length} ขั้นพร้อม)` },
        ]}
        value={mode}
        onChange={setMode}
        aria-label="เลือกมุมมอง"
      />

      {mode === "control" ? (
        <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
          <OperationTable onSelect={setSelected} selectedId={selected.id} />
        </Section>
      ) : (
        <div className="space-y-3">
          {workable.length === 0 ? (
            <Alert variant="info" title="ยังไม่มีขั้นที่ทำได้ตอนนี้">
              ทุกขั้นกำลังรอขั้นก่อนหน้า — สลับไปมุม “ควบคุม” เพื่อดูว่าติดที่ไหน
            </Alert>
          ) : (
            workable.map((operation) => {
              const totals = quantityTotals(operation);
              return (
                <Section
                  key={operation.id}
                  title={operation.name}
                  icon={Factory}
                  tone="production"
                  meta={operation.workCenter}
                >
                  <div className="space-y-3">
                    <OperationStatus operation={operation} />
                    {operation.gate ? (
                      <Alert variant="warning" title="ขั้นนี้มีเงื่อนไขเฉพาะ">
                        {operation.gate}
                      </Alert>
                    ) : null}
                    {totals.planned > 0 ? <QuantityGrid operation={operation} /> : null}
                    <OperationActions operation={operation} size="lg" full />
                  </div>
                </Section>
              );
            })
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            มุมนี้โชว์เฉพาะขั้นที่ทำได้ตอนนี้ — ขั้นที่ยังรออยู่ไม่กินที่บนจอ
          </p>
        </div>
      )}
    </div>
  );
}


/* ============================================================
   ต่อยอดจากแบบ B (เบสชอบ B แล้ว 2026-09-01) — สามทางที่ยืนบนโครงเดิม
   ทุกแบบยังเป็น "ซ้ายภาพรวม ขวาลงมือ" เหมือน B เปลี่ยนแค่วิธีทำงานกับแผงขวา
   ============================================================ */

/** แผงลงมือ — ตัวเดียวกับ B ใช้ซ้ำในทุกแบบต่อยอด */
function WorkPanel({
  operation,
  footer,
}: {
  operation: ProtoOperation;
  footer?: React.ReactNode;
}) {
  const totals = quantityTotals(operation);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-strong">{operation.name}</p>
        <OperationMeta operation={operation} />
      </div>
      <OperationStatus operation={operation} />
      {operation.gate ? (
        <Alert variant="warning" title="ขั้นนี้มีเงื่อนไขเฉพาะ">{operation.gate}</Alert>
      ) : null}
      {operation.problem ? (
        <Alert variant="error" title="มีปัญหาค้างอยู่">{operation.problem}</Alert>
      ) : null}
      {operation.state === "PLANNED" ? (
        <p className="text-sm text-secondary">
          ยังเริ่มไม่ได้ — รอ{" "}
          {operation.waitsFor
            .map((code) => PROTO_WORK_ORDER.operations.find((item) => item.code === code)?.name ?? code)
            .join(" · ")}
        </p>
      ) : (
        <>
          {totals.planned > 0 ? <QuantityGrid operation={operation} compact /> : null}
          <OperationActions operation={operation} size="lg" full />
        </>
      )}
      {footer}
    </div>
  );
}

/* --------------------------- B1 · จบขั้นแล้วไหลไปขั้นถัดไปเอง */

export function FlowVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const nextUp = PROTO_WORK_ORDER.operations.find(
    (operation) =>
      operation.id !== selected.id &&
      (operation.state === "READY" || operation.state === "RUNNING"),
  );

  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
          <OperationTable onSelect={setSelected} selectedId={selected.id} />
        </Section>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Section title="ลงมือทำ" icon={Factory} tone="production" meta="ปิดขั้นแล้วไปต่อได้ทันที">
            <WorkPanel
              operation={selected}
              footer={
                nextUp ? (
                  /* หัวใจของแบบนี้: ไม่ต้องกลับไปหาในตารางว่าจะทำอะไรต่อ */
                  <div className="rounded-xl border border-dashed border-border p-3">
                    <p className="text-xs text-muted">พอปิดขั้นนี้แล้ว ทำต่อได้เลยที่</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-strong">{nextUp.name}</span>
                        <OperationMeta operation={nextUp} />
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setSelected(nextUp)}>
                        ไปต่อ
                        <ArrowRight />
                      </Button>
                    </div>
                  </div>
                ) : null
              }
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- B2 · ติ๊กหลายขั้นแล้วสั่งพร้อมกัน */

export function BatchVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const [checked, setChecked] = useState<string[]>([]);
  const startable = PROTO_WORK_ORDER.operations.filter(
    (operation) => operation.state === "READY",
  );

  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Section
          title="เส้นทางการผลิต"
          icon={ClipboardList}
          tone="production"
          meta={`เริ่มพร้อมกันได้ ${startable.length} ขั้น`}
        >
          {/* แถวติ๊ก — เฉพาะขั้นที่พร้อมทำ (ขั้นอื่นติ๊กไม่ได้ ระบบบังคับอยู่แล้ว) */}
          <div className="mb-3 space-y-1.5 rounded-xl border border-border p-3">
            {startable.map((operation) => {
              const on = checked.includes(operation.id);
              return (
                <label
                  key={operation.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-strong"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setChecked((list) =>
                        on ? list.filter((id) => id !== operation.id) : [...list, operation.id],
                      )
                    }
                  />
                  {operation.name}
                  <span className="text-xs text-muted">{operation.workCenter}</span>
                </label>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button size="sm" disabled={checked.length === 0}>
                เริ่มงาน {checked.length > 0 ? `${checked.length} ขั้นพร้อมกัน` : "ที่เลือก"}
              </Button>
            </div>
          </div>
          <OperationTable onSelect={setSelected} selectedId={selected.id} />
        </Section>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Section title="ลงมือทำ" icon={Factory} tone="production" meta="ทีละขั้นแบบละเอียด">
            <WorkPanel operation={selected} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/* --------------------- B3 · โหมดหน้างาน (แผงขยายเต็มจอ) */

export function FocusVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const [focus, setFocus] = useState(false);

  if (focus) {
    return (
      <div className="space-y-4">
        {/* โหมดหน้างาน: ตัวหนังสือใหญ่ ปุ่มใหญ่ ไม่มีอะไรให้กดผิด — เอาไปตั้งข้างเครื่องได้ */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            โหมดหน้างาน · {PROTO_WORK_ORDER.workOrderNumber}
          </p>
          <Button variant="outline" onClick={() => setFocus(false)}>
            กลับหน้าควบคุม
          </Button>
        </div>
        <div className="card-surface rounded-2xl p-6">
          <p className="text-2xl font-semibold text-strong">{selected.name}</p>
          <p className="mt-1 text-base text-secondary">
            {selected.workCenter}
            {selected.assignee ? ` · ${selected.assignee}` : ""}
          </p>
          <div className="mt-4 space-y-4 text-base">
            <QuantityGrid operation={selected} />
            <OperationActions operation={selected} size="lg" full />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Section title="เส้นทางการผลิต" icon={ClipboardList} tone="production">
          <OperationTable onSelect={setSelected} selectedId={selected.id} />
        </Section>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Section
            title="ลงมือทำ"
            icon={Factory}
            tone="production"
            action={
              <Button variant="outline" size="sm" onClick={() => setFocus(true)}>
                <Maximize2 />
                โหมดหน้างาน
              </Button>
            }
          >
            <WorkPanel operation={selected} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   R · "เส้นทางการผลิต" ที่รู้สึกเป็นเส้นทางจริง (เบสสั่ง 2026-09-01)
   โครง B เหมือนเดิม — เปลี่ยนแค่ฝั่งซ้ายจากตารางเป็นผังเส้นทาง
   ============================================================ */

function RailLayout({
  title,
  meta,
  children,
  selected,
  hint = true,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
  selected: ProtoOperation;
  hint?: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Section title={title} icon={Route} tone="production" meta={meta}>
        {children}
        {hint ? <FlowHint /> : null}
      </Section>
      <div className="xl:sticky xl:top-4 xl:self-start">
        <Section title="ลงมือทำ" icon={Factory} tone="production" meta="ขั้นที่เลือกจากผัง">
          <WorkPanel operation={selected} />
        </Section>
      </div>
    </div>
  );
}

/** R1 · รางแนวตั้ง — ขั้นที่ขนานกันแตกออกข้าง ๆ กันบนรางเดียว */
export function RailVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <RailLayout
        title="เส้นทางการผลิต"
        meta="อ่านจากบนลงล่างตามลำดับงานจริง"
        selected={selected}
      >
        <VerticalRail onSelect={setSelected} selectedId={selected.id} />
      </RailLayout>
    </div>
  );
}

/** R2 · ผังแนวนอน — เดินซ้ายไปขวาเป็นช่วง ๆ มีลูกศรเชื่อม */
export function FlowVariantHorizontal() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <RailLayout
        title="เส้นทางการผลิต"
        meta="ไล่ซ้ายไปขวา · แต่ละช่วงเดินพร้อมกันได้"
        selected={selected}
      >
        <HorizontalFlow onSelect={setSelected} selectedId={selected.id} />
      </RailLayout>
    </div>
  );
}

/** R3 · สายพานคู่ — สายเรากับสายร้านนอกแยกราง แล้วมาบรรจบที่รีดร้อน */
export function TwoLaneVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  return (
    <div className="space-y-4">
      <WorkOrderHeader />
      <RailLayout
        title="เส้นทางการผลิต"
        meta="สองสายเดินขนาน แล้วมาบรรจบ"
        selected={selected}
      >
        <TwoLaneFlow onSelect={setSelected} selectedId={selected.id} />
      </RailLayout>
    </div>
  );
}

export const VARIANT_COMPONENTS = {
  current: CurrentVariant,
  inline: InlineVariant,
  side: SideVariant,
  bottom: BottomBarVariant,
  tabs: TabsVariant,
  flow: FlowVariant,
  batch: BatchVariant,
  focus: FocusVariant,
  rail: RailVariant,
  flowmap: FlowVariantHorizontal,
  twolane: TwoLaneVariant,
  twolanefull: TwoLaneFullVariant,
} as const;

export type WorkOrderControlVariant = keyof typeof VARIANT_COMPONENTS;
