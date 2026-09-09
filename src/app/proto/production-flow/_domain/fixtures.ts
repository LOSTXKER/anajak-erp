import { assertPhysicalInvariants } from "./engine";
import { DEFAULT_ACTORS, type FlowOperation, type FlowOrder, type FlowState, type GarmentLot, type QuantityScope, type Scenario } from "./types";

const NOW = "2026-09-09T06:00:00.000Z";
const DAY = "2026-09-12T10:00:00.000Z";
const scope = (orderId: string, suffix: string, qty: number, size = "L", technique: "DTF" | "EMBROIDERY" = "DTF", product = "เสื้อคอกลม Cotton 100%", itemId = "item-1"): QuantityScope => ({
  key: `${orderId}-${suffix}`, itemId: `${orderId}-${itemId}`, variantId: `${orderId}-variant-${suffix}`,
  product, color: suffix.includes("white") ? "ขาว" : "ดำ", size, orderedQty: qty, source: "stock",
  prints: [{ id: `${orderId}-${itemId}-${technique.toLowerCase()}`, label: technique === "DTF" ? "หน้าอก" : "ปักอกซ้าย", technique, artworkVersion: "v3" }],
});
function order(state: FlowState, id: string, number: string, customer: string, scopes: QuantityScope[], dueAt = DAY): FlowOrder {
  const result = { id, number, customer, scopes, dueAt, owner: "หัวหน้าเบส", workOrders: [{ id: `${id}-mo`, number: `MO-${number.slice(4)}` }] };
  state.orders.push(result); return result;
}
function route(state: FlowState, parent: FlowOrder, options: { prefix?: string; keys?: string[]; vendorOnly?: boolean; labels?: "before" | "after"; workOrderId?: string } = {}) {
  const prefix = options.prefix ?? parent.id;
  const scopeKeys = options.keys ?? parent.scopes.map((item) => item.key);
  const printIds = parent.scopes.filter((item) => scopeKeys.includes(item.key)).flatMap((item) => item.prints.map((print) => print.id));
  const make = (suffix: string, name: string, kind: FlowOperation["kind"], predecessors: string[], sequence: number, vendor?: string) => {
    const result: FlowOperation = { id: `${prefix}-${suffix}`, orderId: parent.id, workOrderId: options.workOrderId ?? parent.workOrders[0].id, name, kind, station: name, sequence, scopeKeys, predecessorIds: predecessors, printIds: kind === "press" || kind === "film" || kind === "vendor" ? [...new Set(printIds)] : [], assignedTo: DEFAULT_ACTORS.worker, vendor, standards: kind === "press" ? [{ id: "sample-v3", label: "ตรวจตำแหน่งตัวอย่างเทียบแบบ v3" }, { id: "peel-v1", label: "ทดสอบการติดและการลอกแล้ว" }] : kind === "qc" ? [{ id: "all-prints-v3", label: "ตรวจทุกจุดพิมพ์และตำหนิตามแบบ v3" }] : [] };
    state.operations.push(result); return result.id;
  };
  const prep = make("prep", "เตรียมเสื้อ", "prepare", [], 10);
  const film = options.vendorOnly ? undefined : make("film", "พิมพ์ฟิล์ม DTF", "film", [], 15);
  let vendor: string | undefined;
  if (options.vendorOnly || options.labels === "before") vendor = make("vendor", options.vendorOnly ? "ปักโลโก้" : "เย็บป้ายคอ", "vendor", [prep], 20, options.vendorOnly ? "ร้านปักพี่ดาว" : "ร้านป้ายพี่นิด");
  const press = options.vendorOnly ? undefined : make("press", "รีดร้อน", "press", [vendor ?? prep, film!], 30);
  if (options.labels === "after") vendor = make("vendor", "เย็บป้ายคอ", "vendor", [press!], 40, "ร้านป้ายพี่นิด");
  const qc = make("qc", "ตรวจคุณภาพสุดท้าย", "qc", [options.labels === "after" || options.vendorOnly ? vendor! : press!], 50);
  const pack = make("pack", "แพ็กตามสี / ไซซ์", "pack", [qc], 60);
  return { prep, film, press, vendor, qc, pack };
}
function lot(state: FlowState, parent: FlowOrder, quantityScope: QuantityScope, currentOperationId: string, completedOperationIds: string[], options: Partial<GarmentLot> = {}) {
  const id = options.id ?? `${quantityScope.key}-lot-${state.lots.length}`;
  const result: GarmentLot = { id, rootLotId: id, orderId: parent.id, scopeKey: quantityScope.key, qty: quantityScope.orderedQty, source: "original", custody: { kind: "factory", name: "โรงงาน Anajak" }, condition: "available", currentOperationId, completedOperationIds, ...options };
  state.lots.push(result); return result;
}
function films(state: FlowState, parent: FlowOrder, operationId: string, quantities?: Record<string, number>, consumed?: Record<string, number>) {
  const operation = state.operations.find((item) => item.id === operationId)!;
  for (const item of parent.scopes.filter((item) => operation.scopeKeys.includes(item.key))) for (const print of item.prints.filter((print) => print.technique === "DTF")) {
    const producedQty = quantities?.[item.key] ?? item.orderedQty;
    state.films.push({ id: `${operationId}-${item.key}-${print.id}`, orderId: parent.id, operationId, scopeKey: item.key, printId: print.id, artworkVersion: print.artworkVersion, producedQty, availableQty: producedQty - (consumed?.[item.key] ?? 0), wasteQty: 0 });
  }
}
function history(state: FlowState, parent: FlowOrder, title: string, detail: string) {
  state.history.push({ id: `seed-event-${state.history.length}`, orderId: parent.id, title, detail, actor: "หัวหน้าเบส", at: NOW });
}

/** Each scenario starts from the same workday. Scenario selection changes focus, never invents different totals for a layout. */
export function createDemoState(): FlowState {
  const state: FlowState = { revision: 0, clock: NOW, orders: [], operations: [], lots: [], films: [], history: [], processedCommands: {} };
  {
    const parent = order(state, "dtf", "ORD-2609-0041", "คาเฟ่ริมปิง", [scope("dtf", "s", 40, "S"), scope("dtf", "l", 60, "L")]);
    const r = route(state, parent);
    parent.scopes.forEach((item) => lot(state, parent, item, r.press!, [r.prep])); films(state, parent, r.film!);
    history(state, parent, "เสื้อและฟิล์มพร้อมที่จุดรีด", "เตรียมเสื้อ 100 ตัว · ฟิล์มหน้าอกแบบ v3 ครบตามสีและไซซ์");
  }
  {
    const parent = order(state, "shortage", "ORD-2609-0042", "ทีมวิ่งเชียงใหม่", [scope("shortage", "s", 30, "S"), scope("shortage", "l", 20, "L")], "2026-09-10T10:00:00.000Z");
    const r = route(state, parent);
    parent.scopes.forEach((item) => lot(state, parent, item, r.press!, [r.prep]));
    films(state, parent, r.film!, { "shortage-s": 10, "shortage-l": 40 });
    history(state, parent, "ฟิล์มจำนวนรวมครบ แต่ไซซ์ไม่ตรง", "เสื้อ S30 / L20 · ฟิล์ม S10 / L40 จึงรีดได้จริงเพียง S10 + L20");
  }
  {
    const parent = order(state, "mixed", "ORD-2609-0043", "โรงแรมวาริน", [scope("mixed", "dtf", 60, "M", "DTF", "เสื้อกิจกรรม", "activity"), scope("mixed", "emb", 40, "L", "EMBROIDERY", "เสื้อโปโลพนักงาน", "polo")]);
    parent.workOrders = [{ id: "mixed-mo-dtf", number: "MO-2609-0043-A" }, { id: "mixed-mo-emb", number: "MO-2609-0043-B" }];
    const a = route(state, parent, { prefix: "mixed-dtf", keys: ["mixed-dtf"], workOrderId: "mixed-mo-dtf" });
    const b = route(state, parent, { prefix: "mixed-emb", keys: ["mixed-emb"], vendorOnly: true, workOrderId: "mixed-mo-emb" });
    lot(state, parent, parent.scopes[0], a.press!, [a.prep]); films(state, parent, a.film!);
    lot(state, parent, parent.scopes[1], b.vendor!, [b.prep], { condition: "vendor", custody: { kind: "vendor", name: "ร้านปักพี่ดาว" } });
    history(state, parent, "แบ่งงานตามรายการจริง", "เสื้อกิจกรรม DTF 60 ตัว · โปโลปัก 40 ตัว กำลังอยู่ร้านปัก");
  }
  {
    const parent = order(state, "labels-before", "ORD-2609-0044", "แบรนด์ Monday", [scope("labels-before", "m", 80, "M")]);
    const r = route(state, parent, { labels: "before" });
    lot(state, parent, parent.scopes[0], r.vendor!, [r.prep], { condition: "vendor", custody: { kind: "vendor", name: "ร้านป้ายพี่นิด" } }); films(state, parent, r.film!);
    history(state, parent, "ส่งเย็บป้ายก่อนรีด", "เสื้อ 80 ตัวอยู่ร้านป้าย · ฟิล์มพิมพ์รอที่โรงงาน ไม่ใช่เสื้ออยู่สองที่");
  }
  {
    const parent = order(state, "labels-after", "ORD-2609-0045", "แบรนด์ Afterhours", [scope("labels-after", "m", 80, "M")]);
    const r = route(state, parent, { labels: "after" });
    state.operations.find((operation) => operation.id === r.press)!.assignedTo = null;
    lot(state, parent, parent.scopes[0], r.press!, [r.prep]); films(state, parent, r.film!);
    history(state, parent, "หัวหน้าตรวจสูตรรีดก่อนเย็บป้าย", "เสื้อพร้อมรีด 80 ตัว · ป้ายคอเป็นขั้นถัดไปของเสื้อกองเดียวกัน");
  }
  {
    const parent = order(state, "partial", "ORD-2609-0046", "งานวิ่งดอยสุเทพ", [scope("partial", "l", 100)], "2026-09-08T10:00:00.000Z");
    const r = route(state, parent);
    lot(state, parent, parent.scopes[0], r.press!, [r.prep], { id: "partial-unfinished", rootLotId: "partial-root", qty: 60 });
    lot(state, parent, parent.scopes[0], r.press!, [r.prep, r.press!], { id: "partial-good", parentLotId: "partial-unfinished", rootLotId: "partial-root", qty: 40 });
    films(state, parent, r.film!, undefined, { "partial-l": 40 });
    history(state, parent, "ช่างบันทึกรีดผ่าน 40 ตัว", "อีก 60 ตัวยังไม่บันทึกผล · รอหัวหน้าเลือกว่าให้ 40 ตัวเข้า QC ก่อนหรือรอครบ");
  }
  {
    const parent = order(state, "vendor", "ORD-2609-0047", "คลินิกบ้านสุข", [scope("vendor", "l", 100, "L", "EMBROIDERY", "เสื้อโปโลคลินิก")], "2026-09-10T10:00:00.000Z");
    const r = route(state, parent, { vendorOnly: true });
    lot(state, parent, parent.scopes[0], r.vendor!, [r.prep], { id: "vendor-away", rootLotId: "vendor-root", qty: 40, condition: "vendor", custody: { kind: "vendor", name: "ร้านปักพี่ดาว" } });
    lot(state, parent, parent.scopes[0], r.vendor!, [r.prep, r.vendor!], { id: "vendor-good", parentLotId: "vendor-away", rootLotId: "vendor-root", qty: 57, returnedFromVendor: "ร้านปักพี่ดาว" });
    lot(state, parent, parent.scopes[0], r.vendor!, [r.prep], { id: "vendor-rework", parentLotId: "vendor-away", rootLotId: "vendor-root", qty: 3, condition: "rework", reworkOfOperationId: r.vendor!, resultOperationId: r.vendor!, returnedFromVendor: "ร้านปักพี่ดาว" });
    history(state, parent, "รับกลับ 60 จาก 100 ตัว", "ตรวจรับผ่าน 57 ตัว · ปักเอียงส่งแก้ 3 ตัว · ยังอยู่ร้านอีก 40 ตัว");
  }
  {
    const parent = order(state, "vendor-receive", "ORD-2609-0048", "ร้านกาแฟป่าตัน", [scope("vendor-receive", "m", 100, "M", "EMBROIDERY")]);
    const r = route(state, parent, { vendorOnly: true });
    lot(state, parent, parent.scopes[0], r.vendor!, [r.prep], { id: "vendor-receive-away", condition: "vendor", custody: { kind: "vendor", name: "ร้านปักพี่ดาว" } });
    history(state, parent, "ส่งปัก 100 ตัว", "ลองรับกลับ 60 ตัว แล้วตรวจผ่าน 57 / ส่งแก้ 3 ได้ในใบเดียว");
  }
  {
    const parent = order(state, "machine", "ORD-2609-0049", "ค่ายอาสา มช.", [scope("machine", "l", 60)], "2026-09-09T11:00:00.000Z");
    const r = route(state, parent);
    lot(state, parent, parent.scopes[0], r.press!, [r.prep]); films(state, parent, r.film!);
    const press = state.operations.find((item) => item.id === r.press)!; press.machineDown = true; press.issue = "เครื่องรีดแรงกดตก ต้องหยุดใช้";
    history(state, parent, "ช่างแจ้งเครื่องรีดเสีย", "หัวหน้าต้องเลือกซ่อมแล้วทำต่อ หรือส่งเสื้อพร้อมฟิล์มให้ร้านรีดสำรอง");
  }
  {
    const parent = order(state, "rework", "ORD-2609-0050", "ร้านอาหารลานนา", [scope("rework", "l", 100)]);
    const r = route(state, parent);
    lot(state, parent, parent.scopes[0], r.qc, [r.prep, r.press!, r.qc], { id: "rework-good", rootLotId: "rework-root", qty: 97 });
    lot(state, parent, parent.scopes[0], r.qc, [r.prep, r.press!], { id: "rework-three", rootLotId: "rework-root", parentLotId: "rework-good", qty: 3, condition: "rework", reworkOfOperationId: r.qc, resultOperationId: r.qc });
    films(state, parent, r.film!, undefined, { "rework-l": 100 });
    history(state, parent, "QC ผ่าน 97 · รอแก้ 3 ตัว", "แยกกอง L 3 ตัวที่ต้องแก้ตำแหน่ง · กองดีไม่ถูกเปิดงานซ้ำ");
  }
  {
    const parent = order(state, "multi-mo", "ORD-2609-0051", "บริษัทเวียงเหนือ", [scope("multi-mo", "staff", 50, "M", "DTF", "เสื้อทีมงาน", "staff"), scope("multi-mo", "guest", 50, "L", "DTF", "เสื้อแขก", "guest")]);
    parent.workOrders = [{ id: "multi-mo-a", number: "MO-2609-0051-A" }, { id: "multi-mo-b", number: "MO-2609-0051-B" }];
    const a = route(state, parent, { prefix: "multi-mo-a", keys: ["multi-mo-staff"], workOrderId: "multi-mo-a" });
    const b = route(state, parent, { prefix: "multi-mo-b", keys: ["multi-mo-guest"], workOrderId: "multi-mo-b" });
    lot(state, parent, parent.scopes[0], a.pack, [a.prep, a.press!, a.qc, a.pack], { condition: "packed" });
    lot(state, parent, parent.scopes[1], b.qc, [b.prep, b.press!]);
    films(state, parent, a.film!, undefined, { "multi-mo-staff": 50 }); films(state, parent, b.film!, undefined, { "multi-mo-guest": 50 });
    history(state, parent, "ใบผลิต A แพ็กแล้ว 50 ตัว", "ใบ B อีก 50 ตัวรอ QC · ทั้งออเดอร์ยังไม่พร้อมส่ง");
  }
  {
    const parent = order(state, "packed", "ORD-2609-0052", "โรงเรียนต้นกล้า", [scope("packed", "l", 120)], "2026-09-09T10:00:00.000Z");
    const r = route(state, parent);
    lot(state, parent, parent.scopes[0], r.pack, [r.prep, r.press!, r.qc, r.pack], { condition: "packed" }); films(state, parent, r.film!, undefined, { "packed-l": 120 });
    history(state, parent, "แพ็กครบพร้อมส่ง", "120 ตัว ผ่าน QC และแพ็กครบทุกสี/ไซซ์ · รอฝ่ายจัดส่งรับมอบ");
  }
  {
    const parent = order(state, "unknown", "ORD-2608-0061", "งานเดิมรอยืนยัน", [scope("unknown", "l", 70)]);
    parent.unknown = true; route(state, parent);
    history(state, parent, "ข้อมูลใบเดิมยังไม่พอ", "มีรายการสั่ง 70 ตัว แต่ยังไม่มีหลักฐานกองเสื้อ สถานที่ และผลผลิตที่ตรวจสอบได้");
  }
  {
    const parent = order(state, "dtf-start", "ORD-2609-0054", "คาเฟ่ดอกไม้", [scope("dtf-start", "m", 30, "M")]);
    route(state, parent);
    history(state, parent, "ปล่อยแผน DTF ใหม่", "เริ่มจากรับเสื้อและพิมพ์ฟิล์มขนานกัน แล้วรีด ตรวจคุณภาพ และแพ็ก");
  }
  {
    const parent = order(state, "unreleased", "ORD-2609-0053", "ทีมจัดงานแสงเหนือ", [scope("unreleased", "m", 90, "M")]);
    parent.released = false; route(state, parent, { labels: "before" });
    history(state, parent, "รอหัวหน้าเปิดใบผลิต", "แผนที่เสนอ: เตรียมเสื้อ → เย็บป้าย → รีด → QC → แพ็ก; พิมพ์ฟิล์มขนานกับสายเสื้อ");
  }
  for (const item of state.lots.filter((item) => item.condition === "rework")) item.defectReason = item.orderId === "vendor" ? "ปักอกซ้ายเอียงจากแบบ" : "ตำแหน่งลายหน้าอกคลาดจากแบบ";
  assertPhysicalInvariants(state);
  return state;
}

const definitions: [string, string, string][] = [
  ["overview", "งานทั้งโรงงาน", "15 ออเดอร์ในวันเดียวกัน ตั้งแต่รอเปิดใบจนพร้อมส่ง"],
  ["dtf-start", "DTF ตั้งแต่เริ่มจนจบ", "รับเสื้อและพิมพ์ฟิล์มขนาน แล้วรีด → QC → แพ็ก"],
  ["dtf", "DTF ปกติ", "เสื้อและฟิล์มพร้อม · บันทึกผลจริงแล้วส่ง QC"],
  ["shortage", "ฟิล์มครบยอด แต่ผิดไซซ์", "S30/L20 กับฟิล์ม S10/L40 · พร้อมรีดจริง 30 ตัว"],
  ["mixed", "ออเดอร์ผสม DTF + ปัก", "แยกสินค้า 60/40 และเส้นทางที่เกี่ยวข้องจริง"],
  ["labels-before", "เย็บป้ายก่อนรีด", "เสื้ออยู่ร้านป้าย ขณะฟิล์มพิมพ์รอในโรงงาน"],
  ["labels-after", "รีดก่อนเย็บป้าย", "ใช้สูตรอีกลำดับโดยไม่ติดกฎร้านนอกต้องมาก่อน"],
  ["partial", "ส่งต่อ 40 จาก 100", "หัวหน้าเลือกทุกครั้งว่าจะส่งส่วนดีไปก่อนหรือรอครบ"],
  ["vendor", "กลับ 60 / ผ่าน 57 / แก้ 3", "แยกของอยู่ร้าน ของดี และงานแก้บนใบเดียวกัน"],
  ["vendor-receive", "ลองรับกลับบางส่วน", "เริ่มจากส่งร้าน 100 ตัว ลองรับ 60 แล้วตรวจ 57/3"],
  ["machine", "เครื่องรีดเสีย ส่งร้านแทน", "หัวหน้าเปลี่ยนผู้ทำขั้นเดิม พร้อมตรวจรับของกลับ"],
  ["rework", "แก้เฉพาะกองเสีย", "97 ตัวผ่านแล้ว · 3 ตัวต้องแก้และตรวจซ้ำ"],
  ["multi-mo", "หนึ่งออเดอร์ หลายใบผลิต", "ใบ A แพ็กแล้ว ไม่ทำให้ใบ B ที่ยังรอ QC พร้อมส่งตาม"],
  ["packed", "แพ็กครบพร้อมส่ง", "ผ่าน QC และแพ็กครบทุกสี/ไซซ์ของออเดอร์"],
  ["unknown", "ใบเดิม ข้อมูลไม่พอ", "ไม่แต่งยอดหรือสถานที่จากสถานะเก่า"],
  ["unreleased", "รอเปิดใบผลิต", "ตรวจสูตรและขอบเขตรายการก่อนปล่อยงาน"],
];
export const SCENARIOS: Scenario[] = definitions.map(([id, title, description]) => ({ id, title, description, focusOrderId: id === "overview" ? "partial" : id, createState: createDemoState }));
export const scenarios = SCENARIOS;
