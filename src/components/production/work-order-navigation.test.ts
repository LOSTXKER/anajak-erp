import React, { type ReactElement, type ReactNode, type RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProtoController } from "@/app/proto/work-order-states/_controller";
import { stateOf } from "@/app/proto/work-order-states/_fixtures";
import { WorkOrderStepNavigation, WorkOrderStepReadOnly, WorkOrderView } from "./work-order-page";

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

beforeEach(() => { hooks.state = []; hooks.slot = 0; });
afterEach(() => vi.unstubAllGlobals());

describe("กลับจากการอ่านขั้นแล้วคีย์บอร์ดอยู่ที่ขั้นปัจจุบัน", () => {
  it.each(["doing", "all-done"])("คืน focus หลังเปลี่ยน view สำหรับใบ %s", (scenario) => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal("document", { getElementById: () => ({ scrollIntoView: vi.fn() }) });
    const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));
    const Fixture = () => {
      hooks.slot = 0;
      const c = useProtoController(stateOf(scenario), "boss");
      return WorkOrderView({ c, itemsTab: React.createElement("p", null, "สินค้า") });
    };
    const navigation = () => nodes(Fixture()).find((node) => node.type === WorkOrderStepNavigation)!.props as Parameters<typeof WorkOrderStepNavigation>[0];
    const nav = navigation();
    const buttonRef = nav.currentButtonRef as RefObject<HTMLButtonElement | null>;
    const navButtons = nodes(WorkOrderStepNavigation(nav)).filter((node) => node.type === "button");
    expect(navButtons.filter((node) => node.props.ref === buttonRef)).toHaveLength(1);
    const currentButton = navButtons.find((node) => node.props.ref === buttonRef)!;
    expect(currentButton.props["aria-pressed"]).toBe(true);

    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    buttonRef.current = { focus, scrollIntoView } as unknown as HTMLButtonElement;
    const otherStep = nav.c.workflowSteps.find((step) => step.id !== nav.currentId)!;
    nav.onSelect(otherStep.id);
    Fixture();
    flushFrames();
    const readOnly = nodes(Fixture()).find((node) => node.type === WorkOrderStepReadOnly)!;
    expect(readOnly).toBeDefined();
    (readOnly.props.onReturn as () => void)();
    expect(focus).not.toHaveBeenCalled();

    expect(nodes(Fixture()).find((node) => node.type === WorkOrderStepReadOnly)).toBeUndefined();
    expect(navigation().selectedId).toBe(nav.currentId);
    flushFrames();
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "nearest", inline: "nearest" });
  });
});
