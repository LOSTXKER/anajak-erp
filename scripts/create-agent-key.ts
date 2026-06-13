/**
 * สร้างกุญแจ MCP ให้ agent — ผูกกับ User จริง (ได้ Role) · โชว์ raw key "ครั้งเดียว" เก็บแต่ hash
 *
 * ใช้:
 *   tsx --env-file=.env scripts/create-agent-key.ts --name "Nami (เบส)" --email owner@example.com
 *   tsx --env-file=.env scripts/create-agent-key.ts --name "Nami" --owner            # ผูก OWNER คนแรก
 *   ... [--expires-days 365]                                                          # ตั้งวันหมดอายุ (ดีฟอลต์ ไม่หมด)
 */

import { prisma } from "../src/lib/prisma";
import { newAgentKey } from "../src/lib/mcp/auth";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

async function main() {
  const name = arg("--name") ?? "MCP Agent";
  const email = arg("--email");
  const expiresDaysRaw = arg("--expires-days");

  let user;
  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  } else if (hasFlag("--owner")) {
    user = await prisma.user.findFirst({
      where: { role: "OWNER", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }

  if (!user) {
    console.error("✗ ไม่พบ user — ระบุ --email <อีเมล> หรือ --owner (ต้องมี OWNER ที่ active)");
    process.exit(1);
  }
  if (!user.isActive) {
    console.error(`✗ user ${user.email} ถูกปิดใช้งาน — เปิดใช้งานก่อน`);
    process.exit(1);
  }

  const expiresDays = expiresDaysRaw ? Number(expiresDaysRaw) : null;
  if (expiresDays !== null && (!Number.isFinite(expiresDays) || expiresDays <= 0)) {
    console.error("✗ --expires-days ต้องเป็นจำนวนวันบวก");
    process.exit(1);
  }
  const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400000) : null;

  const { raw, keyHash, keyPrefix } = newAgentKey();
  await prisma.agentApiKey.create({
    data: { name, keyHash, keyPrefix, userId: user.id, expiresAt, createdById: user.id },
  });

  console.log("");
  console.log("✓ สร้างกุญแจ MCP สำเร็จ");
  console.log(`  ชื่อ:       ${name}`);
  console.log(`  ผูกกับ:     ${user.name} <${user.email}> (${user.role})`);
  console.log(`  หมดอายุ:    ${expiresAt ? expiresAt.toISOString() : "ไม่หมดอายุ"}`);
  console.log(`  prefix:     ${keyPrefix}…`);
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────");
  console.log("  │ API KEY (โชว์ครั้งเดียว — เก็บให้ดี ไม่มีทางดูซ้ำ):");
  console.log(`  │ ${raw}`);
  console.log("  └─────────────────────────────────────────────────────────────");
  console.log("");
  console.log("  เชื่อม MCP client ที่:  <origin>/api/mcp/mcp");
  console.log("    เช่น (เครื่องตัวเอง):  http://localhost:3000/api/mcp/mcp");
  console.log(`    header:               Authorization: Bearer ${raw}`);
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
