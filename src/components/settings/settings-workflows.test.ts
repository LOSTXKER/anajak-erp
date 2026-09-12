import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PackagingSettingsPage from "@/app/(dashboard)/settings/packaging/page";
import RoutingSettingsPage from "@/app/(dashboard)/settings/routings/page";
import CostRatesSettingsPage from "@/app/(dashboard)/settings/cost-rates/page";

const harness = vi.hoisted(() => ({ state: [] as unknown[], slot: 0, data: {} as Record<string, unknown>, mutations: {} as Record<string, { mutate: ReturnType<typeof vi.fn>; mutateAsync: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; options: Record<string, (...args: unknown[]) => unknown>; isPending: boolean }> }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: <T,>(compute: () => T) => compute(),
  useState: <T,>(initial: T | (() => T)) => {
    const slot = harness.slot++;
    if (!(slot in harness.state)) harness.state[slot] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [harness.state[slot] as T, (next: T | ((current: T) => T)) => { harness.state[slot] = typeof next === "function" ? (next as (current: T) => T)(harness.state[slot] as T) : next; }];
  },
}));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));
vi.mock("@/components/settings/use-settings-draft-guard", () => ({ useSettingsDraftGuard: () => async () => true }));
vi.mock("@/lib/trpc", () => {
  const chain = (path = ""): unknown => new Proxy({}, { get: (_target, key) => {
    if (key === "useUtils") return () => chain();
    if (key === "invalidate" || key === "refetch") return vi.fn().mockResolvedValue(undefined);
    if (key === "useQuery") return () => ({ data: harness.data[path], isLoading: false, isError: false });
    if (key === "useMutation") return (options: Record<string, (...args: unknown[]) => unknown>) => {
      const mutation = harness.mutations[path] ??= { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), reset: vi.fn(), isPending: false, options };
      mutation.options = options;
      return mutation;
    };
    return chain(path ? `${path}.${String(key)}` : String(key));
  } });
  return { trpc: chain() };
});
(globalThis as Record<string, unknown>).React = React;

type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
function render(Page: () => ReactNode) { harness.slot = 0; return nodes(Page()); }
function row(tree: Element[]) { return tree.find((node) => typeof node.type === "function" && node.type.name === "DraftRow")!; }
function click(node: Element) { return (node.props.onClick as () => Promise<void>)(); }
function input(tree: Element[], id: string) { return tree.find((node) => node.props.id === id)!; }
function change(node: Element, value: string) { (node.props.onChange as (event: unknown) => void)({ target: { value } }); }

beforeEach(() => {
  harness.state = []; harness.slot = 0; harness.mutations = {};
  harness.data = { "user.me": { permissions: ["manage_settings", "see_finance"] } };
});

function routingFixture() {
  harness.data["routing.list"] = [{ id: "routing", name: "สูตรทดสอบ", versions: [{ id: "version", versionNumber: 2, state: "DRAFT", operationCount: 1 }] }];
  harness.data["routing.workCenters"] = [{ id: "center", name: "เตรียมงาน" }];
  harness.data["routing.version"] = { id: "version", routingName: "สูตรทดสอบ", versionNumber: 2, state: "DRAFT", operations: [{ id: "step", code: "PREP", name: "เตรียม", sequence: 10, phase: "PREPARATION", executionMode: "IN_HOUSE", workCenterId: "center", standardMinutes: 30, waitsFor: [], pairWithPrevious: false }] };
  const first = row(render(RoutingSettingsPage));
  (first.props.onChange as (next: unknown) => void)({ ...(first.props.operation as object), name: "ตรวจและเตรียม" });
}

describe("สูตรขั้นงาน: บันทึกคำสั่งให้สำเร็จก่อนเริ่มใช้", () => {
  it("รอ server acknowledgement และคงเวลามาตรฐานที่ไม่ได้แก้", async () => {
    routingFixture();
    let acknowledge!: () => void;
    harness.mutations["routing.saveDraft"]!.mutateAsync.mockImplementation(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
    const releaseButton = render(RoutingSettingsPage).find((node) => node.props.children === "เริ่มใช้สูตรนี้")!;
    const operation = click(releaseButton);
    await Promise.resolve();
    expect(harness.mutations["routing.saveDraft"]!.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ operations: [expect.objectContaining({ name: "ตรวจและเตรียม", standardMinutes: 30 })] }));
    expect(harness.mutations["routing.release"]!.mutate).not.toHaveBeenCalled();
    acknowledge(); await operation;
    expect(harness.mutations["routing.release"]!.mutate).toHaveBeenCalledExactlyOnceWith({ id: "version" });
  });
  it("บันทึกไม่ผ่านไม่เริ่มใช้สูตรเก่าและยังมี draft ให้แก้", async () => {
    routingFixture();
    harness.mutations["routing.saveDraft"]!.mutateAsync.mockRejectedValue(new Error("รหัสขั้นซ้ำ"));
    await click(render(RoutingSettingsPage).find((node) => node.props.children === "เริ่มใช้สูตรนี้")!);
    expect(harness.mutations["routing.release"]!.mutate).not.toHaveBeenCalled();
    expect(row(render(RoutingSettingsPage)).props.operation).toMatchObject({ name: "ตรวจและเตรียม" });
  });
});

describe("แพ็คเกจ: เปลี่ยนสถานะไม่ทิ้งชื่อที่กำลังแก้", () => {
  it("toggle อีกแถวไม่ปิด draft และบันทึกชื่อที่ trim แล้วปิดได้", async () => {
    harness.data["packaging.list"] = [{ id: "a", name: "ถุง", sortOrder: 1, isActive: true }, { id: "b", name: "กล่อง", sortOrder: 2, isActive: true }];
    await click(render(PackagingSettingsPage).find((node) => node.props["aria-label"] === "แก้ไข ถุง")!);
    change(render(PackagingSettingsPage).find((node) => node.props["aria-label"] === "ชื่อแพ็คเกจ ถุง")!, " ถุงใหม่ ");
    render(PackagingSettingsPage);
    harness.mutations["packaging.update"]!.options.onSuccess!({}, { id: "b", isActive: false });
    expect(render(PackagingSettingsPage).find((node) => node.props["aria-label"] === "ชื่อแพ็คเกจ ถุง")?.props.value).toBe(" ถุงใหม่ ");
    harness.mutations["packaging.update"]!.options.onSuccess!({}, { id: "a", name: "ถุงใหม่" });
    expect(render(PackagingSettingsPage).some((node) => node.props["aria-label"] === "ชื่อแพ็คเกจ ถุง")).toBe(false);
  });
});

describe("เรตต้นทุน: ช่องว่างไม่ถูกบันทึกเป็นศูนย์", () => {
  it("เก็บช่องว่างให้แก้ แต่ส่งศูนย์ที่ผู้ใช้กรอกชัดเจนได้", () => {
    harness.data["settings.costRates"] = { filmRatePerMeter: 20, filmRollWidthCm: 60, laborPerPiece: 2, overheadPerPiece: 1, costDeviationAlertPct: 10 };
    change(input(render(CostRatesSettingsPage), "labor-per-piece"), "");
    (render(CostRatesSettingsPage).find((node) => node.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
    expect(harness.mutations["settings.setCostRates"]!.mutate).not.toHaveBeenCalled();
    expect(input(render(CostRatesSettingsPage), "labor-per-piece").props.value).toBe("");
    change(input(render(CostRatesSettingsPage), "labor-per-piece"), "0");
    (render(CostRatesSettingsPage).find((node) => node.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
    expect(harness.mutations["settings.setCostRates"]!.mutate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ laborPerPiece: 0 }));
  });
});
