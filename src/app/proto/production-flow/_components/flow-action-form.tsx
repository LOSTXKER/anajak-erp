"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Fact, FactList } from "@/components/ui/fact";
import { cn } from "@/lib/utils";
import { DEFAULT_ACTORS, type CommandResult, type FlowAction, type FlowCommand, type FlowRole, type FlowValue, type LotView } from "../_domain/types";

export type CommandHandler = (command: FlowCommand) => CommandResult | Promise<CommandResult>;

/** All allowed fields and quantities come from the shared simulation engine. */
export function FlowActionForm({ action, lot, role, revision, onCommand, onClose, onSaved }: {
  action: FlowAction;
  lot?: LotView;
  role: FlowRole;
  revision: number;
  onCommand: CommandHandler;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<string, FlowValue>>(() => Object.fromEntries(action.fields.map((field) => [field.key, field.defaultValue ?? ""])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftRevision, setDraftRevision] = useState(revision);
  const attempt = useRef<{ fingerprint: string; commandId: string } | null>(null);
  const pending = useRef(false);
  const formId = `flow-action-${action.id.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button[role="combobox"], button[type="submit"]')?.focus();
  }, [action.id]);

  function validateValues(): { normalized: Record<string, FlowValue>; error?: string } {
    const normalized: Record<string, FlowValue> = {};
    for (const field of action.fields) {
      const value = values[field.key] ?? "";
      if (field.required && String(value).trim() === "") {
        return { normalized, error: `กรอก${field.label}ก่อนบันทึก` };
      }
      if (field.type === "number" && String(value).trim() !== "") {
        const number = Number(value);
        if (!Number.isFinite(number) || !Number.isInteger(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
          return { normalized, error: `${field.label}ต้องเป็นจำนวนเต็ม${field.min !== undefined ? ` ตั้งแต่ ${field.min}` : ""}${field.max !== undefined ? ` ถึง ${field.max}` : ""}` };
        }
        normalized[field.key] = number;
      } else {
        normalized[field.key] = value;
      }
    }
    return { normalized };
  }

  function reviewLatest() {
    setDraftRevision(revision);
    setError(validateValues().error ?? null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !action.enabled) return;
    if (draftRevision !== revision) {
      setError("ข้อมูลเปลี่ยนระหว่างกรอก ตรวจจำนวนและปลายทางล่าสุดก่อนบันทึก");
      return;
    }
    const { normalized, error: validationError } = validateValues();
    if (validationError) {
      setError(validationError);
      return;
    }
    const fingerprint = JSON.stringify({ actionId: action.id, normalized, revision: draftRevision });
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, commandId: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await onCommand({ commandId: attempt.current.commandId, expectedRevision: draftRevision, role, actor: DEFAULT_ACTORS[role], actionId: action.id, values: normalized });
      if (result.error) {
        setError(result.error);
      } else {
        onSaved(result.duplicate ? "รายการนี้บันทึกไว้แล้ว ไม่เพิ่มยอดซ้ำ" : `บันทึกแล้ว: ${action.label}`);
        onClose();
      }
    } catch {
      setError("บันทึกไม่สำเร็จ ค่าที่กรอกยังอยู่ ลองบันทึกอีกครั้ง");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4" aria-label={action.label}>
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-strong">{action.label}</h4>
        {action.description ? <p className="text-sm leading-relaxed text-secondary">{action.description}</p> : null}
        {action.supervisorOnly ? <p className="text-xs text-muted">การตัดสินใจของหัวหน้า</p> : null}
      </div>
      {lot ? <FactList columns={3}><Fact label="ล็อตที่เลือก" value={`${lot.size} / ${lot.color}`} sub={lot.product} /><Fact label="อยู่ที่" value={lot.location} /><Fact label="ในล็อต" value={`${lot.qty.toLocaleString("th-TH")} ตัว`} />{lot.defectReason ? <Fact label="จุดที่เสีย / สาเหตุ" value={lot.defectReason} tone="warning" className="sm:col-span-3" /> : null}</FactList> : null}
      {draftRevision !== revision ? <Alert variant="warning" title="ข้อมูลเปลี่ยนระหว่างกรอก" action={<Button type="button" variant="outline" size="sm" disabled={busy} onClick={reviewLatest}>ตรวจแล้ว ใช้ข้อมูลล่าสุด</Button>}>ค่าที่กรอกยังอยู่ ตรวจจำนวนที่ทำได้และปลายทางอีกครั้งก่อนบันทึก</Alert> : null}
      {action.fields.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {action.fields.map((field) => {
            const id = `${formId}-${field.key}`;
            const hintId = `${id}-hint`;
            const common = { id, "aria-describedby": field.hint ? hintId : undefined, disabled: busy };
            const value = String(values[field.key] ?? "");
            const change = (next: string) => setValues((previous) => ({ ...previous, [field.key]: next }));
            return (
              <div key={field.key} className={cn("min-w-0 space-y-1.5", (field.type === "textarea" || field.type === "select") && "sm:col-span-2")}>
                <label htmlFor={id} className="block text-sm font-medium text-strong">{field.label}{!field.required ? <span className="ml-1 text-xs font-normal text-muted">ถ้ามี</span> : null}</label>
                {field.type === "select" ? (
                  <Select {...common} value={value} onChange={(event) => change(event.target.value)}>
                    {!field.options?.some((option) => option.value === "") ? <option value="">เลือก{field.label}</option> : null}
                    {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea {...common} value={value} onChange={(event) => change(event.target.value)} rows={3} />
                ) : (
                  <Input {...common} type={field.type === "number" ? "number" : "text"} inputMode={field.type === "number" ? "numeric" : undefined} min={field.min} max={field.max} step={field.type === "number" ? 1 : undefined} value={value} onChange={(event) => change(event.target.value)} className={field.type === "number" ? "tabular-nums" : undefined} />
                )}
                {field.hint ? <p id={hintId} className="text-xs leading-relaxed text-secondary">{field.hint}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {error ? <Alert variant="error" title="ยังบันทึกไม่ได้">{error}</Alert> : null}
      <ActionZone note={!action.enabled ? action.disabledReason : undefined}>
        {action.enabled && draftRevision === revision ? <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Check />}{busy ? "กำลังบันทึก" : action.label}</Button> : null}
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>ยกเลิก</Button>
      </ActionZone>
    </form>
  );
}
