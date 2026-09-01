"use client";

/* ============================================================
   R3+ · สายพานคู่ เต็มทั้งหน้า

   เบสทัก R3 (`?v=twolane`) ว่า *"มันทำแค่ส่วนบนอะ มันไม่ได้ทำทั้งหน้าอะ"* — ถูก:
   R3 เดิมมีแค่ "หัวใบ + ผังในการ์ด + แผงลงมือขวา" ส่วนที่เหลือของหน้าใบสั่งผลิตจริง
   (ปัญหาที่บล็อก · ตัวเลขสำคัญ · จำนวนทั้งใบแยกสี/ไซซ์ · ข้อมูลอ้างอิง · ประวัติ)
   ไม่ได้ออกแบบไว้เลย

   แบบนี้ = R3 ที่ครบทั้งหน้า และทุกส่วนพูดภาษาเดียวกับผัง:
   ① แถบปัญหาที่บล็อกอยู่บนสุด — เพราะมันคือเหตุผลที่งานไม่เดิน
   ② ตัวเลขสำคัญ 4 ช่อง (กำหนดส่ง · ปัญหา · ผ่านแล้ว · จำนวนทั้งใบ)
   ③ **ผังสายพานคู่กินเต็มความกว้าง เป็นแกนของหน้า** (ไม่ใช่การ์ดใบหนึ่ง)
   ④ ที่ทำงานของขั้นที่เลือกกางใต้ผัง — ซ้ายลงมือ ขวาจำนวนของขั้นนั้น
   ⑤ ของที่ดูนาน ๆ ครั้งยุบเป็นแท็บเดียวท้ายหน้า
   ============================================================ */

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  History,
  Layers,
  Lock,
  Table2,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import {
  PROTO_WORK_ORDER,
  quantityTotals,
  type ProtoOperation,
} from "./_data";
import { TwoLaneFlow } from "./_flow";
import {
  OperationActions,
  OperationMeta,
  OperationStatus,
  QuantityGrid,
  WorkOrderHeader,
} from "./_pieces";

/* ───────────────────────────────── ② ตัวเลขสำคัญ */

function FactCell({
  icon,
  label,
  value,
  hint,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className={cn("bg-surface-muted p-3", RADIUS.inner)}>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          danger ? "text-red-700 dark:text-red-300" : "text-strong",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function FactRow() {
  const operations = PROTO_WORK_ORDER.operations;
  const done = operations.filter((item) => item.state === "COMPLETED").length;
  const problems = operations.filter((item) => item.problem).length;
  const variants = new Set(
    operations.flatMap((item) => item.quantities.map((line) => `${line.color}/${line.size}`)),
  ).size;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <FactCell
        icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
        label="กำหนดส่ง"
        value={PROTO_WORK_ORDER.deadline}
        hint={PROTO_WORK_ORDER.priority === "URGENT" ? "ด่วน" : undefined}
      />
      <FactCell
        icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        label="ปัญหาค้าง"
        value={`${problems} รายการ`}
        hint={problems > 0 ? "ต้องจัดการก่อนงานเดินต่อ" : "ยังไม่มี"}
        danger={problems > 0}
      />
      <FactCell
        icon={<CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />}
        label="ผ่านแล้ว"
        value={`${done}/${operations.length} ขั้น`}
      />
      <FactCell
        icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
        label="จำนวนทั้งใบ"
        value={`${PROTO_WORK_ORDER.totalQuantity.toLocaleString("th-TH")} ตัว`}
        hint={`${variants} สี/ไซซ์`}
      />
    </div>
  );
}

/* ───────────────────────────── ④ ที่ทำงานของขั้นที่เลือก */

function WorkArea({ operation }: { operation: ProtoOperation }) {
  const totals = quantityTotals(operation);
  return (
    <div
      className={cn(
        "grid gap-5 bg-surface p-4 ring-1 ring-inset ring-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        RADIUS.surface,
      )}
    >
      <div className="min-w-0 space-y-3">
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
              .map(
                (code) =>
                  PROTO_WORK_ORDER.operations.find((item) => item.code === code)?.name ?? code,
              )
              .join(" · ")}
          </p>
        ) : (
          <OperationActions operation={operation} size="lg" full />
        )}
      </div>

      <div className="min-w-0">
        {totals.planned > 0 ? (
          <>
            <p className="mb-2 text-xs text-secondary">
              จำนวนของขั้นนี้{" "}
              <span className="text-muted">(ระบบบังคับให้กรอกแยกสี/ไซซ์)</span>
            </p>
            <QuantityGrid operation={operation} />
          </>
        ) : (
          <p className="text-sm text-secondary">
            ขั้นนี้เป็นแบบติ๊กจบ ไม่ต้องกรอกจำนวนแยกสี/ไซซ์
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── ⑤ แท็บของที่ดูนาน ๆ ครั้ง */

function AllQuantities() {
  const rows = PROTO_WORK_ORDER.operations.flatMap((operation) =>
    operation.quantities.map((line) => ({ operation, line })),
  );
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ขั้นงาน</DataTable.Th>
          <DataTable.Th>สี / ไซซ์</DataTable.Th>
          <DataTable.Th align="right">เป้าหมาย</DataTable.Th>
          <DataTable.Th align="right">ทำได้</DataTable.Th>
          <DataTable.Th align="right">เหลือ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {rows.map(({ operation, line }) => (
          <DataTable.Row key={`${operation.id}-${line.id}`}>
            <DataTable.Td>{operation.name}</DataTable.Td>
            <DataTable.Td>
              {line.color} · {line.size}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums">
              {line.planned}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums">
              {line.good}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums text-muted">
              {Math.max(0, line.planned - line.good)}
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

const REFERENCE_ROWS: [string, string][] = [
  ["ออเดอร์ต้นทาง", PROTO_WORK_ORDER.orderNumber],
  ["ลูกค้า", PROTO_WORK_ORDER.customerName],
  ["แบบที่อนุมัติ", "เวอร์ชัน 3 · อนุมัติ 28 ส.ค. 2569"],
  ["สูตรขั้นงาน", "งานสกรีนมาตรฐาน Anajak · เวอร์ชัน 1"],
  ["ล็อกเมื่อ", "30 ส.ค. 2569 09:12 · โดยหัวหน้าผลิต"],
];

const EVENTS: [string, string][] = [
  ["30 ส.ค. 15:50", "เริ่มขั้น เบิกเสื้อจากสต๊อก · นัท"],
  ["30 ส.ค. 14:20", "ปล่อยงานเข้าสายการผลิต · หัวหน้าผลิต"],
  ["30 ส.ค. 14:18", "เปิดใบสั่งผลิตจากสูตรมาตรฐาน · หัวหน้าผลิต"],
  ["28 ส.ค. 11:02", "อนุมัติแบบเวอร์ชัน 3 · ลูกค้า"],
];

/* ───────────────────────────────────────────── ทั้งหน้า */

/** ขั้นแรกที่ลงมือได้ — เปิดหน้ามาแล้วเจอของที่ต้องทำเลย ไม่ต้องกดหา */
function defaultOperation() {
  return (
    PROTO_WORK_ORDER.operations.find((item) => item.state === "RUNNING") ??
    PROTO_WORK_ORDER.operations.find((item) => item.state === "READY") ??
    PROTO_WORK_ORDER.operations[0]!
  );
}

export function TwoLaneFullVariant() {
  const [selected, setSelected] = useState<ProtoOperation>(defaultOperation());
  const blocking = PROTO_WORK_ORDER.operations.filter((item) => item.problem);
  const done = PROTO_WORK_ORDER.operations.filter(
    (item) => item.state === "COMPLETED",
  ).length;

  return (
    <div className="space-y-4">
      <WorkOrderHeader />

      {/* ① ปัญหาที่ทำให้งานไม่เดิน — อยู่บนสุดเพราะเป็นเหตุผลที่ทุกอย่างค้าง */}
      {blocking.length > 0 ? (
        <Alert variant="error" title={`มีปัญหาค้าง ${blocking.length} รายการ`}>
          {blocking.map((item) => `${item.name}: ${item.problem}`).join(" · ")}
        </Alert>
      ) : null}

      {/* ② ตัวเลขสำคัญ */}
      <FactRow />

      {/* ③ ผัง = แกนของหน้า ไม่มีกรอบการ์ดครอบ */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-strong">
            เส้นทางการผลิต
            <span className="ml-2 text-xs font-normal text-muted">
              สองสายเดินขนาน แล้วมาบรรจบ · ผ่านแล้ว {done}/
              {PROTO_WORK_ORDER.operations.length} ขั้น
            </span>
          </p>
          <p className="text-xs text-muted">กดขั้นเพื่อลงมือทำข้างล่าง</p>
        </div>
        <TwoLaneFlow onSelect={setSelected} selectedId={selected.id} />
      </div>

      {/* ④ ที่ทำงานของขั้นที่เลือก */}
      <WorkArea operation={selected} />

      {/* ⑤ ของที่ดูนาน ๆ ครั้ง */}
      <Section compact>
        <Tabs defaultValue="qty">
          <TabsList>
            <TabsTrigger value="qty">
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              จำนวนทั้งใบ
            </TabsTrigger>
            <TabsTrigger value="ref">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              ข้อมูลอ้างอิงที่ล็อกไว้
            </TabsTrigger>
            <TabsTrigger value="events">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              ประวัติทั้งใบ
            </TabsTrigger>
          </TabsList>
          <TabsContent value="qty">
            <AllQuantities />
          </TabsContent>
          <TabsContent value="ref">
            <dl className="divide-y divide-divider">
              {REFERENCE_ROWS.map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 py-2">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="text-sm text-strong">{value}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent value="events">
            <ol className="divide-y divide-divider">
              {EVENTS.map(([time, text]) => (
                <li key={time} className="flex flex-wrap gap-x-3 py-2">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-muted">{time}</span>
                  <span className="min-w-0 flex-1 text-sm text-secondary">{text}</span>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}
