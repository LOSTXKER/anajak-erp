import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import type { ProductionDetail, ProductionStep } from "./types";
import type { WorkOrderController } from "./work-order-controller";
import { StepPieceTable } from "./work-order-quantities";

// รัน callback ของ component จริงข้าม render โดยไม่ mount child UI หรือใช้ฐานข้อมูล
const hooks = vi.hoisted(() => ({ state: [] as unknown[], slot: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: <T,>(compute: () => T) => compute(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = hooks.slot++;
    if (!(index in hooks.state)) hooks.state[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [hooks.state[index] as T, (update: T | ((current: T) => T)) => {
      hooks.state[index] = typeof update === "function" ? (update as (current: T) => T)(hooks.state[index] as T) : update;
    }];
  },
  useRef: <T,>(initial: T) => {
    const index = hooks.slot++;
    if (!(index in hooks.state)) hooks.state[index] = { current: initial };
    return hooks.state[index] as { current: T };
  },
}));
(globalThis as Record<string, unknown>).React = React;

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const step = { id: "step-1", stepType: "HEAT_PRESS", qtyTotal: 10, qtyDone: 0, status: "IN_PROGRESS", quantities: [], outsourceOrders: [] } as unknown as ProductionStep;
  const order = { items: [{ prints: [], products: [{ id: "product-1", description: "เสื้อ", variants: [{ id: "variant-1", quantity: 10, size: "M" }] }] }] } as unknown as ProductionDetail["order"];
  const request = deferred();
  const savePieceQty = vi.fn(() => request.promise);
  const c = { canUpdateStep: true, canOwnOrSupervise: () => true, nowById: new Map(), piecePending: false, savePieceQty } as unknown as WorkOrderController;
  const render = () => { hooks.slot = 0; return StepPieceTable({ step, order, c }); };
  const input = () => nodes(render()).find((node) => node.type === NumberInput)!;
  const edit = (value: number) => (input().props.onValueChange as (value: number) => void)(value);
  const save = () => {
    const button = nodes(render()).find((node) => node.type === Button && text(node) === "บันทึกยอด")!;
    return (button.props.onClick as () => Promise<void>)();
  };
  const refresh = (done: number) => {
    step.qtyDone = done;
    step.quantities = [{ id: "quantity-1", sourceOrderItemVariantId: "variant-1", qtyPlanned: 10, qtyGood: done, qtyScrap: 0 }];
  };
  return { request, savePieceQty, render, input, edit, save, refresh };
}

beforeEach(() => { hooks.state = []; hooks.slot = 0; });

describe("ยอดใบผลิตวาง draft เฉพาะคำขอบันทึกที่ยืนยันแล้ว", () => {
  it("บันทึก 5 สำเร็จแล้ว refetch เป็น 8 ต้องแสดง 8 และไม่เสนอส่ง 5 ทับ", async () => {
    const f = fixture();
    f.edit(5);
    const saved = f.save();
    f.refresh(5);
    f.request.resolve();
    await saved;
    expect(f.input().props.value).toBe(5);
    expect(text(f.render())).not.toContain("ยอดที่แก้ยังไม่บันทึก");
    f.refresh(8);
    expect(f.input().props.value).toBe(8);
    expect(text(f.render())).not.toContain("ยอดที่แก้ยังไม่บันทึก");
    expect(f.savePieceQty).toHaveBeenCalledExactlyOnceWith("step-1", [{ variantId: "variant-1", done: 5, waste: 0 }]);
  });

  it("บันทึกไม่สำเร็จคงค่า 5 แม้ refetch เปลี่ยนฐานเป็น 8 และแจ้ง error ตรงตาราง", async () => {
    const f = fixture();
    f.edit(5);
    const saved = f.save();
    f.refresh(8);
    f.request.reject(new Error("เชื่อมต่อไม่สำเร็จ"));
    await saved;
    expect(f.input().props.value).toBe(5);
    expect(text(f.render())).toContain("ยอดที่แก้ยังไม่บันทึก");
    expect(nodes(f.render()).find((node) => node.props.role === "alert")).toBeDefined();
    expect(text(f.render())).toContain("เชื่อมต่อไม่สำเร็จ");
    expect(f.input().props.disabled).toBe(false);
  });

  it("คำตอบของ request 5 ไม่ล้างการแก้ใหม่เป็น 6 ระหว่างรอ", async () => {
    const f = fixture();
    f.edit(5);
    const saved = f.save();
    f.edit(6); // เรียก callback เดิมเพื่อจำลอง event ที่ค้างอยู่ก่อนช่องถูก disabled
    f.refresh(5);
    f.request.resolve();
    await saved;
    expect(f.input().props.value).toBe(6);
    expect(text(f.render())).toContain("ยอดที่แก้ยังไม่บันทึก");
  });

  it("refetch ที่ตรง draft ยังไม่ถือว่าคำขอสำเร็จ และกันการกดบันทึกซ้ำระหว่างรอ", async () => {
    const f = fixture();
    f.edit(5);
    const saved = f.save();
    await f.save();
    expect(f.savePieceQty).toHaveBeenCalledTimes(1);
    expect(f.input().props.disabled).toBe(true);
    expect(text(f.render())).toContain("กำลังบันทึกและตรวจยอดล่าสุด");
    f.refresh(5);
    f.render();
    f.refresh(8);
    expect(f.input().props.value).toBe(5);
    f.request.reject(new Error("ยังยืนยันไม่ได้"));
    await saved;
    expect(f.input().props.value).toBe(5);
    expect(text(f.render())).toContain("ยอดที่แก้ยังไม่บันทึก");
  });
});
