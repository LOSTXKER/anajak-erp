import {
  DEFAULT_ACTORS,
  type ActionField, type CommandResult, type FlowAction, type FlowActor, type FlowCommand,
  type FlowOperation, type FlowRole, type FlowState, type GarmentLot,
  type LotView, type OperationView, type OrderView, type QuantityLineView,
} from "./types";

const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const numberField = (key: string, label: string, max: number, initial = 0): ActionField => ({ key, label, type: "number", required: true, min: 0, max, defaultValue: initial });
const noteField: ActionField = { key: "note", label: "บันทึกเพิ่มเติม", type: "textarea", defaultValue: "" };
const requiredNote: ActionField = { ...noteField, label: "เหตุผล", required: true };
const defectField: ActionField = { key: "defectReason", label: "จุดที่เสีย / สาเหตุ", type: "text", defaultValue: "", hint: "ต้องระบุเมื่อมีจำนวนรอแก้หรือคัดทิ้ง เช่น ปักอกซ้ายเอียง" };
const scopeOf = (state: FlowState, key: string) => state.orders.flatMap((order) => order.scopes).find((scope) => scope.key === key)!;
const operationOf = (state: FlowState, id: string) => state.operations.find((operation) => operation.id === id)!;
const lotName = (state: FlowState, lot: GarmentLot) => { const scope = scopeOf(state, lot.scopeKey); return `${scope.product} ${scope.color} ${scope.size}`; };
const quantityFor = (state: FlowState, operation: FlowOperation, scopeKey?: string) => sum(
  state.orders.flatMap((order) => order.scopes).filter((scope) => operation.scopeKeys.includes(scope.key) && (!scopeKey || scope.key === scopeKey)),
  (scope) => scope.orderedQty,
);
const lotScope = (lot: GarmentLot, operation: FlowOperation) => lot.orderId === operation.orderId && operation.scopeKeys.includes(lot.scopeKey);
const lotsFor = (state: FlowState, operation: FlowOperation) => state.lots.filter((lot) => lotScope(lot, operation));
const relevantPredecessors = (state: FlowState, operation: FlowOperation, scopeKey: string) => operation.predecessorIds.map((id) => operationOf(state, id)).filter((predecessor) => predecessor?.scopeKeys.includes(scopeKey));
const filmPrints = (state: FlowState, operation: FlowOperation, scopeKey: string) => ["film", "press"].includes(operation.kind) ? scopeOf(state, scopeKey).prints.filter((print) => operation.printIds.includes(print.id) && print.technique === "DTF") : [];

function filmAvailable(state: FlowState, operation: FlowOperation, scopeKey: string, printId: string): number {
  const print = scopeOf(state, scopeKey).prints.find((item) => item.id === printId)!;
  const producers = relevantPredecessors(state, operation, scopeKey).filter((item) => item.kind === "film");
  return sum(state.films.filter((film) => film.scopeKey === scopeKey && film.printId === printId && film.artworkVersion === print.artworkVersion && producers.some((producer) => producer.id === film.operationId)), (film) => film.availableQty);
}

function readyQuantity(state: FlowState, operation: FlowOperation, lot: GarmentLot): number {
  if (lot.condition !== "available" || lot.custody.kind !== "factory" || lot.needsReinspection || operation.issue || (operation.machineDown && !operation.outsourced)) return 0;
  const predecessors = relevantPredecessors(state, operation, lot.scopeKey);
  if (predecessors.some((predecessor) => predecessor.kind !== "film" && !lot.completedOperationIds.includes(predecessor.id))) return 0;
  const supplies = filmPrints(state, operation, lot.scopeKey).map((print) => filmAvailable(state, operation, lot.scopeKey, print.id));
  return Math.min(lot.qty, ...supplies);
}

function doneQuantity(state: FlowState, operation: FlowOperation, scopeKey?: string): number {
  if (operation.kind === "film") {
    const scopes = state.orders.flatMap((order) => order.scopes).filter((scope) => operation.scopeKeys.includes(scope.key) && (!scopeKey || scope.key === scopeKey));
    return sum(scopes, (scope) => {
      const prints = filmPrints(state, operation, scope.key);
      return prints.length ? Math.min(scope.orderedQty, ...prints.map((print) => sum(state.films.filter((film) => film.operationId === operation.id && film.scopeKey === scope.key && film.printId === print.id && film.artworkVersion === print.artworkVersion), (film) => film.producedQty))) : 0;
    });
  }
  return sum(lotsFor(state, operation).filter((lot) => (!scopeKey || lot.scopeKey === scopeKey) && lot.completedOperationIds.includes(operation.id)), (lot) => lot.qty);
}

function operationComplete(state: FlowState, operation: FlowOperation): boolean {
  return operation.scopeKeys.every((key) => doneQuantity(state, operation, key) >= quantityFor(state, operation, key));
}

function reworkTargets(state: FlowState, lot: GarmentLot): FlowOperation[] {
  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    const operation = operationOf(state, id);
    if (!operation?.scopeKeys.includes(lot.scopeKey)) return;
    ids.add(id);
    operation.predecessorIds.forEach(visit);
  };
  visit(lot.reworkOfOperationId ?? lot.currentOperationId);
  return state.operations.filter((operation) => ids.has(operation.id) && ["press", "vendor", "manual"].includes(operation.kind)).sort((a, b) => b.sequence - a.sequence);
}

function permission(role: FlowRole, actor: FlowActor, operation: FlowOperation, supervisorOnly = false): string | undefined {
  if (role === "viewer") return "สิทธิ์ดูอย่างเดียว";
  if (supervisorOnly && role !== "supervisor") return "หัวหน้าต้องเป็นผู้ตัดสินใจครั้งนี้";
  if (role === "worker" && operation.assignedTo?.id !== actor.id) return operation.assignedTo ? `งานนี้มอบหมายให้ ${operation.assignedTo.name}` : "รอหัวหน้ามอบหมายงาน";
  return undefined;
}

function action(state: FlowState, role: FlowRole, actor: FlowActor, operation: FlowOperation, config: Omit<FlowAction, "enabled"> & { blocked?: string }): FlowAction {
  const reason = permission(role, actor, operation, config.supervisorOnly) ?? config.blocked;
  const { blocked: _blocked, ...rest } = config;
  void _blocked;
  return { ...rest, operationId: operation.id, enabled: !reason, ...(reason ? { disabledReason: reason } : {}) };
}

function needsPartialApproval(state: FlowState, source: FlowOperation, lot: GarmentLot, qty: number): boolean {
  const available = sum(lotsFor(state, source).filter((item) => item.currentOperationId === source.id && item.completedOperationIds.includes(source.id) && item.condition === "available"), (item) => item.qty);
  return !operationComplete(state, source) || qty < lot.qty || qty < available;
}

function actionList(state: FlowState, role: FlowRole, actor: FlowActor): FlowAction[] {
  const actions: FlowAction[] = [];
  for (const operation of state.operations) {
    const order = state.orders.find((item) => item.id === operation.orderId)!;
    if (order.unknown) continue;
    const add = (config: Omit<FlowAction, "enabled"> & { blocked?: string }) => actions.push(action(state, role, actor, operation, config));
    if (order.released === false) {
      if (state.operations.find((item) => item.orderId === order.id)?.id === operation.id) add({ id: `release|${operation.id}`, kind: "release", label: "เปิดใบและปล่อยแผนผลิต", description: state.operations.filter((item) => item.orderId === order.id).map((item) => item.name).join(" → "), supervisorOnly: true, primary: true, fields: [{ key: "route", label: "ตรวจเส้นทางและสินค้าในแต่ละขั้น", type: "select", required: true, defaultValue: "", options: [{ value: "", label: "ตรวจแผนด้านล่างก่อน" }, { value: "confirmed", label: "รายการ สี ไซซ์ ลาย และลำดับงานถูกต้อง" }] }, noteField] });
      continue;
    }
    add({ id: `assign|${operation.id}`, kind: "assign", label: "มอบหมายงาน", description: "เลือกผู้รับผิดชอบขั้นนี้", supervisorOnly: true, primary: !operation.assignedTo && !operationComplete(state, operation), fields: [{ key: "assignee", label: "ผู้รับผิดชอบ", type: "select", required: true, defaultValue: operation.assignedTo?.id ?? "worker-1", options: [{ value: "worker-1", label: "ช่างหนึ่ง" }, { value: "worker-2", label: "ช่างสอง" }] }] });
    if (operation.issue) add({ id: `resolve|${operation.id}`, kind: "resolve", label: "แก้ปัญหาแล้ว", description: operation.issue, supervisorOnly: true, primary: true, fields: [requiredNote] });
    else if (!operationComplete(state, operation)) add({ id: `issue|${operation.id}`, kind: "issue", label: "แจ้งปัญหา", description: "แจ้งสิ่งที่ทำให้งานขั้นนี้ไปต่อไม่ได้", fields: [requiredNote] });
    if (operation.machineDown && !operation.outsourced && ["press", "manual"].includes(operation.kind)) add({ id: `outsource|${operation.id}`, kind: "outsource", label: "เปลี่ยนไปส่งร้านนอก", description: "เปลี่ยนผู้ทำขั้นนี้ โดยคงกองเสื้อ เส้นทาง และจุดตรวจรับ", supervisorOnly: true, primary: true, fields: [{ key: "vendor", label: "ร้านที่รับงาน", type: "text", required: true, defaultValue: "ร้าน DTF สำรอง" }, requiredNote] });
    if (operation.kind === "prepare") {
      for (const scopeKey of operation.scopeKeys) {
        const scope = scopeOf(state, scopeKey);
        const original = sum(state.lots.filter((lot) => lot.scopeKey === scopeKey && lot.source === "original"), (lot) => lot.qty);
        const waste = sum(state.lots.filter((lot) => lot.scopeKey === scopeKey && lot.condition === "waste"), (lot) => lot.qty);
        const replacements = sum(state.lots.filter((lot) => lot.scopeKey === scopeKey && lot.source === "replacement"), (lot) => lot.qty);
        const missing = Math.max(0, scope.orderedQty - original);
        if (missing) add({ id: `acquire|${operation.id}|${scopeKey}`, kind: "acquire", label: scope.source === "customer" ? "รับเสื้อลูกค้า" : "รับเสื้อพร้อมผลิต", description: `${scope.product} ${scope.color} ${scope.size} · ยังขาด ${missing} ตัว`, scopeKey, fields: [numberField("qty", "จำนวนที่รับจริง", missing, missing), noteField], primary: true, blocked: operation.issue });
        if (waste > replacements) add({ id: `replace|${operation.id}|${scopeKey}`, kind: "replace", label: "รับเสื้อทดแทนของเสีย", description: `${scope.size} · เสีย ${waste} ตัว รับทดแทนแล้ว ${replacements} ตัว`, scopeKey, supervisorOnly: true, fields: [numberField("qty", "จำนวนเสื้อทดแทน", waste - replacements, waste - replacements), requiredNote] });
      }
    }
    if (operation.kind === "film") {
      for (const scopeKey of operation.scopeKeys) {
        const scope = scopeOf(state, scopeKey);
        for (const print of filmPrints(state, operation, scopeKey)) {
          const targets = state.operations.filter((target) => target.predecessorIds.includes(operation.id) && target.scopeKeys.includes(scopeKey) && target.printIds.includes(print.id));
          const needed = sum(targets, (target) => Math.max(0, quantityFor(state, target, scopeKey) - doneQuantity(state, target, scopeKey) - sum(lotsFor(state, target).filter((lot) => lot.scopeKey === scopeKey && lot.currentOperationId === target.id && ["vendor", "inspection", "rework"].includes(lot.condition)), (lot) => lot.qty)));
          const available = sum(state.films.filter((film) => film.operationId === operation.id && film.scopeKey === scopeKey && film.printId === print.id && film.artworkVersion === print.artworkVersion), (film) => film.availableQty);
          const shortage = Math.max(0, needed - available);
          add({ id: `film|${operation.id}|${scopeKey}|${print.id}`, kind: "film", label: shortage ? `เตรียมฟิล์ม ${scope.size} อีก ${shortage} ชิ้น` : "บันทึกฟิล์มเพิ่ม", description: `${scope.product} ${scope.color} ${scope.size} · ${print.label} · แบบ ${print.artworkVersion}`, scopeKey, primary: shortage > 0, fields: [numberField("good", "ฟิล์มดี", scope.orderedQty * 3, shortage), numberField("waste", "ฟิล์มเสีย", scope.orderedQty * 3), noteField], blocked: operation.issue ?? (operation.machineDown ? "เครื่องพิมพ์ไม่พร้อม" : undefined) });
        }
      }
    }
    if (operationComplete(state, operation)) {
      const candidates = state.lots.filter((lot) => lot.currentOperationId === operation.id && lot.condition === "available" && !lot.needsReinspection && lot.custody.kind === "factory" && lot.completedOperationIds.includes(operation.id));
      for (const target of state.operations.filter((item) => item.predecessorIds.includes(operation.id) && item.kind !== "film")) {
        const moving = candidates.filter((lot) => target.scopeKeys.includes(lot.scopeKey));
        if (moving.length < 2) continue;
        const allReady = moving.every((lot) => readyQuantity(state, target, lot) >= lot.qty) && target.scopeKeys.every((key) => {
          const qty = sum(moving.filter((lot) => lot.scopeKey === key), (lot) => lot.qty);
          return filmPrints(state, target, key).every((print) => filmAvailable(state, target, key, print.id) >= qty);
        });
        add({ id: `transfer-all|${operation.id}|${target.id}`, kind: "transfer-all", label: `ส่งต่อ${target.name}ครบทุกกอง`, description: "ส่งทุกสีและไซซ์ที่ผ่านขั้นนี้พร้อมกัน หากต้องแบ่งส่งให้เลือกกองและให้หัวหน้าตัดสินใจ", fields: [noteField], primary: true, blocked: allReady ? undefined : "ยังมีสี ไซซ์ หรือจุดพิมพ์ที่ไม่พร้อมครบทุกกอง" });
      }
    }
  }
  for (const lot of state.lots) {
    const operation = operationOf(state, lot.currentOperationId);
    if (!operation || state.orders.find((order) => order.id === lot.orderId)?.unknown || state.orders.find((order) => order.id === lot.orderId)?.released === false) continue;
    const add = (config: Omit<FlowAction, "enabled"> & { blocked?: string }) => actions.push(action(state, role, actor, operation, { ...config, lotId: lot.id, scopeKey: lot.scopeKey }));
    const description = "บันทึกเฉพาะเสื้อกองที่เลือก ตามจำนวนที่เกิดขึ้นจริง";
    if (lot.condition === "vendor") {
      add({ id: `receive|${lot.id}`, kind: "receive", label: "รับกลับจากร้าน", description: "ลงจำนวนกลับจริง ส่วนที่ยังไม่กลับคงยอดไว้กับร้าน ต้องตรวจรับก่อนใช้ต่อ", fields: [numberField("qty", "จำนวนกลับจริง", lot.qty, lot.qty), noteField], primary: true });
      continue;
    }
    if (lot.condition === "inspection") {
      add({ id: `inspect|${lot.id}`, kind: "inspect", label: "ตรวจรับของกลับ", description: "แยกของดี งานแก้ และของเสียจากจำนวนที่รับกลับ ส่วนดีจึงส่งต่อได้", fields: [numberField("good", "ผ่าน", lot.qty, lot.qty), numberField("rework", "ส่งแก้", lot.qty), numberField("waste", "คัดทิ้ง", lot.qty), defectField, noteField], primary: true });
      continue;
    }
    if (lot.condition === "rework") {
      const targets = reworkTargets(state, lot);
      if (!lot.reworkPlanned && targets.length) add({ id: `plan-rework|${lot.id}`, kind: "plan-rework", label: "ส่งกองเสียไปแก้", description: `${description} · เลือกจุดแก้เฉพาะกองนี้`, supervisorOnly: true, fields: [{ key: "target", label: "จุดที่แก้งาน", type: "select", required: true, defaultValue: targets[0].id, options: targets.map((item) => ({ value: item.id, label: item.name })) }, requiredNote], primary: true });
      if ((lot.reworkPlanned || !targets.length) && operation.kind !== "vendor" && !operation.outsourced) add({ id: `repair|${lot.id}`, kind: "repair", label: "บันทึกงานแก้เสร็จ", description: "บันทึกเฉพาะกองที่แก้แล้ว ต้องส่งตรวจซ้ำก่อนนับผ่าน", fields: [numberField("qty", "แก้เสร็จแล้ว", lot.qty, lot.qty), requiredNote], primary: true });
      if (operation.kind === "vendor" || operation.outsourced) add({ id: `resend|${lot.id}`, kind: "resend", label: "ส่งกลับร้านเพื่อแก้", description: `${description} → ${operation.vendor ?? lot.returnedFromVendor ?? "ร้านเดิม"}`, supervisorOnly: true, fields: [numberField("qty", "จำนวนส่งแก้ครั้งนี้", lot.qty, lot.qty), requiredNote], primary: true });
      continue;
    }
    if (lot.needsReinspection) {
      add({ id: `reinspect|${lot.id}`, kind: "reinspect", label: "ตรวจซ้ำงานแก้", description, fields: [numberField("good", "ผ่าน", lot.qty, lot.qty), numberField("rework", "ยังต้องแก้", lot.qty), numberField("waste", "คัดทิ้ง", lot.qty), defectField, noteField], primary: true });
      continue;
    }
    if (lot.condition !== "available" || lot.custody.kind !== "factory") continue;
    if (lot.completedOperationIds.includes(operation.id)) {
      const successors = state.operations.filter((target) => target.predecessorIds.includes(operation.id) && target.scopeKeys.includes(lot.scopeKey) && target.kind !== "film");
      for (const target of successors) {
        const ready = readyQuantity(state, target, lot);
        const waiting = relevantPredecessors(state, target, lot.scopeKey).filter((predecessor) => predecessor.kind !== "film" && !lot.completedOperationIds.includes(predecessor.id)).map((item) => item.name);
        const partial = needsPartialApproval(state, operation, lot, lot.qty);
        const blocked = ready === 0 ? (target.issue || (target.machineDown && !target.outsourced ? "เครื่องไม่พร้อม ต้องแก้ปัญหาหรือส่งร้านนอก" : waiting.length ? `รอ ${waiting.join(" + ")}` : "ฟิล์มของสี/ไซซ์/จุดพิมพ์นี้ยังไม่พร้อม")) : undefined;
        add({ id: `transfer|${lot.id}|${target.id}`, kind: "transfer", label: `ส่งต่อ${target.name}`, description: partial ? "หัวหน้าเลือกส่งเฉพาะส่วนที่พร้อมในครั้งนี้ ส่วนที่เหลือยังอยู่ขั้นเดิม" : "ส่งกองนี้ไปขั้นถัดไปตามจำนวนจริง หากแบ่งส่งต้องให้หัวหน้าเลือกครั้งนี้", fields: [numberField("qty", "ส่งต่อครั้งนี้", ready, ready), noteField], primary: true, supervisorOnly: partial, blocked });
      }
      continue;
    }
    const ready = readyQuantity(state, operation, lot);
    const blocked = ready === 0 ? operation.issue || (operation.machineDown && !operation.outsourced ? "เครื่องไม่พร้อม" : "กองนี้ยังมีขั้นหรือฟิล์มที่ต้องรอ") : undefined;
    if (operation.kind === "vendor" || operation.outsourced) {
      add({ id: `send|${lot.id}`, kind: "send", label: "ส่งกองนี้ให้ร้าน", description: `ส่งให้${operation.vendor ?? "ร้านนอก"} เฉพาะจำนวนที่เลือก เสื้อส่วนนี้จะไม่พร้อมใช้งานที่โรงงานจนรับกลับ`, fields: [numberField("qty", "จำนวนส่งจริง", ready, ready), noteField], primary: true, blocked });
    } else if (operation.kind === "pack") {
      add({ id: `pack|${lot.id}`, kind: "pack", label: "บันทึกแพ็กแล้ว", description, fields: [numberField("qty", "จำนวนแพ็กจริง", ready, ready), noteField], primary: true, blocked });
    } else if (operation.kind !== "prepare" && operation.kind !== "film") {
      add({ id: `finish|${lot.id}`, kind: "finish", label: operation.kind === "qc" ? "บันทึกผล QC" : "บันทึกผล / จบช่วง", description: "จดผลที่เกิดขึ้นจริงเฉพาะกองนี้ ของดีจึงพร้อมส่งต่อโดยไม่รวมงานแก้หรือของเสีย", fields: [numberField("good", "ดี / ผ่าน", ready), numberField("rework", "รอแก้", ready), numberField("waste", "เสีย / คัดทิ้ง", ready), defectField, ...(operation.standards.length ? [{ key: "checked", label: "ตรวจข้อกำหนดสำคัญแล้ว", type: "select" as const, required: true, defaultValue: "", options: [{ value: "", label: "เลือกผลตรวจ" }, { value: "yes", label: "ตรวจครบตามใบงานแล้ว" }], hint: operation.standards.map((item) => item.label).join(" · ") }] : []), noteField], primary: true, blocked });
    }
  }
  const priority: Record<string, number> = { release: 0, outsource: 1, resolve: 2, "plan-rework": 3, resend: 4, reinspect: 5, inspect: 6, repair: 7, assign: 8, transfer: 9, "transfer-all": 9, receive: 10, finish: 11, pack: 11, send: 11, acquire: 12, replace: 12, film: 13 };
  return actions.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)) || (priority[a.kind] ?? 20) - (priority[b.kind] ?? 20));
}

function lotView(state: FlowState, lot: GarmentLot, actions: FlowAction[]): LotView {
  const scope = scopeOf(state, lot.scopeKey);
  const labels = { available: lot.needsReinspection ? "รอตรวจซ้ำ" : "อยู่โรงงาน", vendor: "อยู่ร้านนอก", inspection: "กลับแล้ว รอตรวจ", rework: "รอแก้", waste: "คัดทิ้ง", packed: "แพ็กแล้ว" };
  return { id: lot.id, parentLotId: lot.parentLotId, scopeKey: lot.scopeKey, label: lotName(state, lot), qty: lot.qty, product: scope.product, color: scope.color, size: scope.size, location: lot.custody.kind === "factory" ? operationOf(state, lot.currentOperationId)?.station ?? "โรงงาน" : lot.custody.name, condition: lot.condition, conditionLabel: labels[lot.condition], operationId: lot.currentOperationId, completedOperations: lot.completedOperationIds.map((id) => operationOf(state, id)?.name ?? id), source: lot.source, actions: actions.filter((item) => item.lotId === lot.id), defectReason: lot.defectReason };
}

function operationView(state: FlowState, operation: FlowOperation, actions: FlowAction[], truthActions = actions): OperationView {
  const allLots = lotsFor(state, operation);
  const here = allLots.filter((lot) => lot.currentOperationId === operation.id);
  const lines: QuantityLineView[] = operation.scopeKeys.map((scopeKey) => {
    const scope = scopeOf(state, scopeKey);
    const scoped = here.filter((lot) => lot.scopeKey === scopeKey);
    const garmentReady = sum(scoped.filter((lot) => !lot.completedOperationIds.includes(operation.id)), (lot) => readyQuantity(state, operation, lot));
    const ready = Math.min(garmentReady, ...filmPrints(state, operation, scopeKey).map((print) => filmAvailable(state, operation, scopeKey, print.id)));
    const good = doneQuantity(state, operation, scopeKey);
    return { scopeKey, product: scope.product, color: scope.color, size: scope.size, printLabel: scope.prints.filter((print) => operation.printIds.includes(print.id)).map((print) => `${print.label} · แบบ ${print.artworkVersion}`).join(" + "), planned: scope.orderedQty, ready, good, rework: sum(allLots.filter((lot) => lot.scopeKey === scopeKey && (lot.currentOperationId === operation.id || lot.reworkOfOperationId === operation.id) && (lot.condition === "rework" || lot.needsReinspection)), (lot) => lot.qty), waste: sum(allLots.filter((lot) => lot.scopeKey === scopeKey && lot.condition === "waste" && lot.resultOperationId === operation.id), (lot) => lot.qty), waiting: Math.max(0, scope.orderedQty - good - ready), atVendor: sum(scoped.filter((lot) => lot.condition === "vendor"), (lot) => lot.qty), awaitingInspection: sum(scoped.filter((lot) => lot.condition === "inspection"), (lot) => lot.qty) };
  });
  const ownActions = actions.filter((item) => item.operationId === operation.id);
  const blockers: string[] = [];
  if (operation.issue) blockers.push(operation.issue);
  if (operation.machineDown && !operation.outsourced) blockers.push("เครื่องไม่พร้อม");
  const waitingOn: string[] = [];
  for (const scopeKey of operation.scopeKeys) {
    const scope = scopeOf(state, scopeKey);
    const remaining = Math.max(0, scope.orderedQty - doneQuantity(state, operation, scopeKey));
    if (!remaining) continue;
    for (const predecessor of relevantPredecessors(state, operation, scopeKey).filter((item) => item.kind !== "film")) {
      const missing = Math.max(0, scope.orderedQty - doneQuantity(state, predecessor, scopeKey));
      if (missing) waitingOn.push(`รอ${predecessor.name} ${scope.color} ${scope.size} ${missing} ตัว`);
    }
    for (const print of filmPrints(state, operation, scopeKey)) {
      if (operation.kind === "film") continue;
      const missing = Math.max(0, remaining - filmAvailable(state, operation, scopeKey, print.id));
      if (missing) waitingOn.push(`รอฟิล์ม${print.label} ${scope.color} ${scope.size} ${missing} ชิ้น · แบบ ${print.artworkVersion}`);
    }
  }
  const qtyReady = sum(lines, (line) => line.ready);
  const qtyGood = sum(lines, (line) => line.good);
  const qtyRework = sum(lines, (line) => line.rework);
  const qtyAtVendor = sum(lines, (line) => line.atVendor);
  const qtyAwaitingInspection = sum(lines, (line) => line.awaitingInspection);
  const complete = operationComplete(state, operation);
  const primary = truthActions.some((item) => item.operationId === operation.id && item.enabled && item.primary);
  const stateValue: OperationView["state"] = blockers.length || qtyRework ? "problem" : complete ? "done" : qtyAwaitingInspection ? "inspection" : qtyAtVendor ? "vendor" : qtyReady || primary ? "ready" : qtyGood ? "working" : "waiting";
  const labels = { ready: "ทำต่อได้", waiting: "รอขั้นก่อนหน้า", working: "ทำแล้วบางส่วน", vendor: "อยู่ร้านนอก", inspection: "รอตรวจรับ", done: "ครบแล้ว", problem: "ต้องจัดการ" };
  return { id: operation.id, workOrderId: operation.workOrderId, name: operation.name, kind: operation.kind, station: operation.outsourced ? operation.vendor ?? "ร้านนอก" : operation.station, state: stateValue, statusLabel: labels[stateValue], summary: qtyAtVendor ? `อยู่ร้าน ${qtyAtVendor} · กลับรอตรวจ ${qtyAwaitingInspection}` : `${qtyGood}/${quantityFor(state, operation)} ตัวผ่านขั้นนี้`, sequence: operation.sequence, assignedTo: operation.assignedTo, predecessorIds: operation.predecessorIds, waitingOn, blockers, issue: operation.issue, qtyPlanned: quantityFor(state, operation), qtyReady, qtyGood, qtyWaste: sum(lines, (line) => line.waste), qtyRework, qtyAtVendor, qtyAwaitingInspection, lines, lots: here.map((lot) => lotView(state, lot, actions)), actions: ownActions, standards: operation.standards };
}

export function selectOrder(state: FlowState, id: string, role: FlowRole, actor: FlowActor = DEFAULT_ACTORS[role]): OrderView | undefined {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return undefined;
  const actions = actionList(state, role, actor).filter((item) => operationOf(state, item.operationId!)?.orderId === id);
  const truthActions = role === "supervisor" ? actions : actionList(state, "supervisor", DEFAULT_ACTORS.supervisor).filter((item) => operationOf(state, item.operationId!)?.orderId === id);
  const operations = state.operations.filter((operation) => operation.orderId === id).sort((a, b) => a.sequence - b.sequence).map((operation) => operationView(state, operation, actions, truthActions));
  const lots = state.lots.filter((lot) => lot.orderId === id);
  const ordered = sum(order.scopes, (scope) => scope.orderedQty);
  const packed = sum(lots.filter((lot) => lot.condition === "packed"), (lot) => lot.qty);
  const waste = sum(lots.filter((lot) => lot.condition === "waste"), (lot) => lot.qty);
  const rework = sum(lots.filter((lot) => lot.condition === "rework" || lot.needsReinspection), (lot) => lot.qty);
  const good = sum(lots.filter((lot) => lot.condition !== "waste" && lot.condition !== "rework" && !lot.needsReinspection && state.operations.some((operation) => operation.orderId === id && operation.kind === "qc" && lot.completedOperationIds.includes(operation.id))), (lot) => lot.qty);
  const missing = order.unknown ? 0 : sum(order.scopes, (scope) => Math.max(0, scope.orderedQty - sum(lots.filter((lot) => lot.scopeKey === scope.key && lot.condition !== "waste"), (lot) => lot.qty)));
  const atVendor = sum(lots.filter((lot) => lot.condition === "vendor"), (lot) => lot.qty);
  const awaitingInspection = sum(lots.filter((lot) => lot.condition === "inspection"), (lot) => lot.qty);
  const blockers = [...operations.flatMap((operation) => operation.blockers), ...(rework ? [`รอแก้หรือตรวจซ้ำ ${rework} ตัว`] : []), ...(missing ? [`เสื้อยังขาด ${missing} ตัว`] : [])];
  const actionable = truthActions.find((item) => item.enabled && item.primary);
  const allPacked = order.scopes.every((scope) => sum(lots.filter((lot) => lot.scopeKey === scope.key && lot.condition === "packed"), (lot) => lot.qty) >= scope.orderedQty);
  const status: OrderView["status"] = order.unknown ? "unknown" : allPacked ? "packed" : rework || operations.some((operation) => operation.issue) || operations.some((operation) => operation.blockers.includes("เครื่องไม่พร้อม")) ? "problem" : actionable ? "ready" : atVendor || missing ? "waiting" : "working";
  const labels = { unknown: "ข้อมูลยังไม่ครบ", packed: "พร้อมส่ง", problem: "ต้องจัดการ", ready: "มีงานทำต่อได้", waiting: "กำลังรอ", working: "อยู่ระหว่างผลิต" };
  const pendingHandoff = sum(lots.filter((lot) => lot.condition === "available" && !lot.needsReinspection && lot.completedOperationIds.includes(lot.currentOperationId) && operationOf(state, lot.currentOperationId)?.kind !== "prepare"), (lot) => lot.qty);
  const readyOperation = operations.find((operation) => operation.qtyReady > 0 && !["prepare", "film"].includes(operation.kind));
  const currentIssue = operations.find((operation) => operation.issue)?.issue;
  const summary = order.unknown ? "ยังไม่มีหลักฐานกองเสื้อและจำนวนที่ยืนยันได้" : order.released === false ? "แผนพร้อมตรวจ ยังไม่ได้ปล่อยงานให้ทีม" : allPacked ? `แพ็กครบ ${ordered} ตัว ทุกใบผลิตพร้อมส่ง` : currentIssue ? currentIssue : atVendor ? `เสื้อยังอยู่ร้าน ${atVendor} ตัว${awaitingInspection ? ` กลับรอตรวจแล้ว ${awaitingInspection} ตัว` : ""}` : rework ? `มีงานแก้ ${rework} ตัว ต้องตรวจซ้ำก่อนนับผ่าน` : pendingHandoff ? `ผ่านขั้นแล้ว ${pendingHandoff} ตัว รอเลือกส่งต่อ` : readyOperation ? `${readyOperation.name}ได้ ${readyOperation.qtyReady} จาก ${readyOperation.qtyPlanned} ตัว` : packed ? `แพ็กแล้ว ${packed} ตัว ยังรอใบผลิตส่วนที่เหลือ` : missing ? `รอรับเสื้อเพิ่ม ${missing} ตัว` : "รอผลและการส่งต่อจากขั้นก่อนหน้า";
  return { id, number: order.number, customer: order.customer, dueAt: order.dueAt, owner: order.owner, status, statusLabel: labels[status], summary, nextAction: order.unknown ? "ตรวจใบเดิมก่อนเริ่มบันทึก" : allPacked ? "ส่งมอบให้ฝ่ายจัดส่ง" : actionable?.label ?? (role === "viewer" ? "ดูความคืบหน้าและหลักฐานล่าสุด" : blockers[0] ?? "รอผลหรือส่งต่องานจากผู้รับผิดชอบ"), blockers: order.unknown ? ["ข้อมูลเก่า: ไม่ทราบจำนวนและสถานที่จริง"] : blockers, totalQty: ordered, goodQty: good, packedQty: packed, reworkQty: rework, wasteQty: waste, missingQty: missing, metrics: { ordered, received: sum(lots, (lot) => lot.qty), ready: sum(operations, (operation) => operation.qtyReady), good, packed, rework, waste, atVendor, awaitingInspection, missing }, operations, lots: lots.map((lot) => lotView(state, lot, actions)), history: state.history.filter((item) => item.orderId === id).slice().reverse(), actions, workOrders: order.workOrders, unknown: Boolean(order.unknown) };
}

export function selectOrders(state: FlowState, role: FlowRole, actor: FlowActor = DEFAULT_ACTORS[role]): OrderView[] {
  return state.orders.map((order) => selectOrder(state, order.id, role, actor)!);
}

function int(values: FlowCommand["values"], key: string): number {
  const value = values?.[key];
  if (value === "" || value === undefined || typeof value === "boolean") throw new Error(`ระบุจำนวน ${key}`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ศูนย์ขึ้นไป");
  return result;
}
function positive(values: FlowCommand["values"], key = "qty") { const value = int(values, key); if (!value) throw new Error("จำนวนต้องมากกว่าศูนย์"); return value; }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }

function take(state: FlowState, source: GarmentLot, qty: number, suffix: string): GarmentLot {
  if (qty <= 0 || qty > source.qty) throw new Error("จำนวนเกินกองเสื้อที่มีอยู่จริง");
  if (qty === source.qty) return source;
  source.qty -= qty;
  const child: GarmentLot = { ...source, id: `${source.id}-${suffix}-${state.revision + 1}-${state.lots.length}`, qty, parentLotId: source.id, completedOperationIds: [...source.completedOperationIds], custody: { ...source.custody } };
  state.lots.push(child);
  return child;
}

function consumeFilm(state: FlowState, operation: FlowOperation, lot: GarmentLot, qty: number) {
  for (const print of filmPrints(state, operation, lot.scopeKey)) {
    if (filmAvailable(state, operation, lot.scopeKey, print.id) < qty) throw new Error(`ฟิล์ม ${print.label} ของไซซ์นี้ไม่ครบ`);
    let remaining = qty;
    const producerIds = relevantPredecessors(state, operation, lot.scopeKey).filter((item) => item.kind === "film").map((item) => item.id);
    for (const supply of state.films.filter((film) => film.scopeKey === lot.scopeKey && film.printId === print.id && film.artworkVersion === print.artworkVersion && producerIds.includes(film.operationId))) {
      const used = Math.min(remaining, supply.availableQty); supply.availableQty -= used; remaining -= used;
    }
  }
}

function output(state: FlowState, lot: GarmentLot, operation: FlowOperation, values: FlowCommand["values"], mode: "finish" | "inspect" | "reinspect") {
  const good = int(values, "good"), rework = int(values, "rework"), waste = int(values, "waste");
  const total = good + rework + waste;
  const defectReason = String(values?.defectReason ?? "").trim();
  if ((rework > 0 || waste > 0) && !defectReason) throw new Error("ระบุจุดที่เสียหรือสาเหตุ ก่อนแยกงานแก้หรือคัดทิ้ง");
  if (!total || total > lot.qty) throw new Error("ผลดี + รอแก้ + เสีย ต้องไม่เกินจำนวนในกอง");
  if (mode === "finish" && total > readyQuantity(state, operation, lot)) throw new Error("เสื้อหรือฟิล์มตามสี/ไซซ์/จุดพิมพ์ยังไม่พร้อมตามจำนวนนี้");
  if (mode === "finish" && operation.standards.length && values?.checked !== "yes") throw new Error("ตรวจข้อกำหนดสำคัญก่อนบันทึกผล");
  if (mode === "finish") consumeFilm(state, operation, lot, total);
  const counts = [{ qty: waste, condition: "waste" as const }, { qty: rework, condition: "rework" as const }, { qty: good, condition: "available" as const }].filter((item) => item.qty > 0);
  for (const entry of counts) {
    const part = take(state, lot, entry.qty, entry.condition);
    part.condition = entry.condition;
    part.custody = { kind: "factory", name: operation.station };
    part.needsReinspection = false;
    if (entry.condition === "available") {
      part.completedOperationIds = [...new Set([...part.completedOperationIds, operation.id])];
      delete part.reworkOfOperationId;
      delete part.resultOperationId;
    } else {
      part.completedOperationIds = part.completedOperationIds.filter((id) => id !== operation.id);
      part.resultOperationId = operation.id;
      part.defectReason = defectReason;
      if (entry.condition === "rework") { part.reworkOfOperationId = operation.id; part.reworkPlanned = false; }
    }
  }
  return `ผ่าน ${good} · รอแก้ ${rework} · เสีย ${waste} ตัว${defectReason ? `\nจุดที่เสีย: ${defectReason}` : ""}`;
}

/** Pure simulation boundary: all commands re-derive permissions and physical availability. */
export function applyCommand(original: FlowState, command: FlowCommand): CommandResult {
  try {
    if (!command.commandId.trim()) throw new Error("ต้องมีรหัสคำสั่ง");
    const fingerprint = stable({ role: command.role, actor: command.actor, actionId: command.actionId, values: command.values ?? {} });
    const prior = original.processedCommands[command.commandId];
    if (prior) {
      if (prior !== fingerprint) throw new Error("รหัสคำสั่งนี้เคยใช้กับข้อมูลอื่นแล้ว");
      return { state: original, duplicate: true };
    }
    if (command.expectedRevision !== original.revision) throw new Error("ข้อมูลเปลี่ยนจากอีกการทำรายการแล้ว โหลดข้อมูลล่าสุดก่อน");
    const selected = actionList(original, command.role, command.actor).find((item) => item.id === command.actionId);
    if (!selected) throw new Error("คำสั่งนี้ใช้กับสถานะปัจจุบันไม่ได้");
    if (!selected.enabled) throw new Error(selected.disabledReason ?? "ทำรายการนี้ไม่ได้");
    for (const field of selected.fields) {
      const value = command.values?.[field.key];
      if (field.required && (value === undefined || String(value).trim() === "")) throw new Error(`กรอก ${field.label}`);
      if (field.type === "number") {
        const qty = int(command.values, field.key);
        if (field.max !== undefined && qty > field.max) throw new Error(`${field.label} เกินจำนวนที่พร้อมจริง`);
      }
      if (field.type === "select" && value !== undefined && !field.options?.some((option) => option.value === String(value))) throw new Error(`เลือก ${field.label} จากรายการ`);
    }
    const state = structuredClone(original);
    const [kind, first, second, third] = command.actionId.split("|");
    let operation = operationOf(state, selected.operationId!);
    let detail = String(command.values?.note ?? "");
    const lot = selected.lotId ? state.lots.find((item) => item.id === selected.lotId)! : undefined;
    if (kind === "release") {
      if (command.values?.route !== "confirmed") throw new Error("ตรวจรายการและเส้นทางก่อนเปิดใบ");
      state.orders.find((order) => order.id === operation.orderId)!.released = true;
      detail = "หัวหน้าตรวจสูตร สินค้า สี ไซซ์ และจุดพิมพ์ ก่อนปล่อยงาน";
    }
    else if (kind === "assign") operation.assignedTo = { id: String(command.values?.assignee), name: command.values?.assignee === "worker-2" ? "ช่างสอง" : "ช่างหนึ่ง" };
    else if (kind === "issue") operation.issue = detail;
    else if (kind === "resolve") { delete operation.issue; operation.machineDown = false; }
    else if (kind === "outsource") { operation.outsourced = true; operation.vendor = String(command.values?.vendor).trim(); delete operation.issue; }
    else if (kind === "acquire" || kind === "replace") {
      const qty = positive(command.values);
      const id = `lot-${second}-${state.revision + 1}-${state.lots.length}`;
      state.lots.push({ id, rootLotId: id, orderId: operation.orderId, scopeKey: second, qty, source: kind === "replace" ? "replacement" : "original", custody: { kind: "factory", name: operation.station }, condition: "available", currentOperationId: operation.id, completedOperationIds: [operation.id] });
      detail = `${qty} ตัว · ${scopeOf(state, second).size}${detail ? ` · ${detail}` : ""}`;
    } else if (kind === "film") {
      const good = int(command.values, "good"), waste = int(command.values, "waste");
      if (!good && !waste) throw new Error("ต้องมีผลฟิล์มอย่างน้อยหนึ่งชิ้น");
      const print = scopeOf(state, second).prints.find((item) => item.id === third)!;
      state.films.push({ id: `film-${state.revision + 1}-${state.films.length}`, orderId: operation.orderId, operationId: first, scopeKey: second, printId: third, artworkVersion: print.artworkVersion, producedQty: good, availableQty: good, wasteQty: waste });
      detail = `${scopeOf(state, second).size} ${print.label} · ดี ${good} / เสีย ${waste} ชิ้น`;
    } else if (kind === "transfer-all") {
      const target = operationOf(state, second);
      if (!operationComplete(state, operation)) throw new Error("ขั้นนี้ยังไม่ครบ ต้องให้หัวหน้าเลือกส่งบางส่วน");
      const moving = state.lots.filter((item) => item.currentOperationId === operation.id && target.scopeKeys.includes(item.scopeKey) && item.condition === "available" && !item.needsReinspection && item.custody.kind === "factory" && item.completedOperationIds.includes(operation.id));
      if (!moving.length || moving.some((item) => readyQuantity(state, target, item) < item.qty)) throw new Error("ยังไม่พร้อมครบทุกกอง");
      for (const item of moving) { item.currentOperationId = target.id; item.custody = { kind: "factory", name: target.station }; }
      detail = `ส่งครบ ${sum(moving, (item) => item.qty)} ตัว จาก ${moving.length} กอง ไป${target.name}`;
    } else if (kind === "transfer") {
      const qty = positive(command.values);
      if (needsPartialApproval(state, operation, lot!, qty) && command.role !== "supervisor") throw new Error("ส่งบางส่วนต้องให้หัวหน้าเลือกและยืนยันทุกครั้ง");
      const target = operationOf(state, second);
      if (qty > readyQuantity(state, target, lot!)) throw new Error("จำนวนที่ส่งต่อยังไม่พร้อมตามกอง/ไซซ์/จุดพิมพ์จริง");
      const part = take(state, lot!, qty, "handoff");
      part.currentOperationId = target.id;
      part.custody = { kind: "factory", name: target.station };
      detail = `${qty} ตัว · ${operation.name} → ${target.name}${needsPartialApproval(original, operationOf(original, operation.id), original.lots.find((item) => item.id === lot!.id)!, qty) ? ` · หัวหน้าอนุมัติครั้งนี้` : ""}`;
    } else if (kind === "send") {
      const qty = positive(command.values);
      if (qty > readyQuantity(state, operation, lot!)) throw new Error("เสื้อหรือฟิล์มกองนี้ไม่พร้อมส่ง");
      if (qty < lot!.qty && command.role !== "supervisor") throw new Error("แบ่งส่งบางส่วนต้องให้หัวหน้ายืนยันครั้งนี้");
      consumeFilm(state, operation, lot!, qty);
      const part = take(state, lot!, qty, "vendor");
      part.condition = "vendor"; part.custody = { kind: "vendor", name: operation.vendor ?? "ร้านนอก" };
      detail = `ส่ง ${qty} ตัว → ${part.custody.name}`;
    } else if (kind === "resend") {
      const qty = positive(command.values);
      const part = take(state, lot!, qty, "vendor-rework");
      part.condition = "vendor"; part.needsReinspection = true;
      part.custody = { kind: "vendor", name: operation.vendor ?? lot!.returnedFromVendor ?? "ร้านเดิม" };
      detail = `ส่งแก้ ${qty} ตัว → ${part.custody.name} · ${detail}`;
    } else if (kind === "receive") {
      const qty = positive(command.values);
      const vendor = lot!.custody.name;
      const part = take(state, lot!, qty, "return");
      part.condition = "inspection"; part.returnedFromVendor = vendor; part.custody = { kind: "factory", name: "จุดตรวจรับของกลับ" };
      detail = `${vendor} กลับ ${qty} ตัว · ต้องตรวจรับก่อนส่งต่อ`;
    } else if (kind === "finish" || kind === "inspect" || kind === "reinspect") {
      detail = `${output(state, lot!, operation, command.values, kind)}${detail ? ` · ${detail}` : ""}`;
    } else if (kind === "plan-rework") {
      const target = operationOf(state, String(command.values?.target));
      if (!target || !reworkTargets(state, lot!).some((item) => item.id === target.id)) throw new Error("จุดแก้ไม่อยู่ในเส้นทางก่อนหน้าของกองนี้");
      lot!.currentOperationId = target.id; lot!.reworkPlanned = true; lot!.custody = { kind: "factory", name: target.station };
      detail = `${lot!.qty} ตัว → ${target.name} · ${detail}`;
    } else if (kind === "repair") {
      const qty = positive(command.values);
      const part = take(state, lot!, qty, "repair");
      part.condition = "available"; part.needsReinspection = true;
      if (part.reworkOfOperationId) part.currentOperationId = part.reworkOfOperationId;
      part.custody = { kind: "factory", name: "จุดตรวจซ้ำ" };
      detail = `แก้ ${qty} ตัว · ยังไม่นับผ่านจนตรวจซ้ำ · ${detail}`;
    } else if (kind === "pack") {
      const qty = positive(command.values);
      if (qty > readyQuantity(state, operation, lot!)) throw new Error("กองนี้ยังไม่ผ่านขั้นก่อนแพ็ก");
      const required = state.operations.filter((item) => item.orderId === lot!.orderId && item.scopeKeys.includes(lot!.scopeKey) && item.kind !== "film" && item.kind !== "pack");
      if (required.some((item) => !lot!.completedOperationIds.includes(item.id))) throw new Error("กองนี้ยังมีงานตามสูตรที่ไม่ครบ แพ็กไม่ได้");
      const part = take(state, lot!, qty, "pack");
      part.condition = "packed"; part.completedOperationIds = [...new Set([...part.completedOperationIds, operation.id])];
      detail = `แพ็ก ${qty} ตัว · ${lotName(state, part)}`;
    } else throw new Error("ไม่รู้จักคำสั่ง");
    operation = operationOf(state, selected.operationId!);
    const materialDelta = sum(state.lots, (item) => item.qty) - sum(original.lots, (item) => item.qty);
    const expectedMaterialDelta = kind === "acquire" || kind === "replace" ? positive(command.values) : 0;
    if (materialDelta !== expectedMaterialDelta) throw new Error("จำนวนเสื้อก่อนและหลังรายการไม่สมดุล");
    state.revision += 1;
    state.clock = new Date(new Date(state.clock).getTime() + 60_000).toISOString();
    state.processedCommands[command.commandId] = fingerprint;
    state.history.push({ id: `event-${state.revision}`, orderId: operation.orderId, operationId: operation.id, lotId: selected.lotId, title: selected.label, detail, actor: command.actor.name, at: state.clock, commandId: command.commandId });
    assertPhysicalInvariants(state);
    return { state };
  } catch (error) { return { state: original, error: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ" }; }
}

/** Checks the material ledger, never substituting status labels for counted pieces. */
export function assertPhysicalInvariants(state: FlowState): void {
  const ids = new Set<string>();
  for (const lot of state.lots) {
    if (ids.has(lot.id)) throw new Error("กองเสื้อซ้ำ"); ids.add(lot.id);
    if (!Number.isSafeInteger(lot.qty) || lot.qty <= 0) throw new Error("จำนวนกองเสื้อไม่ถูกต้อง");
    const order = state.orders.find((item) => item.id === lot.orderId);
    if (!order?.scopes.some((scope) => scope.key === lot.scopeKey)) throw new Error("กองเสื้ออ้างสินค้าไม่ตรงออเดอร์");
    if (lot.condition === "vendor" && lot.custody.kind !== "vendor") throw new Error("ยอดร้านนอกต้องมีผู้ถือครองเป็นร้าน");
    if (lot.custody.kind === "vendor" && lot.condition !== "vendor") throw new Error("ของอยู่ร้านห้ามนับเป็นกองพร้อมในโรงงาน");
    if (lot.condition === "packed" && lot.needsReinspection) throw new Error("งานรอตรวจซ้ำแพ็กไม่ได้");
  }
  for (const order of state.orders) for (const scope of order.scopes) {
    const scoped = state.lots.filter((lot) => lot.scopeKey === scope.key);
    const original = sum(scoped.filter((lot) => lot.source === "original"), (lot) => lot.qty);
    const replaced = sum(scoped.filter((lot) => lot.source === "replacement"), (lot) => lot.qty);
    const waste = sum(scoped.filter((lot) => lot.condition === "waste"), (lot) => lot.qty);
    if (original > scope.orderedQty) throw new Error("เสื้อเดิมมากกว่าจำนวนตามแผน");
    if (replaced > waste) throw new Error("เสื้อทดแทนต้องอ้างของเสียที่เกิดจริง");
    if (sum(scoped.filter((lot) => lot.condition === "packed"), (lot) => lot.qty) > scope.orderedQty) throw new Error("แพ็กเกินจำนวนสี/ไซซ์ที่สั่ง");
  }
  for (const film of state.films) if (!Number.isSafeInteger(film.availableQty) || film.availableQty < 0 || film.availableQty > film.producedQty) throw new Error("ยอดฟิล์มพร้อมใช้ไม่ตรงหลักฐานผลิตและใช้ไป");
}
