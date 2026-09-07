"use client";

import { orderFor, type LeanOrder } from "../work-order-lean/_data";
import { CurrentE } from "../work-order-lean/_variants";
import { FlowA } from "./_flow";
import { LedgerB } from "./_ledger";
import { WizardC } from "./_wizard";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน" },
  { value: "flow", label: "A · ใบงานต่อเนื่อง" },
  { value: "ledger", label: "B · ตารางคุมงาน" },
  { value: "wizard", label: "C · ทีละขั้น" },
] as const;
export type Variant = typeof OPTIONS[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value);
export const CASES = [{ value: "overdue", label: "ร้านนอกเลยนัด" }, { value: "parallel", label: "หลายสายพร้อมกัน" }, { value: "empty", label: "ยังไม่มีขั้นงาน" }] as const;
export type Case = typeof CASES[number]["value"];
export const CASE_VALUES = CASES.map((entry) => entry.value);

function getOrder(scenario: Case): LeanOrder {
  if (scenario === "empty") return { ...orderFor(false), orderNumber: "ใบตัวอย่างรอวางแผน", status: "รอวางแผน", priority: null, dueInDays: 5, dueLabel: "12 ก.ย. 2569", routing: "ยังไม่กำหนดสูตร", steps: [], mockupVersion: null, mockups: [], items: orderFor(false).items.map((item) => ({ ...item, mockup: null })) };
  return orderFor(scenario === "parallel");
}

export function Preview({ variant, scenario, boss, idPrefix }: { variant: Variant; scenario: Case; boss: boolean; idPrefix: string }) {
  const order = getOrder(scenario);
  const props = { order, boss, idPrefix };
  return <div className="@container min-w-0">
    {variant === "now" ? <CurrentE key={scenario} {...props} /> : variant === "ledger" ? <LedgerB key={scenario} {...props} /> : variant === "wizard" ? <WizardC key={scenario} {...props} /> : <FlowA key={scenario} {...props} />}
  </div>;
}
