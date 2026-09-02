"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  Truck,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { RouterOutput } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type WorkOrder = RouterOutput["manufacturing"]["workOrder"];
type Operation = WorkOrder["operations"][number];
type ProductionException = WorkOrder["exceptions"][number];
type ReworkCase = WorkOrder["reworkCases"][number];
type WorkCenterLoad = RouterOutput["manufacturing"]["workCenterLoad"][number];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "เจ้าของ",
  MANAGER: "ผู้จัดการ",
  PRODUCTION_STAFF: "ฝ่ายผลิต",
};

function commandId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random()}`;
}

function dateInputValue(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateOrNull(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function OperationControlActions({
  operation,
  stale,
}: {
  operation: Operation;
  stale: boolean;
}) {
  const commands = operation.availableCommands as readonly string[];
  const canAssign = commands.includes("assignOperation");
  const canResequence = commands.includes("resequenceOperation");
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(operation.assignee?.id ?? "");
  const [workResourceId, setWorkResourceId] = useState(operation.resource?.id ?? "");
  const [sequence, setSequence] = useState(operation.dispatchSequence ?? 0);
  const [plannedStartAt, setPlannedStartAt] = useState(
    dateInputValue(operation.plannedStartAt),
  );
  const [plannedEndAt, setPlannedEndAt] = useState(
    dateInputValue(operation.plannedEndAt),
  );
  const utils = trpc.useUtils();
  const assignables = trpc.user.assignables.useQuery(
    operation.workCenter ? { workCenterId: operation.workCenter.id } : undefined,
    { enabled: assignOpen && Boolean(operation.workCenter) },
  );
  const assign = useMutationWithInvalidation(trpc.manufacturing.assignOperation, {
    invalidate: [
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
      utils.manufacturing.stationDispatch,
      utils.manufacturing.stationJob,
    ],
    onSuccess: () => {
      setAssignOpen(false);
      toast.success("มอบหมายผู้รับผิดชอบแล้ว");
    },
  });
  const resequence = useMutationWithInvalidation(
    trpc.manufacturing.resequenceOperation,
    {
      invalidate: [
        utils.manufacturing.workOrder,
        utils.manufacturing.controlList,
        utils.manufacturing.stationDispatch,
        utils.manufacturing.workCenterLoad,
      ],
      onSuccess: () => {
        setScheduleOpen(false);
        toast.success("ปรับคิวงานแล้ว");
      },
    },
  );

  if (!canAssign && !canResequence) return null;

  const scheduleInvalid =
    sequence < 0 ||
    Boolean(
      plannedStartAt && plannedEndAt && new Date(plannedEndAt) < new Date(plannedStartAt),
    );

  return (
    <>
      <div className="mt-3 flex flex-wrap justify-start gap-2 sm:justify-end">
        {canAssign ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAssigneeId(operation.assignee?.id ?? "");
              setWorkResourceId(operation.resource?.id ?? "");
              setAssignOpen(true);
            }}
            disabled={stale}
          >
            <UserRoundCheck /> มอบหมาย
          </Button>
        ) : null}
        {canResequence ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSequence(operation.dispatchSequence ?? 0);
              setPlannedStartAt(dateInputValue(operation.plannedStartAt));
              setPlannedEndAt(dateInputValue(operation.plannedEndAt));
              setScheduleOpen(true);
            }}
            disabled={stale}
          >
            <CalendarClock /> จัดคิว
          </Button>
        ) : null}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>มอบหมาย · {operation.name}</DialogTitle>
            <DialogDescription>
              แสดงเฉพาะสมาชิกที่เปิดใช้งานของ {operation.workCenter?.name ?? "ศูนย์งานนี้"}
            </DialogDescription>
          </DialogHeader>
          {!operation.workCenter ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              งานนี้ยังไม่ได้กำหนดศูนย์งาน จึงมอบหมายคนไม่ได้
            </p>
          ) : assignables.isError ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              โหลดสมาชิกศูนย์งานไม่สำเร็จ กรุณาลองใหม่
            </p>
          ) : (
            <div className="space-y-4">
              <Field label="ผู้รับผิดชอบ">
                <Select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  disabled={assignables.isLoading}
                >
                  <option value="">ยังไม่มอบหมาย</option>
                  {(assignables.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {ROLE_LABEL[user.role] ?? user.role}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="เครื่องหรือจุดทำงาน">
                <Select
                  value={workResourceId}
                  onChange={(event) => setWorkResourceId(event.target.value)}
                >
                  <option value="">ยังไม่กำหนด</option>
                  {(operation.workCenter?.resources ?? []).map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <DialogSubmitFooter
            pending={assign.isPending}
            disabled={!operation.workCenter || assignables.isLoading || assignables.isError}
            submitLabel="บันทึกผู้รับผิดชอบ"
            submitIcon={<UserRoundCheck />}
            onCancel={() => setAssignOpen(false)}
            onSubmit={() =>
              assign.mutate({
                operationJobId: operation.id,
                assigneeId: assigneeId || null,
                workResourceId: workResourceId || null,
                commandId: commandId("assign"),
                expectedRevision: operation.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>จัดคิว · {operation.name}</DialogTitle>
            <DialogDescription>
              ลำดับน้อยอยู่ก่อน วันที่เป็นแผนของหัวหน้าและไม่ใช่เวลามาตรฐานที่ระบบเดา
            </DialogDescription>
          </DialogHeader>
          <Field label="ลำดับในคิว" required>
            <NumberInput
              min={0}
              integer
              value={sequence}
              onValueChange={setSequence}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="แผนเริ่ม">
              <Input
                type="date"
                value={plannedStartAt}
                onChange={(event) => setPlannedStartAt(event.target.value)}
              />
            </Field>
            <Field label="แผนจบ">
              <Input
                type="date"
                value={plannedEndAt}
                onChange={(event) => setPlannedEndAt(event.target.value)}
              />
            </Field>
          </div>
          {scheduleInvalid ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              ลำดับต้องไม่ติดลบ และวันจบต้องไม่ก่อนวันเริ่ม
            </p>
          ) : null}
          <DialogSubmitFooter
            pending={resequence.isPending}
            disabled={scheduleInvalid}
            submitLabel="บันทึกคิว"
            submitIcon={<CalendarClock />}
            onCancel={() => setScheduleOpen(false)}
            onSubmit={() =>
              resequence.mutate({
                operationJobId: operation.id,
                dispatchSequence: sequence,
                plannedStartAt: dateOrNull(plannedStartAt),
                plannedEndAt: dateOrNull(plannedEndAt),
                commandId: commandId("schedule"),
                expectedRevision: operation.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResolveExceptionAction({
  exception,
  stale,
}: {
  exception: ProductionException;
  stale: boolean;
}) {
  const canResolve = (exception.availableCommands as readonly string[]).includes(
    "resolveException",
  );
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const qualityIssue = /QC|QUALITY|DEFECT/i.test(exception.code ?? "");
  const utils = trpc.useUtils();
  const resolve = useMutationWithInvalidation(
    trpc.manufacturing.resolveException,
    {
      invalidate: [
        utils.manufacturing.workOrder,
        utils.manufacturing.exceptionList,
        utils.manufacturing.stationDispatch,
        utils.manufacturing.stationJob,
        utils.manufacturing.workCenterLoad,
      ],
      onSuccess: () => {
        setOpen(false);
        setResolution("");
        toast.success("บันทึกผลการแก้ปัญหาแล้ว");
      },
    },
  );
  if (!canResolve || (qualityIssue && !exception.disposition)) return null;
  const invalid = !resolution.trim();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={stale}>
        <CheckCircle2 /> จัดการปัญหา
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>จัดการปัญหา</DialogTitle>
            <DialogDescription>{exception.title}</DialogDescription>
          </DialogHeader>
          <Field label="ผลการแก้ไข" required>
            <Textarea
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              rows={3}
              placeholder="อธิบายสิ่งที่ตรวจสอบและสิ่งที่ทำแล้ว"
            />
          </Field>
          {qualityIssue && exception.disposition ? (
            <div className="rounded-lg bg-surface-muted p-3 text-sm">
              <p className="text-xs text-muted">แนวทางชิ้นงานที่บันทึกจาก QC</p>
              <p className="mt-1 font-medium text-strong">
                {exception.disposition === "REWORK"
                  ? "ส่งแก้"
                  : exception.disposition === "SCRAP"
                    ? "คัดทิ้ง"
                    : "พักไว้"}
              </p>
              <p className="mt-1 text-xs text-muted">
                หน้านี้บันทึกผลการแก้ปัญหาเท่านั้น และไม่เปลี่ยนผลตัดสิน QC
              </p>
            </div>
          ) : null}
          <DialogSubmitFooter
            pending={resolve.isPending}
            disabled={invalid}
            submitLabel="ยืนยันผลการแก้ไข"
            submitIcon={<CheckCircle2 />}
            onCancel={() => setOpen(false)}
            onSubmit={() =>
              resolve.mutate({
                exceptionId: exception.id,
                resolution: resolution.trim(),
                ...(qualityIssue && exception.disposition
                  ? { disposition: exception.disposition }
                  : {}),
                commandId: commandId("resolve"),
                expectedRevision: exception.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DecideQcDispositionAction({
  workOrder,
  exception,
  stale,
}: {
  workOrder: WorkOrder;
  exception: ProductionException;
  stale: boolean;
}) {
  const canDecide = (exception.availableCommands as readonly string[]).includes(
    "decideQcDisposition",
  );
  const sourceDefect = exception.sourceQcDefect;
  const sourceLine = sourceDefect?.quantityLineId
    ? workOrder.quantityLines.find(
        (line) => line.id === sourceDefect.quantityLineId,
      )
    : null;
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<"REWORK" | "SCRAP">(
    "REWORK",
  );
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const decide = useMutationWithInvalidation(
    trpc.manufacturing.decideQcDisposition,
    {
      invalidate: [
        utils.manufacturing.workOrder,
        utils.manufacturing.exceptionList,
        utils.manufacturing.stationDispatch,
        utils.manufacturing.stationJob,
        utils.manufacturing.workCenterLoad,
      ],
      onSuccess: () => {
        setOpen(false);
        setNote("");
        toast.success(
          disposition === "REWORK"
            ? "เลือกส่งแก้แล้ว · กำหนดศูนย์งานแก้เป็นขั้นถัดไป"
            : "คัดทิ้งและปรับยอดของเสียแล้ว",
        );
      },
    },
  );

  if (
    !canDecide ||
    !sourceDefect ||
    !sourceDefect.quantityLineId ||
    sourceDefect.disposition !== "HOLD"
  ) {
    return null;
  }

  const lineLabel = sourceLine
    ? [
        sourceLine.description ?? sourceLine.sku,
        sourceLine.color,
        sourceLine.size,
        sourceLine.printPosition,
      ]
        .filter(Boolean)
        .join(" · ")
    : "รายการที่พักไว้จาก QC";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDisposition("REWORK");
          setOpen(true);
        }}
        disabled={stale}
      >
        <CheckCircle2 /> ตัดสินของที่พักไว้
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ตัดสินของที่พักไว้จาก QC</DialogTitle>
            <DialogDescription>
              {lineLabel} · {sourceDefect.qty.toLocaleString("th-TH")} ชิ้น
            </DialogDescription>
          </DialogHeader>
          <Field label="แนวทาง" required>
            <Select
              value={disposition}
              onChange={(event) =>
                setDisposition(event.target.value as "REWORK" | "SCRAP")
              }
            >
              <option value="REWORK">ส่งกลับแก้ แล้วตรวจซ้ำ</option>
              <option value="SCRAP">คัดทิ้งเป็นของเสีย</option>
            </Select>
          </Field>
          <div className="rounded-lg bg-surface-muted p-3 text-sm text-secondary">
            {disposition === "REWORK"
              ? "หลังยืนยัน ให้เลือกศูนย์งานที่รับแก้ จากนั้นปล่อยเข้าคิวและกลับมาตรวจซ้ำ"
              : "ระบบจะเพิ่มยอดของเสียให้รายการนี้และยุติปัญหา ชิ้นที่คัดทิ้งจะไม่เดินต่อ"}
          </div>
          <Field label="เหตุผลการตัดสินใจ" required>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="เช่น รีดซ้ำได้ / เนื้อผ้าเสีย ใช้ต่อไม่ได้"
            />
          </Field>
          <DialogSubmitFooter
            pending={decide.isPending}
            disabled={!note.trim()}
            submitLabel={disposition === "REWORK" ? "ยืนยันส่งแก้" : "ยืนยันคัดทิ้ง"}
            submitIcon={<CheckCircle2 />}
            onCancel={() => setOpen(false)}
            onSubmit={() =>
              decide.mutate({
                exceptionId: exception.id,
                disposition,
                note: note.trim(),
                commandId: commandId("decide-qc"),
                expectedRevision: exception.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PlanReworkAction({
  workOrder,
  operation,
  exception,
  centers,
  stale,
}: {
  workOrder: WorkOrder;
  operation: Operation;
  exception: ProductionException;
  centers: readonly WorkCenterLoad[];
  stale: boolean;
}) {
  const canPlan = (exception.availableCommands as readonly string[]).includes(
    "planRework",
  );
  const sourceDefect = exception.sourceQcDefect;
  const sourceLine = sourceDefect?.quantityLineId
    ? workOrder.quantityLines.find(
        (line) => line.id === sourceDefect.quantityLineId,
      )
    : null;
  const targetCenters = centers.filter(
    (center) =>
      center.availableForStation &&
      !["FINAL_QC", "FINAL_PACK", "OUTSOURCE"].includes(center.workCenter.code),
  );
  const [open, setOpen] = useState(false);
  const [targetWorkCenterId, setTargetWorkCenterId] = useState("");
  const [reason, setReason] = useState(exception.description ?? exception.title);
  const utils = trpc.useUtils();
  const plan = useMutationWithInvalidation(trpc.manufacturing.planRework, {
    invalidate: [
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
      utils.manufacturing.stationDispatch,
      utils.manufacturing.workCenterLoad,
    ],
    onSuccess: () => {
      setOpen(false);
      toast.success("วางแผนงานแก้แล้ว · ตรวจรายละเอียดก่อนปล่อยเข้าศูนย์งาน");
    },
  });

  if (
    !canPlan ||
    !sourceDefect ||
    !sourceDefect.quantityLineId ||
    sourceDefect.disposition !== "REWORK" ||
    sourceDefect.qty <= 0 ||
    targetCenters.length === 0 ||
    ["COMPLETED", "CANCELLED"].includes(operation.state)
  ) {
    return null;
  }

  const invalid = !targetWorkCenterId || !reason.trim();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setTargetWorkCenterId(
            targetCenters[0]?.workCenter.id ?? "",
          );
          setReason(exception.description ?? exception.title);
          setOpen(true);
        }}
        disabled={stale}
      >
        <RotateCcw /> วางแผนงานแก้ ({sourceDefect.qty})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>วางแผนงานแก้ · {operation.name}</DialogTitle>
            <DialogDescription>
              ของไม่ผ่าน {sourceDefect.qty.toLocaleString("th-TH")} ชิ้นจากผล QC นี้
              จะถูกผูกกับงานแก้และต้องกลับมาตรวจซ้ำ
            </DialogDescription>
          </DialogHeader>
          <Field label="ส่งกลับไปที่" required>
            <Select
              value={targetWorkCenterId}
              onChange={(event) => setTargetWorkCenterId(event.target.value)}
            >
              <option value="">เลือกศูนย์งาน</option>
              {targetCenters.map((center) => (
                <option key={center.workCenter.id} value={center.workCenter.id}>
                  {center.workCenter.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-lg bg-surface-muted p-3 text-sm text-secondary">
            <p className="font-medium text-strong">
              {sourceLine
                ? [
                    sourceLine.description ?? sourceLine.sku,
                    sourceLine.color,
                    sourceLine.size,
                    sourceLine.printPosition,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "รายการที่ไม่ผ่าน QC"}
            </p>
            <p className="mt-1">
              จำนวนงานแก้ {sourceDefect.qty.toLocaleString("th-TH")} ชิ้น · ระบบล็อกกับรายการนี้จนตรวจซ้ำ
            </p>
          </div>
          <Field label="เหตุผลและสิ่งที่ต้องแก้" required>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
          <DialogSubmitFooter
            pending={plan.isPending}
            disabled={invalid}
            submitLabel="บันทึกแผนงานแก้"
            submitIcon={<RotateCcw />}
            onCancel={() => setOpen(false)}
            onSubmit={() =>
              plan.mutate({
                workOrderId: workOrder.id,
                sourceOperationJobId: operation.id,
                qcDefectId: sourceDefect.id,
                sourceExceptionId: exception.id,
                targetWorkCenterId,
                qty: sourceDefect.qty,
                reason: reason.trim(),
                commandId: commandId("plan-rework"),
                expectedRevision: operation.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReleaseReworkAction({
  rework,
  stale,
}: {
  rework: ReworkCase;
  stale: boolean;
}) {
  const canRelease = (rework.availableCommands as readonly string[]).includes(
    "releaseRework",
  );
  const utils = trpc.useUtils();
  const release = useMutationWithInvalidation(trpc.manufacturing.releaseRework, {
    invalidate: [
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
      utils.manufacturing.stationDispatch,
      utils.manufacturing.workCenterLoad,
    ],
    onSuccess: () => toast.success("ปล่อยงานแก้เข้าคิวสถานีแล้ว"),
  });
  if (!canRelease) return null;
  return (
    <Button
      size="sm"
      onClick={() =>
        release.mutate({
          reworkCaseId: rework.id,
          commandId: commandId("release-rework"),
          expectedRevision: rework.revision,
        })
      }
      disabled={release.isPending || stale}
    >
      <RotateCcw /> {release.isPending ? "กำลังปล่อย…" : "ปล่อยเข้าคิวงานแก้"}
    </Button>
  );
}

export function CreateOutsourceOrderAction({
  workOrder,
  operation,
  stale,
}: {
  workOrder: WorkOrder;
  operation: Operation;
  stale: boolean;
}) {
  const canCreate = (operation.availableCommands as readonly string[]).includes(
    "createOutsourceOrder",
  );
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState(operation.name);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [expectedBackAt, setExpectedBackAt] = useState("");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();
  const vendors = trpc.outsource.listVendors.useQuery({}, { enabled: open });
  const outsourceOrders = trpc.outsource.listOrders.useQuery({}, {
    enabled: operation.code === "OUTSOURCE",
    refetchOnWindowFocus: true,
  });
  const openOrders = (outsourceOrders.data ?? []).filter(
    (item) =>
      item.productionStepId === operation.id &&
      !["QC_PASSED", "QC_FAILED"].includes(item.status),
  );
  const openAllocatedByLine = new Map<string, number>();
  for (const order of openOrders) {
    for (const line of order.quantityAllocations) {
      openAllocatedByLine.set(
        line.quantityLineId,
        (openAllocatedByLine.get(line.quantityLineId) ?? 0) + line.qty,
      );
    }
  }
  const create = useMutationWithInvalidation(trpc.outsource.createOrder, {
    invalidate: [
      utils.outsource.listOrders,
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
      utils.manufacturing.stationDispatch,
      utils.manufacturing.stationJob,
    ],
    onSuccess: () => {
      setOpen(false);
      toast.success("เปิดใบงานร้านนอกแล้ว · พร้อมส่งจากคิวงานร้านนอก");
    },
  });

  if (operation.code !== "OUTSOURCE" || !canCreate) return null;
  const operationLines = workOrder.quantityLines.filter(
    (line) => line.productionStepId === operation.id,
  );
  const availableForLine = (line: (typeof operationLines)[number]) =>
    Math.max(
      0,
      line.qtyPlanned -
        line.qtyGood -
        line.qtyRework -
        (openAllocatedByLine.get(line.id) ?? 0),
    );
  const totalAvailable = operationLines.reduce(
    (sum, line) => sum + availableForLine(line),
    0,
  );
  const selectedLines = operationLines
    .map((line) => ({
      quantityLineId: line.id,
      qty: allocations[line.id] ?? 0,
    }))
    .filter((line) => line.qty > 0);
  const quantity = selectedLines.reduce((sum, line) => sum + line.qty, 0);
  const allocationInvalid = operationLines.some((line) => {
    const qty = allocations[line.id] ?? 0;
    return !Number.isSafeInteger(qty) || qty < 0 || qty > availableForLine(line);
  });
  const invalid =
    !vendorId ||
    !description.trim() ||
    quantity < 1 ||
    quantity > operation.quantities.remaining ||
    allocationInvalid ||
    outsourceOrders.isLoading ||
    outsourceOrders.isError;
  return (
    <>
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDescription(operation.name);
            setAllocations(
              Object.fromEntries(
                operationLines.map((line) => [line.id, availableForLine(line)]),
              ),
            );
            setOpen(true);
          }}
          disabled={
            stale ||
            outsourceOrders.isLoading ||
            outsourceOrders.isError ||
            totalAvailable < 1
          }
        >
          <Truck />
          {totalAvailable < 1 && !outsourceOrders.isLoading
            ? "จัดสรรครบแล้ว"
            : "เปิดใบงานร้านนอก"}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เปิดใบงานร้านนอก</DialogTitle>
            <DialogDescription>
              {workOrder.order.orderNumber} · เลือกจำนวนที่จะส่งร้านจากรายการจริง
            </DialogDescription>
          </DialogHeader>
          <Field label="ร้านผู้รับงาน" required>
            <Select
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              disabled={vendors.isLoading || vendors.isError}
              placeholder={vendors.isError ? "โหลดรายชื่อร้านไม่สำเร็จ" : "เลือกร้าน"}
            >
              {(vendors.data ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="รายละเอียดงาน" required>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="จำนวนตามสินค้า สี ไซซ์ และจุดพิมพ์" required>
            <div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {operationLines.length === 0 ? (
                  <p role="alert" className="p-2 text-sm text-red-700 dark:text-red-300">
                    งานนี้ยังไม่มีรายการจำนวน จึงเปิดใบงานร้านนอกไม่ได้
                  </p>
                ) : (
                  operationLines.map((line) => {
                    const available = availableForLine(line);
                    return (
                      <div
                        key={line.id}
                        className="grid items-center gap-2 rounded-lg bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_7rem]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-strong">
                            {line.description || line.sku || "รายการผลิต"}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {[line.color, line.size, line.printPosition]
                              .filter(Boolean)
                              .join(" · ") || "รวมทั้งรายการ"}
                            {` · ส่งได้ ${available.toLocaleString("th-TH")} ตัว`}
                          </p>
                        </div>
                        <NumberInput
                          min={0}
                          max={available}
                          integer
                          value={allocations[line.id] ?? 0}
                          onValueChange={(value) =>
                            setAllocations((current) => ({
                              ...current,
                              [line.id]: value,
                            }))
                          }
                          aria-label={`จำนวนส่งร้าน ${line.description || line.sku || "รายการผลิต"}`}
                        />
                      </div>
                    );
                  })
                )}
              </div>
              <p className="mt-2 text-right text-sm font-medium text-strong">
                รวมส่งร้าน {quantity.toLocaleString("th-TH")} ตัว
              </p>
            </div>
          </Field>
          <Field label="กำหนดรับกลับ">
            <Input
              type="date"
              value={expectedBackAt}
              onChange={(event) => setExpectedBackAt(event.target.value)}
            />
          </Field>
          <Field label="หมายเหตุให้ผู้ประสานงาน">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <DialogSubmitFooter
            pending={create.isPending}
            disabled={invalid || vendors.isLoading || vendors.isError}
            submitLabel="เปิดใบงาน"
            submitIcon={<Truck />}
            onCancel={() => setOpen(false)}
            onSubmit={() =>
              create.mutate({
                productionStepId: operation.id,
                vendorId,
                description: description.trim(),
                quantity,
                quantityLines: selectedLines,
                unitCost: 0,
                expectedBackAt: expectedBackAt || undefined,
                notes: notes.trim() || undefined,
                commandId: commandId("create-outsource"),
                expectedRevision: operation.revision,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
