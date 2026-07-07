/**
 * verify:backup — buildBackupExport กับ DB จริง (อ่านอย่างเดียว ไม่เขียนอะไร)
 * เช็ค: ครบทุกตาราง · จำนวนแถวตรงกับ count ผ่าน Prisma · serialize เป็น JSON ได้จริง
 * รัน: npm run verify:backup
 */
import { prisma } from "../src/lib/prisma";
import { buildBackupExport, jsonReplacer } from "../src/server/services/backup-export";

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function main() {
  console.log("\n=== verify:backup ===\n");
  const started = Date.now();
  const data = await buildBackupExport(prisma);
  console.log(`  (ใช้เวลา ${Date.now() - started}ms · ${data.tableCount} ตาราง · ${data.rowCount} แถว)`);

  // ตารางแกนต้องอยู่ครบ
  for (const t of ["users", "orders", "invoices", "customers", "settings", "audit_logs", "document_sequences"]) {
    check(Array.isArray(data.tables[t]), `มีตาราง ${t}`);
  }
  check(data.tableCount >= 40, `จำนวนตาราง ≥ 40 (ได้ ${data.tableCount})`);

  // แถวตรงกับ count ผ่าน Prisma (สุ่มตารางสำคัญ)
  const [users, orders, invoices] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.invoice.count(),
  ]);
  check(data.tables["users"]?.length === users, `แถว users ตรง (${users})`, data.tables["users"]?.length);
  check(data.tables["orders"]?.length === orders, `แถว orders ตรง (${orders})`, data.tables["orders"]?.length);
  check(data.tables["invoices"]?.length === invoices, `แถว invoices ตรง (${invoices})`, data.tables["invoices"]?.length);

  // serialize ได้จริง (Decimal/Date/BigInt ไม่ทำระเบิด) + เลขเงินเป็น string ไม่เพี้ยน
  const json = JSON.stringify(data, jsonReplacer);
  check(json.length > 10_000, `JSON ขนาดสมเหตุผล (${(json.length / 1024).toFixed(0)} KB)`);
  const parsed = JSON.parse(json);
  check(parsed.tables.users.length === users, "parse กลับแล้วข้อมูลยังครบ");

  console.log(`\n=== ผล: ${pass}/${pass + fail} ผ่าน ${fail === 0 ? "✓" : "✗"} ===\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
