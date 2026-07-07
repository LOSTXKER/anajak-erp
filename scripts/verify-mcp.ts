/**
 * verify:mcp — ทดสอบ MCP read-only layer กับ DB จริง (ไม่ผ่าน HTTP — เลี่ยง dev server โหลด client เก่า)
 *
 * คลุม: auth (hash lookup/bearer/x-api-key/ผิด/inactive/หมดอายุ) · ลงทะเบียน 4 tools ·
 *        permission gate ต่อ tool (default ตาม role ตรงชุดเดิม) · ซ่อน field เงินตามสิทธิ์ ·
 *        override รายคนมีผลบน MCP key (ทั้งชั้น tool และ end-to-end ผ่าน verifyAgentToken) ·
 *        กันรั่ว cost/secret · audit ทุก call
 *
 * วิธีรัน: npm run verify:mcp   (ต้องมี OWNER ที่ active + migration agent_api_keys ลงแล้ว)
 */

import { prisma } from "../src/lib/prisma";
import { newAgentKey, verifyAgentToken, type AgentContext } from "../src/lib/mcp/auth";
import { registerAllTools } from "../src/lib/mcp/tools";
import type { Role } from "@prisma/client";

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

const TEST_KEY_NAME = "__verify_mcp__";

// field ที่ "ห้ามรั่ว" เด็ดขาด — ชื่อ key จะปรากฏใน JSON ถ้าเผลอ select
const BANNED = [
  "costPrice", "profitMargin", "totalCost", "unitCost", "estimatedCost", "actualCost",
  "platformFee", "creditLimit", "supabaseId", "statusToken", "uploadToken",
  "confirmToken", "approvalToken", "rfmScore", "stockReservationError",
  // ต้นทุน/ราคาฝั่ง Stock (เผื่อ stock_check map field พลาดเมื่อ Stock ตั้งค่าจริง)
  "lastCost", "sellingPrice", "standardCost",
];

// mock McpServer — เก็บ callback ของแต่ละ tool ไว้เรียกตรง (ผ่าน wrapper จริง: gate+audit+format)
type Cb = (args: unknown, extra: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
const tools = new Map<string, Cb>();
const mockServer = {
  registerTool: (name: string, _config: unknown, cb: Cb) => {
    tools.set(name, cb);
  },
};

function authInfoFor(ctx: AgentContext) {
  return { token: "test", scopes: [ctx.userRole], clientId: ctx.keyId, extra: ctx };
}

async function callTool(name: string, args: unknown, ctx: AgentContext) {
  const cb = tools.get(name);
  if (!cb) throw new Error(`tool ${name} ไม่ถูกลงทะเบียน`);
  const res = await cb(args, { authInfo: authInfoFor(ctx) });
  const text = res.content.map((c) => c.text).join("\n");
  return { isError: res.isError === true, text };
}

async function main() {
  console.log("\n=== verify:mcp ===\n");

  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!owner) {
    console.error("✗ ไม่พบ OWNER ที่ active — สร้าง owner ก่อน (scripts/create-owner.ts)");
    process.exit(1);
  }

  // เคลียร์ของค้างจากรอบก่อน (ถ้ามี)
  await prisma.agentApiKey.deleteMany({ where: { name: TEST_KEY_NAME } });

  // สร้าง test key จริง
  const { raw, keyHash, keyPrefix } = newAgentKey();
  const key = await prisma.agentApiKey.create({
    data: { name: TEST_KEY_NAME, keyHash, keyPrefix, userId: owner.id },
    select: { id: true },
  });

  // key หมดอายุ + key ปิดใช้งาน สำหรับเทสต์ negative
  const expired = newAgentKey();
  await prisma.agentApiKey.create({
    data: {
      name: TEST_KEY_NAME, keyHash: expired.keyHash, keyPrefix: expired.keyPrefix,
      userId: owner.id, expiresAt: new Date(Date.now() - 86400000),
    },
  });
  const inactive = newAgentKey();
  await prisma.agentApiKey.create({
    data: {
      name: TEST_KEY_NAME, keyHash: inactive.keyHash, keyPrefix: inactive.keyPrefix,
      userId: owner.id, isActive: false,
    },
  });

  // ── 1) auth (verifyAgentToken) ──
  console.log("[1] auth — verifyAgentToken");
  const okBearer = await verifyAgentToken(new Request("http://x"), raw);
  check(!!okBearer && (okBearer.extra as Partial<AgentContext> | undefined)?.userRole === "OWNER", "bearer ถูก → AuthInfo role OWNER");
  check(okBearer?.clientId === key.id, "clientId = keyId");

  const okHeader = await verifyAgentToken(
    new Request("http://x", { headers: { "x-api-key": raw } }),
    undefined
  );
  check(!!okHeader, "x-api-key header → ผ่าน (ไม่ต้อง bearer)");

  check((await verifyAgentToken(new Request("http://x"), "ana_wrongwrong")) === undefined, "key มั่ว → undefined");
  check((await verifyAgentToken(new Request("http://x"), undefined)) === undefined, "ไม่มี key → undefined");
  check((await verifyAgentToken(new Request("http://x"), expired.raw)) === undefined, "key หมดอายุ → undefined");
  check((await verifyAgentToken(new Request("http://x"), inactive.raw)) === undefined, "key ปิดใช้งาน → undefined");
  check(
    (await verifyAgentToken(new Request("http://x", { headers: { "x-api-key": "ana_wrong" } }), undefined)) === undefined,
    "x-api-key มั่ว → undefined"
  );

  // lastUsedAt อัปเดต (fire-and-forget — รอสักนิด)
  await new Promise((r) => setTimeout(r, 300));
  const refreshed = await prisma.agentApiKey.findUnique({ where: { id: key.id }, select: { lastUsedAt: true } });
  check(refreshed?.lastUsedAt != null, "lastUsedAt อัปเดตหลังใช้งาน");

  // ── 2) ลงทะเบียน tools ──
  console.log("\n[2] tools registry");
  registerAllTools(mockServer as never);
  check(tools.size === 4, `ลงทะเบียน 4 tools (ได้ ${tools.size})`);
  for (const t of ["order_status", "today_queue", "receivables", "stock_check"]) {
    check(tools.has(t), `มี tool: ${t}`);
  }

  const ownerCtx: AgentContext = {
    userId: owner.id,
    userRole: "OWNER",
    permissionOverrides: null,
    keyId: key.id,
    keyName: TEST_KEY_NAME,
  };
  const ctxAs = (role: Role): AgentContext => ({ ...ownerCtx, userRole: role });
  const ctxWith = (role: Role, overrides: unknown): AgentContext => ({
    ...ownerCtx,
    userRole: role,
    permissionOverrides: overrides,
  });

  const allOutputs: string[] = [];

  // ── 3) order_status ──
  console.log("\n[3] order_status");
  const os = await callTool("order_status", { limit: 5 }, ownerCtx);
  allOutputs.push(os.text);
  check(!os.isError, "OWNER เรียกได้ ไม่ error");
  check(os.text.includes("orders") || os.text.includes("count"), "คืนรายการออเดอร์");
  const osDesigner = await callTool("order_status", { limit: 3 }, ctxAs("DESIGNER"));
  check(!osDesigner.isError, "DESIGNER ดูสถานะได้ (ทุก role)");
  check(!osDesigner.text.includes("totalAmount"), "DESIGNER ไม่เห็น totalAmount (ราคา)");
  check(os.text.includes("totalAmount") || os.text.includes('"count": 0'), "OWNER เห็น totalAmount (ถ้ามีออเดอร์)");

  // ── 4) today_queue ──
  console.log("\n[4] today_queue");
  const tq = await callTool("today_queue", {}, ownerCtx);
  allOutputs.push(tq.text);
  check(!tq.isError, "OWNER เรียกได้");
  check(tq.text.includes("money"), "OWNER เห็น block money");
  const tqStaff = await callTool("today_queue", {}, ctxAs("PRODUCTION_STAFF"));
  check(!tqStaff.text.includes("money"), "ช่างไม่เห็น block money");

  // ── 5) receivables + role gate ──
  console.log("\n[5] receivables");
  const rc = await callTool("receivables", {}, ownerCtx);
  allOutputs.push(rc.text);
  check(!rc.isError, "OWNER เรียก aging ได้");
  check(rc.text.includes("agingByCustomer") || rc.text.includes("grandTotal"), "คืนรายงาน aging");
  const rcDesigner = await callTool("receivables", {}, ctxAs("DESIGNER"));
  check(rcDesigner.isError && rcDesigner.text.includes("FORBIDDEN"), "DESIGNER โดน FORBIDDEN (finance-only)");
  const rcSales = await callTool("receivables", {}, ctxAs("SALES"));
  check(rcSales.isError && rcSales.text.includes("FORBIDDEN"), "SALES โดน FORBIDDEN (finance-only)");

  // ── 6) stock_check (data หรือ UNAVAILABLE ก็ผ่าน — ขอแค่ไม่ crash) ──
  console.log("\n[6] stock_check");
  const sc = await callTool("stock_check", { limit: 5 }, ownerCtx);
  allOutputs.push(sc.text);
  check(true, `เรียกได้ (${sc.isError ? "UNAVAILABLE/รอตั้งค่า" : "มีข้อมูล"})`);
  const scDesigner = await callTool("stock_check", {}, ctxAs("DESIGNER"));
  check(scDesigner.isError && scDesigner.text.includes("FORBIDDEN"), "DESIGNER โดน FORBIDDEN (stock = ops roles)");

  // ── 6.5) override รายคนมีผลบน MCP (PERM follow-up) ──
  console.log("\n[6.5] permission override บน MCP key");
  // ชั้น tool: ติ๊กเพิ่ม
  const rcDesignerPlus = await callTool("receivables", {}, ctxWith("DESIGNER", { see_finance: true }));
  check(!rcDesignerPlus.isError, "override ติ๊กเพิ่ม: DESIGNER+see_finance เรียก receivables ได้");
  // ชั้น tool: ติ๊กตัด
  const rcAcctCut = await callTool("receivables", {}, ctxWith("ACCOUNTANT", { see_finance: false }));
  check(rcAcctCut.isError && rcAcctCut.text.includes("FORBIDDEN"), "override ติ๊กตัด: ACCOUNTANT−see_finance → FORBIDDEN");
  // ชั้น strip เงิน — เช็คกับใบจริง (review จับ: escape hatch "count 0" ผ่านหลอกๆ บน DB ว่าง)
  const anyOrder = await prisma.order.findFirst({ select: { orderNumber: true } });
  if (anyOrder) {
    const osPlus = await callTool(
      "order_status",
      { orderNumber: anyOrder.orderNumber },
      ctxWith("DESIGNER", { see_order_money: true })
    );
    check(!osPlus.isError && osPlus.text.includes("totalAmount"), "override ติ๊กเพิ่ม: DESIGNER+see_order_money เห็น totalAmount (ใบจริง)");
    const osPlain = await callTool("order_status", { orderNumber: anyOrder.orderNumber }, ctxAs("DESIGNER"));
    check(!osPlain.isError && !osPlain.text.includes("totalAmount"), "ใบเดียวกัน: DESIGNER default ยังไม่เห็น totalAmount (strip ทำงาน)");
  } else {
    console.log("  ⚠ ข้ามเช็ค strip override: DB ไม่มีออเดอร์ (ไม่นับผ่าน)");
  }
  const tqAcctCut = await callTool("today_queue", {}, ctxWith("ACCOUNTANT", { see_finance: false }));
  check(!tqAcctCut.isError && !tqAcctCut.text.includes("money"), "override ติ๊กตัด: ACCOUNTANT−see_finance ไม่เห็น block money");
  // override ค่าเสีย → fail กลับ default (fail-closed)
  const rcBadOverride = await callTool("receivables", {}, ctxWith("DESIGNER", { see_finance: "true" }));
  check(rcBadOverride.isError && rcBadOverride.text.includes("FORBIDDEN"), "override ค่าเสีย (string): DESIGNER ยัง FORBIDDEN");
  // stock_check gate ใหม่ (any-of manage_production/create_sales_docs) — default = 4 role เดิมเป๊ะ
  const scSales = await callTool("stock_check", { limit: 3 }, ctxAs("SALES"));
  check(!scSales.text.includes("FORBIDDEN"), "stock_check: SALES default ยังผ่าน gate (union คง SALES)");
  const scAcct = await callTool("stock_check", { limit: 3 }, ctxAs("ACCOUNTANT"));
  check(scAcct.isError && scAcct.text.includes("FORBIDDEN"), "stock_check: ACCOUNTANT default โดน FORBIDDEN (เหมือนเดิม)");
  const scAcctPlus = await callTool("stock_check", { limit: 3 }, ctxWith("ACCOUNTANT", { manage_production: true }));
  check(!scAcctPlus.text.includes("FORBIDDEN"), "override ติ๊กเพิ่ม: ACCOUNTANT+manage_production ผ่าน gate stock_check");

  // end-to-end: overrides จาก DB วิ่งผ่าน verifyAgentToken → tool จริง
  console.log("\n[6.6] override end-to-end ผ่าน verifyAgentToken (DB จริง)");
  const TEST_USER_EMAIL = "__verify_mcp__@test.local";
  await prisma.agentApiKey.deleteMany({ where: { user: { email: TEST_USER_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
  const e2eUser = await prisma.user.create({
    data: {
      supabaseId: `__verify_mcp__${Date.now()}`,
      email: TEST_USER_EMAIL,
      name: "[TEST] verify-mcp override",
      role: "DESIGNER",
      permissionOverrides: { see_finance: true },
    },
    select: { id: true },
  });
  try {
    const e2eKey = newAgentKey();
    await prisma.agentApiKey.create({
      data: { name: TEST_KEY_NAME, keyHash: e2eKey.keyHash, keyPrefix: e2eKey.keyPrefix, userId: e2eUser.id },
    });
    const e2eAuth = await verifyAgentToken(new Request("http://x"), e2eKey.raw);
    const e2eExtra = e2eAuth?.extra as Partial<AgentContext> | undefined;
    check(
      JSON.stringify(e2eExtra?.permissionOverrides) === JSON.stringify({ see_finance: true }),
      "verifyAgentToken แนบ permissionOverrides จาก DB มาใน extra"
    );
    const cb = tools.get("receivables")!;
    const e2eRes = await cb({}, { authInfo: e2eAuth });
    const e2eText = e2eRes.content.map((c) => c.text).join("\n");
    check(
      e2eRes.isError !== true && (e2eText.includes("agingByCustomer") || e2eText.includes("grandTotal")),
      "DESIGNER (key จริง) + override ใน DB → เรียก receivables ผ่านทั้งเส้น"
    );
  } finally {
    await prisma.agentApiKey.deleteMany({ where: { userId: e2eUser.id } });
    await prisma.user.delete({ where: { id: e2eUser.id } });
  }

  // ── 7) กันรั่ว (สแกนทุก output) ──
  console.log("\n[7] กันรั่วข้อมูลภายใน");
  const blob = allOutputs.join("\n");
  for (const banned of BANNED) {
    check(!blob.includes(banned), `ไม่รั่ว field: ${banned}`);
  }

  // ── 8) audit ──
  console.log("\n[8] audit ทุก call");
  await new Promise((r) => setTimeout(r, 400)); // รอ fire-and-forget log เขียนเสร็จ
  const logs = await prisma.agentCallLog.count({ where: { keyId: key.id } });
  check(logs > 0, `มี AgentCallLog ของ key นี้ (${logs} รายการ)`);
  const forbiddenLog = await prisma.agentCallLog.count({
    where: { keyId: key.id, ok: false, errorCode: "FORBIDDEN" },
  });
  check(forbiddenLog > 0, `บันทึก call ที่ FORBIDDEN (${forbiddenLog} รายการ)`);

  // ── cleanup ──
  await prisma.agentApiKey.deleteMany({ where: { name: TEST_KEY_NAME } });

  console.log(`\n=== ผล: ${pass}/${pass + fail} ผ่าน ${fail === 0 ? "✓" : `· ${fail} ตก ✗`} ===\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.agentApiKey.deleteMany({ where: { name: TEST_KEY_NAME } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
