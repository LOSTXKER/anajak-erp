import { describe, expect, it } from "vitest";
import { applyCommand, assertPhysicalInvariants, selectOrder, selectOrders } from "./engine";
import { createDemoState, SCENARIOS } from "./fixtures";
import { DEFAULT_ACTORS, type FlowCommand, type FlowRole, type FlowState, type FlowValue } from "./types";

function command(state: FlowState, actionId: string, values: Record<string, FlowValue> = {}, role: FlowRole = "supervisor"): FlowCommand {
  const action = selectOrders(state, role).flatMap((order) => order.actions).find((item) => item.id === actionId);
  const defaults = Object.fromEntries((action?.fields ?? []).map((field) => [field.key, field.defaultValue ?? ""]));
  return { commandId: `test-${state.revision}-${actionId}`, expectedRevision: state.revision, role, actor: DEFAULT_ACTORS[role], actionId, values: { ...defaults, note: "บันทึกผลจริงตามใบงาน", defectReason: "ตำแหน่งอกซ้ายคลาดจากแบบ", checked: "yes", ...values } };
}
function act(state: FlowState, actionId: string, values: Record<string, FlowValue> = {}, role: FlowRole = "supervisor"): FlowState {
  const result = applyCommand(state, command(state, actionId, values, role));
  expect(result.error, actionId).toBeUndefined();
  assertPhysicalInvariants(result.state);
  return result.state;
}
const findLot = (state: FlowState, orderId: string, predicate: (lot: FlowState["lots"][number]) => boolean) => state.lots.find((lot) => lot.orderId === orderId && predicate(lot))!;
const total = (state: FlowState, orderId: string) => state.lots.filter((lot) => lot.orderId === orderId).reduce((n, lot) => n + lot.qty, 0);

describe("production flow prototype physical domain", () => {
  it("all scenarios share the same coherent workday and return independent state", () => {
    const baseline = createDemoState();
    expect(baseline.orders).toHaveLength(15);
    for (const scenario of SCENARIOS) {
      const state = scenario.createState();
      expect(state).toEqual(baseline);
      expect(state).not.toBe(baseline);
      expect(state.orders.some((order) => order.id === scenario.focusOrderId)).toBe(true);
      expect(() => assertPhysicalInvariants(state)).not.toThrow();
    }
  });

  it("reports matched variant film readiness rather than minimum of order totals", () => {
    const state = createDemoState();
    const press = selectOrder(state, "shortage", "supervisor")!.operations.find((operation) => operation.kind === "press")!;
    expect(press.qtyReady).toBe(30);
    expect(selectOrder(state, "shortage", "supervisor")!.operations.find((operation) => operation.kind === "film")!.qtyGood).toBe(30);
    expect(press.lines.map((line) => line.ready)).toEqual([10, 20]);
    expect(press.waitingOn).toContain("รอฟิล์มหน้าอก ดำ S 20 ชิ้น · แบบ v3");
    const sLot = findLot(state, "shortage", (lot) => lot.scopeKey === "shortage-s");
    expect(applyCommand(state, command(state, `finish|${sLot.id}`, { good: 11 })).error).toBeTruthy();
  });

  it("walks a new DTF order from independent preparation and film to final packed state", () => {
    let state = createDemoState();
    expect(selectOrder(state, "dtf-start", "worker")!.actions.filter((action) => action.primary && action.enabled).map((action) => action.kind)).toContain("acquire");
    expect(selectOrder(state, "dtf-start", "worker")!.actions.filter((action) => action.primary && action.enabled).map((action) => action.kind)).toContain("film");
    state = act(state, "film|dtf-start-film|dtf-start-m|dtf-start-item-1-dtf", { good: 30, waste: 0 }, "worker");
    state = act(state, "acquire|dtf-start-prep|dtf-start-m", { qty: 30 }, "worker");
    const garment = findLot(state, "dtf-start", () => true);
    state = act(state, `transfer|${garment.id}|dtf-start-press`, { qty: 30 }, "worker");
    state = act(state, `finish|${garment.id}`, { good: 30, rework: 0, waste: 0 }, "worker");
    state = act(state, `transfer|${garment.id}|dtf-start-qc`, { qty: 30 }, "worker");
    state = act(state, `finish|${garment.id}`, { good: 30, rework: 0, waste: 0 }, "worker");
    state = act(state, `transfer|${garment.id}|dtf-start-pack`, { qty: 30 }, "worker");
    state = act(state, `pack|${garment.id}`, { qty: 30 }, "worker");
    expect(selectOrder(state, "dtf-start", "supervisor")!).toMatchObject({ status: "packed", packedQty: 30, goodQty: 30 });
    expect(total(state, "dtf-start")).toBe(30);
  });

  it("requires defect evidence and keeps it on only the rejected cohort and history", () => {
    const original = createDemoState();
    const garment = findLot(original, "dtf", (lot) => lot.scopeKey === "dtf-s");
    expect(applyCommand(original, command(original, `finish|${garment.id}`, { good: 37, rework: 3, waste: 0, defectReason: "" })).error).toContain("จุดที่เสีย");
    const state = act(original, `finish|${garment.id}`, { good: 37, rework: 3, waste: 0, defectReason: "มุมลายหน้าอกลอก" });
    expect(findLot(state, "dtf", (lot) => lot.condition === "rework").defectReason).toBe("มุมลายหน้าอกลอก");
    expect(findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-s" && lot.condition === "available" && lot.completedOperationIds.includes("dtf-press")).defectReason).toBeUndefined();
    expect(state.history.at(-1)!.detail).toContain("มุมลายหน้าอกลอก");
  });

  it("rejects stale artwork and never borrows another variant's film", () => {
    const state = createDemoState();
    state.films.find((film) => film.scopeKey === "shortage-s")!.artworkVersion = "v2";
    const press = selectOrder(state, "shortage", "supervisor")!.operations.find((operation) => operation.kind === "press")!;
    expect(press.lines.find((line) => line.size === "S")!.ready).toBe(0);
    expect(press.qtyReady).toBe(20);
  });

  it("caps ready aggregate across multiple lots sharing a film pool", () => {
    const state = createDemoState();
    const original = findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-l");
    original.qty = 30;
    state.lots.push({ ...structuredClone(original), id: "dtf-l-split", parentLotId: original.id, qty: 30 });
    state.films.find((film) => film.scopeKey === "dtf-l")!.availableQty = 40;
    const line = selectOrder(state, "dtf", "supervisor")!.operations.find((operation) => operation.kind === "press")!.lines.find((item) => item.scopeKey === "dtf-l")!;
    expect(line.ready).toBe(40);
  });

  it("requires every print position on the same physical cohort", () => {
    const state = createDemoState();
    const scope = state.orders.find((order) => order.id === "dtf")!.scopes[0];
    scope.prints.push({ id: "dtf-back", label: "หลัง", technique: "DTF", artworkVersion: "v3" });
    state.operations.filter((operation) => operation.id === "dtf-press" || operation.id === "dtf-film").forEach((operation) => operation.printIds.push("dtf-back"));
    const garment = findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-s");
    expect(selectOrder(state, "dtf", "supervisor")!.operations.find((operation) => operation.id === "dtf-press")!.lines[0].ready).toBe(0);
    const withBack = act(state, "film|dtf-film|dtf-s|dtf-back", { good: 20, waste: 0 });
    const after = act(withBack, `finish|${garment.id}`, { good: 20, rework: 0, waste: 0 });
    expect(selectOrder(after, "dtf", "supervisor")!.operations.find((operation) => operation.id === "dtf-press")!.lines[0].good).toBe(20);
    expect(after.films.find((film) => film.printId === "dtf-back")!.availableQty).toBe(0);
    expect(after.films.find((film) => film.scopeKey === "dtf-s" && film.printId !== "dtf-back")!.availableQty).toBe(20);
  });

  it("mixed work orders apply operations only to their actual item and technique", () => {
    const order = selectOrder(createDemoState(), "mixed", "supervisor")!;
    expect(order.operations.filter((operation) => operation.kind === "press").map((operation) => operation.qtyPlanned)).toEqual([60]);
    expect(order.operations.filter((operation) => operation.kind === "vendor").map((operation) => operation.qtyPlanned)).toEqual([40]);
    expect(order.operations.find((operation) => operation.kind === "press")!.lines[0].product).toBe("เสื้อกิจกรรม");
  });

  it("labels-after is ready for pressing without waiting on a future vendor", () => {
    const order = selectOrder(createDemoState(), "labels-after", "supervisor")!;
    expect(order.operations.find((operation) => operation.kind === "press")!.qtyReady).toBe(80);
    expect(order.operations.find((operation) => operation.kind === "vendor")!.qtyReady).toBe(0);
    expect(order.nextAction).toBe("มอบหมายงาน");
  });

  it("partial 40 transfers only by an explicit supervisor decision and does not close the remaining 60", () => {
    const state = createDemoState();
    const blocked = applyCommand(state, command(state, "transfer|partial-good|partial-qc", { qty: 40 }, "worker"));
    expect(blocked.error).toContain("หัวหน้า");
    expect(blocked.state).toBe(state);
    const after = act(state, "transfer|partial-good|partial-qc", { qty: 40 });
    expect(findLot(after, "partial", (lot) => lot.id === "partial-good").currentOperationId).toBe("partial-qc");
    expect(findLot(after, "partial", (lot) => lot.id === "partial-unfinished").qty).toBe(60);
    expect(selectOrder(after, "partial", "supervisor")!.operations.find((operation) => operation.id === "partial-press")!.qtyGood).toBe(40);
    expect(total(after, "partial")).toBe(100);
    expect(after.history.at(-1)!.detail).toContain("หัวหน้าอนุมัติครั้งนี้");
  });

  it("even another partial from an approved lot requires supervisor again", () => {
    let state = act(createDemoState(), "transfer|partial-good|partial-qc", { qty: 20 });
    const remaining = findLot(state, "partial", (lot) => lot.id === "partial-good");
    expect(remaining.qty).toBe(20);
    expect(applyCommand(state, command(state, `transfer|${remaining.id}|partial-qc`, { qty: 20 }, "worker")).error).toContain("หัวหน้า");
    state = act(state, `transfer|${remaining.id}|partial-qc`, { qty: 20 });
    expect(state.lots.filter((lot) => lot.orderId === "partial" && lot.currentOperationId === "partial-qc").reduce((n, lot) => n + lot.qty, 0)).toBe(40);
  });

  it("workers can hand off all completed color/size cohorts together without requesting a partial approval", () => {
    let state = createDemoState();
    for (const garment of state.lots.filter((lot) => lot.orderId === "dtf")) state = act(state, `finish|${garment.id}`, { good: garment.qty, rework: 0, waste: 0 }, "worker");
    expect(selectOrder(state, "dtf", "worker")!.actions.find((action) => action.id === "transfer-all|dtf-press|dtf-qc")!.enabled).toBe(true);
    state = act(state, "transfer-all|dtf-press|dtf-qc", {}, "worker");
    expect(state.lots.filter((lot) => lot.orderId === "dtf" && lot.currentOperationId === "dtf-qc").reduce((n, lot) => n + lot.qty, 0)).toBe(100);
    expect(total(state, "dtf")).toBe(100);
  });

  it("receives 60 of 100 and inspects 57 good / 3 rework without changing 40 at vendor", () => {
    let state = act(createDemoState(), "receive|vendor-receive-away", { qty: 60 });
    const returned = findLot(state, "vendor-receive", (lot) => lot.condition === "inspection");
    expect(selectOrder(state, "vendor-receive", "supervisor")!.metrics).toMatchObject({ atVendor: 40, awaitingInspection: 60 });
    expect(applyCommand(state, command(state, `transfer|${returned.id}|vendor-receive-qc`, { qty: 60 })).error).toBeTruthy();
    state = act(state, `inspect|${returned.id}`, { good: 57, rework: 3, waste: 0 });
    expect(selectOrder(state, "vendor-receive", "supervisor")!.metrics).toMatchObject({ atVendor: 40, awaitingInspection: 0, rework: 3 });
    expect(total(state, "vendor-receive")).toBe(100);
    expect(findLot(state, "vendor-receive", (lot) => lot.condition === "available").qty).toBe(57);
  });

  it("cannot dispatch vendor-held garments to another shop or count them at the factory", () => {
    const state = createDemoState();
    const away = findLot(state, "labels-before", (lot) => lot.condition === "vendor");
    const view = selectOrder(state, "labels-before", "supervisor")!;
    expect(view.lots.find((lot) => lot.id === away.id)!.actions.map((action) => action.kind)).toEqual(["receive"]);
    expect(applyCommand(state, command(state, `send|${away.id}`, { qty: 80 })).error).toBeTruthy();
    expect(view.operations.find((operation) => operation.kind === "press")!.qtyReady).toBe(0);
  });

  it("vendor rework can return to vendor and needs new receipt plus inspection", () => {
    let state = act(createDemoState(), "resend|vendor-rework", { qty: 3 });
    expect(findLot(state, "vendor", (lot) => lot.id === "vendor-rework")).toMatchObject({ condition: "vendor", needsReinspection: true });
    state = act(state, "receive|vendor-rework", { qty: 3 });
    expect(findLot(state, "vendor", (lot) => lot.id === "vendor-rework").completedOperationIds).not.toContain("vendor-vendor");
    state = act(state, "inspect|vendor-rework", { good: 3, rework: 0, waste: 0 });
    expect(findLot(state, "vendor", (lot) => lot.id === "vendor-rework")).toMatchObject({ condition: "available", needsReinspection: false });
    expect(total(state, "vendor")).toBe(100);
  });

  it("repairs only the defective cohort and routes reinspection back to source QC", () => {
    let state = createDemoState();
    const good = structuredClone(state.lots.find((lot) => lot.id === "rework-good"));
    state = act(state, "plan-rework|rework-three", { target: "rework-press" });
    expect(state.lots.find((lot) => lot.id === "rework-three")!.currentOperationId).toBe("rework-press");
    state = act(state, "repair|rework-three", { qty: 3 }, "worker");
    expect(state.lots.find((lot) => lot.id === "rework-three")).toMatchObject({ currentOperationId: "rework-qc", needsReinspection: true });
    expect(selectOrder(state, "rework", "supervisor")!.goodQty).toBe(97);
    expect(applyCommand(state, command(state, "transfer|rework-three|rework-pack", { qty: 3 })).error).toBeTruthy();
    state = act(state, "reinspect|rework-three", { good: 3, rework: 0, waste: 0 });
    expect(selectOrder(state, "rework", "supervisor")!.goodQty).toBe(100);
    expect(state.lots.find((lot) => lot.id === "rework-good")).toEqual(good);
  });

  it("waste is permanent evidence and replacement is bounded by actual waste", () => {
    let state = createDemoState();
    const originalLot = findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-s");
    state = act(state, `finish|${originalLot.id}`, { good: 37, rework: 0, waste: 3 });
    expect(selectOrder(state, "dtf", "supervisor")!.wasteQty).toBe(3);
    expect(selectOrder(state, "dtf", "supervisor")!.missingQty).toBe(3);
    expect(applyCommand(state, command(state, "replace|dtf-prep|dtf-s", { qty: 4 })).error).toBeTruthy();
    state = act(state, "replace|dtf-prep|dtf-s", { qty: 3 });
    expect(total(state, "dtf")).toBe(103);
    expect(selectOrder(state, "dtf", "supervisor")!.missingQty).toBe(0);
    expect(selectOrder(state, "dtf", "supervisor")!.operations.find((operation) => operation.id === "dtf-press")!.qtyGood).toBe(37);
    expect(applyCommand(state, command(state, "replace|dtf-prep|dtf-s", { qty: 1 })).error).toBeTruthy();
  });

  it("full order output never snaps quantities when only part of a lot is reported", () => {
    const state = createDemoState();
    const garment = findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-l");
    const after = act(state, `finish|${garment.id}`, { good: 5, rework: 0, waste: 0 });
    expect(selectOrder(after, "dtf", "supervisor")!.operations.find((operation) => operation.id === "dtf-press")!.qtyGood).toBe(5);
    expect(total(after, "dtf")).toBe(100);
  });

  it("machine fallback preserves garment custody and requires vendor return inspection", () => {
    let state = createDemoState();
    const garment = findLot(state, "machine", () => true);
    expect(applyCommand(state, command(state, `finish|${garment.id}`, { good: 60 })).error).toBeTruthy();
    state = act(state, "outsource|machine-press", { vendor: "ร้านรีดสำรอง" });
    state = act(state, `send|${garment.id}`, { qty: 60 });
    expect(state.films.find((film) => film.orderId === "machine")!.availableQty).toBe(0);
    expect(findLot(state, "machine", () => true).custody).toEqual({ kind: "vendor", name: "ร้านรีดสำรอง" });
    state = act(state, `receive|${garment.id}`, { qty: 60 });
    state = act(state, `inspect|${garment.id}`, { good: 60, rework: 0, waste: 0 });
    expect(selectOrder(state, "machine", "supervisor")!.operations.find((operation) => operation.id === "machine-press")!.qtyGood).toBe(60);
  });

  it("one packed MO does not complete the order until the other MO passes QC and packs", () => {
    let state = createDemoState();
    expect(selectOrder(state, "multi-mo", "supervisor")!.status).not.toBe("packed");
    const garment = findLot(state, "multi-mo", (lot) => lot.condition !== "packed");
    state = act(state, `finish|${garment.id}`, { good: 50, rework: 0, waste: 0 });
    state = act(state, `transfer|${garment.id}|multi-mo-b-pack`, { qty: 50 });
    state = act(state, `pack|${garment.id}`, { qty: 50 });
    expect(selectOrder(state, "multi-mo", "supervisor")!).toMatchObject({ status: "packed", packedQty: 100 });
  });

  it("does not combine completion on different cohorts at a DAG join", () => {
    const state = createDemoState();
    const garment = findLot(state, "partial", (lot) => lot.id === "partial-good");
    const qc = state.operations.find((operation) => operation.id === "partial-qc")!;
    const extra = { ...structuredClone(qc), id: "extra-decoration", kind: "manual" as const, predecessorIds: ["partial-prep"] };
    state.operations.push(extra);
    qc.predecessorIds.push(extra.id);
    state.lots.find((lot) => lot.id === "partial-unfinished")!.completedOperationIds.push(extra.id);
    expect(applyCommand(state, command(state, `transfer|${garment.id}|partial-qc`, { qty: 40 })).error).toContain("รอ");
  });

  it("retries identical commands without events/stock duplication and rejects changed reuse", () => {
    const state = createDemoState();
    const request = command(state, "transfer|partial-good|partial-qc", { qty: 40 });
    const once = applyCommand(state, request);
    const again = applyCommand(once.state, request);
    expect(once.error).toBeUndefined();
    expect(again.duplicate).toBe(true);
    expect(again.state).toBe(once.state);
    expect(again.state.history).toHaveLength(state.history.length + 1);
    expect(applyCommand(once.state, { ...request, values: { ...request.values, qty: 20 } }).error).toContain("ข้อมูลอื่น");
  });

  it("stale revisions and failed commands preserve the complete original state", () => {
    const state = createDemoState();
    const snapshot = structuredClone(state);
    const request = command(state, "transfer|partial-good|partial-qc", { qty: 40 });
    const result = applyCommand(state, { ...request, expectedRevision: 999 });
    expect(result.error).toContain("ข้อมูลเปลี่ยน");
    expect(result.state).toBe(state);
    expect(state).toEqual(snapshot);
  });

  it("viewer and worker ownership are enforced on every command", () => {
    const state = createDemoState();
    const garment = findLot(state, "dtf", (lot) => lot.scopeKey === "dtf-l");
    expect(selectOrders(state, "viewer").flatMap((order) => order.actions).every((action) => !action.enabled)).toBe(true);
    expect(applyCommand(state, command(state, `finish|${garment.id}`, { good: 1 }, "viewer")).error).toContain("ดูอย่างเดียว");
    const request = command(state, `finish|${garment.id}`, { good: 1 }, "worker");
    expect(applyCommand(state, { ...request, actor: { id: "worker-2", name: "ช่างสอง" } }).error).toContain("ช่างหนึ่ง");
  });

  it("does not forge details or permit commands on unknown legacy records", () => {
    const order = selectOrder(createDemoState(), "unknown", "supervisor")!;
    expect(order.status).toBe("unknown");
    expect(order.actions).toEqual([]);
    expect(order.lots).toEqual([]);
    expect(order.summary).toContain("ยังไม่มีหลักฐาน");
    expect(order.missingQty).toBe(0);
  });

  it("permissions change available controls but never change operational truth", () => {
    const state = createDemoState();
    for (const parent of state.orders) {
      const supervisor = selectOrder(state, parent.id, "supervisor")!;
      const viewer = selectOrder(state, parent.id, "viewer")!;
      expect(viewer.status).toBe(supervisor.status);
      expect(viewer.nextAction).toBe(supervisor.nextAction);
      expect(viewer.operations.map((operation) => operation.state)).toEqual(supervisor.operations.map((operation) => operation.state));
      expect(viewer.actions.every((action) => !action.enabled)).toBe(true);
    }
  });

  it("unreleased orders require supervisor to review the route before any execution", () => {
    let state = createDemoState();
    const before = selectOrder(state, "unreleased", "supervisor")!;
    expect(before.actions.map((action) => action.kind)).toEqual(["release"]);
    expect(applyCommand(state, command(state, "release|unreleased-prep", { route: "confirmed" }, "worker")).error).toContain("หัวหน้า");
    state = act(state, "release|unreleased-prep", { route: "confirmed" });
    expect(selectOrder(state, "unreleased", "supervisor")!.actions.some((action) => action.kind === "acquire")).toBe(true);
  });

  it("list next actions prioritize actual problems/handoffs over optional film replenishment", () => {
    const state = createDemoState();
    expect(selectOrder(state, "partial", "supervisor")!.nextAction).toBe("ส่งต่อตรวจคุณภาพสุดท้าย");
    expect(selectOrder(state, "partial", "supervisor")!.summary).toContain("40 ตัว");
    expect(selectOrder(state, "machine", "supervisor")!.nextAction).toBe("เปลี่ยนไปส่งร้านนอก");
    expect(selectOrder(state, "rework", "supervisor")!.nextAction).toBe("ส่งกองเสียไปแก้");
    expect(selectOrder(state, "multi-mo", "supervisor")!.nextAction).toBe("บันทึกผล QC");
    expect(selectOrder(state, "packed", "supervisor")!.nextAction).toBe("ส่งมอบให้ฝ่ายจัดส่ง");
    expect(state.orders.some((order) => order.dueAt < state.clock)).toBe(true);
    expect(state.operations.some((operation) => operation.assignedTo === null)).toBe(true);
  });
});
