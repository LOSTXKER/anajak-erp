"use client";

/* ============================================================
   ตั้งค่า → สูตรขั้นงาน (เบสสั่ง 2026-09-01)

   โจทย์คำต่อคำ: "ใบการผลิตคือการเอาแต่ละโมดูลมาต่อกัน เราไม่สามารถที่จะ fix ได้
   เพราะบางทีโรงงานเราทำ หรือบางอย่างก็ส่งท่อื่น และบางครั้ง DTF เรามี แต่เครื่องเสีย
   ก็ต้องส่งที่อื่น" → หน้านี้คือที่ที่เบสแก้สูตรเองได้ ไม่ต้องรอ dev

   กติกาที่ผู้ใช้ต้องรู้สึกได้จากหน้าจอ:
   ① เวอร์ชันที่ใช้งานอยู่ **แก้ไม่ได้** — กด "แก้สูตร" แล้วระบบคัดลอกเป็นร่างใหม่ให้
      (ใบผลิตที่เปิดไปแล้วอ้างเวอร์ชันเดิมอยู่ ถ้าแก้ทับ ประวัติงานจะเพี้ยนย้อนหลัง)
   ② ทุกอย่างตรวจที่ server — หน้านี้แค่ส่งร่างไปให้ตรวจ (รวมถึงกันเงื่อนไขวนกลับ)
   ============================================================ */

import { useId, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneMark } from "@/components/ui/section";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, Truck, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "PREPARATION" | "MANUFACTURING" | "OUTSOURCE" | "QUALITY" | "PACKING";

const PHASE_LABELS: Record<Phase, string> = {
  PREPARATION: "เตรียมงาน",
  MANUFACTURING: "ผลิตในโรงงาน",
  OUTSOURCE: "ส่งร้านนอก",
  QUALITY: "ตรวจคุณภาพ",
  PACKING: "แพ็ก/ส่ง",
};

type DraftOperation = {
  code: string;
  name: string;
  phase: Phase;
  executionMode: "IN_HOUSE" | "OUTSOURCE";
  workCenterId: string | null;
  waitsFor: string[];
};

/** แถวเดียวของตารางแก้สูตร — แยกออกมาเพื่อไม่ให้ตัวหน้ายาวจนอ่านไม่ออก */
function DraftRow({
  operation,
  index,
  total,
  others,
  workCenters,
  onChange,
  onMove,
  onRemove,
}: {
  operation: DraftOperation;
  index: number;
  total: number;
  others: DraftOperation[];
  workCenters: { id: string; name: string }[];
  onChange: (next: DraftOperation) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const fieldId = useId();
  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-2 w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">
          {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <label className="block" htmlFor={`${fieldId}-name`}>
            <span className="mb-1 block text-xs text-secondary">ชื่อขั้น</span>
            <Input
              id={`${fieldId}-name`}
              value={operation.name}
              onChange={(event) => onChange({ ...operation, name: event.target.value })}
              placeholder="เช่น พิมพ์ฟิล์ม DTF"
            />
          </label>
          <label className="block" htmlFor={`${fieldId}-code`}>
            <span className="mb-1 block text-xs text-secondary">
              รหัสขั้น (ใช้อ้างอิงภายในสูตร)
            </span>
            <Input
              id={`${fieldId}-code`}
              value={operation.code}
              onChange={(event) =>
                onChange({ ...operation, code: event.target.value.toUpperCase() })
              }
              placeholder="DTF_PRINT"
            />
          </label>
          <label className="block" htmlFor={`${fieldId}-phase`}>
            <span className="mb-1 block text-xs text-secondary">ช่วงงาน</span>
            <Select
              id={`${fieldId}-phase`}
              value={operation.phase}
              onChange={(event) =>
                onChange({ ...operation, phase: event.target.value as Phase })
              }
              aria-label="ช่วงงาน"
            >
              {(Object.keys(PHASE_LABELS) as Phase[]).map((phase) => (
                <option key={phase} value={phase}>
                  {PHASE_LABELS[phase]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block" htmlFor={`${fieldId}-mode`}>
            <span className="mb-1 block text-xs text-secondary">ใครทำ</span>
            <Select
              id={`${fieldId}-mode`}
              value={operation.executionMode}
              onChange={(event) =>
                onChange({
                  ...operation,
                  executionMode: event.target.value as DraftOperation["executionMode"],
                })
              }
              aria-label="ใครทำขั้นนี้"
            >
              <option value="IN_HOUSE">ทำเองในโรงงาน</option>
              <option value="OUTSOURCE">ส่งร้านนอก</option>
            </Select>
          </label>
          <label className="block sm:col-span-2" htmlFor={`${fieldId}-center`}>
            <span className="mb-1 block text-xs text-secondary">ศูนย์งาน (ต้องเลือกก่อนเริ่มใช้สูตร)</span>
            <Select
              id={`${fieldId}-center`}
              value={operation.workCenterId ?? ""}
              onChange={(event) =>
                onChange({ ...operation, workCenterId: event.target.value || null })
              }
              aria-label="ศูนย์งาน"
            >
              <option value="">— ยังไม่เลือก —</option>
              {workCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="เลื่อนขึ้น"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="เลื่อนลง"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`ลบขั้น ${operation.name || operation.code}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* เงื่อนไข "ต้องเสร็จก่อน" — หัวใจของความยืดหยุ่น: ขั้นที่ไม่ได้ติ๊กจะเดินขนานกันได้ */}
      <div className="mt-3 border-t border-divider pt-3">
        <p className="mb-2 text-xs text-secondary">
          ขั้นนี้เริ่มได้เมื่อขั้นไหนเสร็จแล้วบ้าง{" "}
          <span className="text-muted">(ไม่ติ๊ก = เริ่มได้เลย ไม่ต้องรอใคร)</span>
        </p>
        {others.length === 0 ? (
          <p className="text-xs text-muted">ยังไม่มีขั้นอื่นให้เลือก</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {others.map((other) => {
              const checked = operation.waitsFor.includes(other.code);
              return (
                <label
                  key={other.code}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    checked
                      ? "border-blue-600 text-strong dark:border-blue-400"
                      : "border-border text-secondary hover:text-strong",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        ...operation,
                        waitsFor: checked
                          ? operation.waitsFor.filter((code) => code !== other.code)
                          : [...operation.waitsFor, other.code],
                      })
                    }
                  />
                  {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                  {other.name || other.code}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoutingSettingsPage() {
  const confirm = useConfirm();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");

  const listQuery = trpc.routing.list.useQuery();
  const workCentersQuery = trpc.routing.workCenters.useQuery();

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftOperation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** เวอร์ชันที่กำลังเปิดดู — ถ้ายังไม่เลือก ใช้เวอร์ชันล่าสุดของสูตรแรก */
  const activeVersionId = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    return listQuery.data?.[0]?.versions[0]?.id ?? null;
  }, [selectedVersionId, listQuery.data]);

  const versionQuery = trpc.routing.version.useQuery(
    { id: activeVersionId ?? "" },
    { enabled: Boolean(activeVersionId) },
  );
  const version = versionQuery.data;
  const isDraft = version?.state === "DRAFT";

  const utils = trpc.useUtils();
  const createDraft = useMutationWithInvalidation(trpc.routing.createDraft, {
    invalidate: [utils.routing],
    onSuccess: (result: { versionId: string }) => {
      setSelectedVersionId(result.versionId);
      setDraft(null);
      setError(null);
    },
    onError: (mutationError: { message: string }) => setError(mutationError.message),
  });
  const saveDraft = useMutationWithInvalidation(trpc.routing.saveDraft, {
    invalidate: [utils.routing],
    onSuccess: () => {
      setDraft(null);
      setError(null);
    },
    onError: (mutationError: { message: string }) => setError(mutationError.message),
  });
  const release = useMutationWithInvalidation(trpc.routing.release, {
    invalidate: [utils.routing],
    onSuccess: () => setError(null),
    onError: (mutationError: { message: string }) => setError(mutationError.message),
  });
  const discard = useMutationWithInvalidation(trpc.routing.discardDraft, {
    invalidate: [utils.routing],
    onSuccess: () => {
      setSelectedVersionId(null);
      setDraft(null);
      setError(null);
    },
    onError: (mutationError: { message: string }) => setError(mutationError.message),
  });

  const rows: DraftOperation[] =
    draft ??
    (version?.operations.map((operation) => ({
      code: operation.code,
      name: operation.name,
      phase: operation.phase as Phase,
      executionMode: operation.executionMode as DraftOperation["executionMode"],
      workCenterId: operation.workCenterId,
      waitsFor: operation.waitsFor,
    })) ??
      []);

  const updateRow = (index: number, next: DraftOperation) => {
    const changed = [...rows];
    const previousCode = changed[index]!.code;
    changed[index] = next;
    // เปลี่ยนรหัสขั้น = เส้นที่ชี้มาหาขั้นนี้ต้องตามไปด้วย ไม่งั้นเงื่อนไขขาดเงียบ ๆ
    setDraft(
      previousCode === next.code
        ? changed
        : changed.map((row) => ({
            ...row,
            waitsFor: row.waitsFor.map((code) => (code === previousCode ? next.code : code)),
          })),
    );
  };

  const removeRow = (index: number) => {
    const removed = rows[index]!.code;
    setDraft(
      rows
        .filter((_, position) => position !== index)
        .map((row) => ({
          ...row,
          waitsFor: row.waitsFor.filter((code) => code !== removed),
        })),
    );
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const changed = [...rows];
    [changed[index], changed[target]] = [changed[target]!, changed[index]!];
    setDraft(changed);
  };

  const addRow = () => {
    setDraft([
      ...rows,
      {
        code: `STEP_${rows.length + 1}`,
        name: "",
        phase: "MANUFACTURING",
        executionMode: "IN_HOUSE",
        workCenterId: null,
        waitsFor: [],
      },
    ]);
  };

  const submitDraft = () => {
    if (!version) return;
    saveDraft.mutate({
      versionId: version.id,
      operations: rows.map((row, index) => ({
        code: row.code.trim(),
        name: row.name.trim(),
        sequence: (index + 1) * 10,
        phase: row.phase,
        executionMode: row.executionMode,
        workCenterId: row.workCenterId,
        standardMinutes: null,
      })),
      dependencies: rows.flatMap((row) =>
        row.waitsFor.map((before) => [before, row.code.trim()] as [string, string]),
      ),
    });
  };

  const header = (
    <>
      {error ? (
        <Alert variant="error" title="แก้สูตรไม่สำเร็จ">
          {error}
        </Alert>
      ) : null}
      {!canManage && !meQuery.isLoading ? (
        <Alert variant="warning" title="ดูได้อย่างเดียว">
          บัญชีนี้ไม่มีสิทธิ์ตั้งค่าระบบ จึงแก้สูตรขั้นงานไม่ได้
        </Alert>
      ) : null}
    </>
  );

  return (
    <PageShell
      title="สูตรขั้นงาน"
      loading={listQuery.isLoading || meQuery.isLoading}
      skeleton={
        <>
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      }
      error={
        listQuery.isError
          ? {
              message: "โหลดสูตรขั้นงานไม่สำเร็จ",
              onRetry: () => void listQuery.refetch(),
            }
          : null
      }
    >
      {header}

      <p className="text-sm text-secondary">
        สูตรคือลำดับขั้นที่ใบผลิตจะเดินผ่าน — ตั้งได้ว่าขั้นไหน{" "}
        <strong className="font-medium text-strong">ทำเองหรือส่งร้าน</strong> และขั้นไหน{" "}
        <strong className="font-medium text-strong">ต้องเสร็จก่อน</strong> ขั้นที่ไม่ได้ผูกกันจะเดินขนานกันได้
        · เวอร์ชันที่ใช้งานอยู่แก้ไม่ได้ เพราะใบผลิตที่เปิดไปแล้วอ้างอิงอยู่ — กด “แก้สูตร” แล้วระบบจะคัดลอกเป็นร่างใหม่ให้
      </p>

      {(listQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Workflow}
          title="ยังไม่มีสูตรขั้นงาน"
          description="สูตรมาตรฐานถูกสร้างตอนติดตั้งระบบ — ถ้ายังไม่มี ให้รัน seed ข้อมูลตั้งต้นก่อน"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* รายการสูตรและเวอร์ชัน */}
          <div className="space-y-3">
            {listQuery.data?.map((routing) => (
              <Card key={routing.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ToneMark icon={Workflow} tone="production" />
                    {routing.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {routing.versions.map((item) => {
                    const selected = item.id === activeVersionId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedVersionId(item.id);
                          setDraft(null);
                          setError(null);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                          selected
                            ? "bg-interactive-pressed text-strong"
                            : "text-secondary hover:text-strong",
                        )}
                      >
                        <span className="font-medium">เวอร์ชัน {item.versionNumber}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="tabular-nums text-muted">
                            {item.operationCount} ขั้น
                          </span>
                          <Badge
                            variant={item.state === "RELEASED" ? "default" : "secondary"}
                            size="sm"
                          >
                            {item.state === "RELEASED" ? "ใช้งานอยู่" : "ร่าง"}
                          </Badge>
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* รายละเอียดเวอร์ชันที่เลือก */}
          <div className="space-y-3">
            {versionQuery.isLoading || !version ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-strong">
                      {version.routingName} · เวอร์ชัน {version.versionNumber}
                    </p>
                    <p className="text-xs text-muted">
                      {version.state === "RELEASED"
                        ? `ใช้งานอยู่ · ใบผลิตที่อ้างเวอร์ชันนี้ ${version.workOrderCount} ใบ`
                        : "ร่าง — ยังไม่มีใบผลิตไหนใช้ แก้ได้เต็มที่"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage && !isDraft ? (
                      <Button
                        onClick={() => createDraft.mutate({ id: version.id })}
                        disabled={createDraft.isPending}
                      >
                        แก้สูตร (สร้างร่างใหม่)
                      </Button>
                    ) : null}
                    {canManage && isDraft ? (
                      <>
                        <Button variant="outline" onClick={addRow}>
                          <Plus />
                          เพิ่มขั้น
                        </Button>
                        <Button
                          variant="outline"
                          onClick={submitDraft}
                          disabled={saveDraft.isPending || draft === null}
                        >
                          บันทึกร่าง
                        </Button>
                        <Button
                          onClick={async () => {
                            const ok = await confirm({
                              title: "เริ่มใช้สูตรเวอร์ชันนี้",
                              description:
                                "หลังประกาศใช้จะแก้เวอร์ชันนี้ไม่ได้อีก (ต้องสร้างเวอร์ชันใหม่) · ใบผลิตที่เปิดใหม่จะเดินตามสูตรนี้",
                              confirmText: "เริ่มใช้",
                            });
                            if (!ok) return;
                            if (draft !== null) submitDraft();
                            release.mutate({ id: version.id });
                          }}
                          disabled={release.isPending}
                        >
                          เริ่มใช้สูตรนี้
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "ทิ้งร่างนี้",
                              description: "ขั้นที่แก้ไว้ในร่างจะหายทั้งหมด",
                              confirmText: "ทิ้งร่าง",
                              destructive: true,
                            });
                            if (ok) discard.mutate({ id: version.id });
                          }}
                          disabled={discard.isPending}
                        >
                          ทิ้งร่าง
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {isDraft ? (
                  <div className="space-y-3">
                    {rows.map((operation, index) => (
                      <DraftRow
                        key={`${operation.code}-${index}`}
                        operation={operation}
                        index={index}
                        total={rows.length}
                        others={rows.filter((_, position) => position !== index)}
                        workCenters={workCentersQuery.data ?? []}
                        onChange={(next) => updateRow(index, next)}
                        onMove={(direction) => moveRow(index, direction)}
                        onRemove={() => removeRow(index)}
                      />
                    ))}
                  </div>
                ) : (
                  /* เวอร์ชันที่ใช้งานอยู่ = อ่านอย่างเดียว */
                  <div className="card-surface overflow-hidden rounded-2xl">
                    <ul className="divide-y divide-divider">
                      {version.operations.map((operation, index) => (
                        <li key={operation.id} className="flex gap-3 px-4 py-3">
                          <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-strong">
                              {operation.name}
                              {operation.executionMode === "OUTSOURCE" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-secondary">
                                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                                  ส่งร้านนอก
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-muted">
                              {PHASE_LABELS[operation.phase as Phase]}
                              {operation.workCenterName
                                ? ` · ${operation.workCenterName}`
                                : ""}
                            </p>
                            {operation.waitsFor.length > 0 ? (
                              <p className="mt-0.5 text-xs text-secondary">
                                รอ:{" "}
                                {operation.waitsFor
                                  .map(
                                    (code) =>
                                      version.operations.find((item) => item.code === code)
                                        ?.name ?? code,
                                  )
                                  .join(" + ")}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-muted">
                                เริ่มได้เลย ไม่ต้องรอขั้นอื่น
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
