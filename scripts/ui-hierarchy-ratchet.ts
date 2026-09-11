/**
 * รายการช่วยทบทวนลำดับความสำคัญทางสายตา (A16 · 2026-09-11)
 *
 * นับต่อไฟล์ .tsx ใน src (ยกเว้น test):
 *   dots  = บรรทัดที่ต่อข้อมูล ≥3 อย่างด้วย " · " (มีจุดคั่น ≥2 ตัวในบรรทัดเดียว)
 *   muted = จำนวน "text-xs text-muted" / "text-2xs text-muted"
 * เทียบกับ baseline ใน scripts/ui-hierarchy-baseline.json:
 * baseline ช่วยหาจุดที่เปลี่ยน ไม่ใช่เพดานคุณภาพ: ข้อความจำเป็นเพิ่มได้
 * จำนวนจุด/คลาสไม่รู้ความหมายหรือ contrast จึงเป็นคำเตือน ไม่หยุด verify:ui
 * ด่านข้อมูล/สิทธิ์/การเข้าถึงยังตรวจแยกใน verify-ui-tokens และ test
 * `--update` = บันทึก snapshot หลังทบทวน; ไม่ต้องลดข้อความเพื่อให้ผ่าน
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASELINE = "scripts/ui-hierarchy-baseline.json";
const DOT_CHAIN = / · [^\n]* · /;

function isProtoProse(path: string) {
  return path.startsWith("src/app/proto/") && (path.endsWith("/page.tsx") || path.endsWith("/removed.tsx"));
}

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    // หน้าลอง: ไฟล์คำอธิบาย (page.tsx ที่มี COPY/NOTES · _variants/removed.tsx ที่สรุปของเดิม) เป็นร้อยแก้ว
    // ที่คั่นด้วยจุดตามปกติของภาษาเขียน ไม่ใช่แถวข้อมูล — ตัววาดของหน้าลอง (_pieces/_variants อื่น) ยังโดนด่านเต็ม
    else if (path.endsWith(".tsx") && !path.includes(".test.") && !isProtoProse(path)) out.push(path);
  }
  return out;
}

const files = walk("src").sort();
const current: Record<string, { dots: number; muted: number }> = {};
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);
  const dots = lines.filter((line) => !isComment(line) && DOT_CHAIN.test(line)).length;
  const muted = lines.reduce(
    (sum, line) => sum + (line.match(/text-2?xs text-muted/g)?.length ?? 0),
    0,
  );
  if (dots || muted) current[file] = { dots, muted };
}

const totals = Object.values(current).reduce(
  (acc, v) => ({ dots: acc.dots + v.dots, muted: acc.muted + v.muted }),
  { dots: 0, muted: 0 },
);

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`✅ เขียน baseline ใหม่: ${Object.keys(current).length} ไฟล์ · dots ${totals.dots} · muted ${totals.muted}`);
  process.exit(0);
}

let baseline: Record<string, { dots: number; muted: number }> = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  console.log("⚠️ ไม่มี baseline สำหรับเทียบการนำเสนอ — รายงานจุดที่พบเพื่อทบทวนตาม ui-guidance");
}

const problems: string[] = [];
for (const [file, value] of Object.entries(current)) {
  const base = baseline[file];
  if (!base) {
    if (value.dots > 0) problems.push(`${file}: ต่อข้อมูลด้วยจุด ${value.dots} บรรทัด — ตรวจว่าอ่านและเทียบข้อมูลได้ง่าย`);
    continue;
  }
  if (value.dots > base.dots) problems.push(`${file}: dots ${base.dots} → ${value.dots} (เพิ่ม)`);
  if (value.muted > base.muted) problems.push(`${file}: text-xs text-muted ${base.muted} → ${value.muted} (เพิ่ม)`);
}

const baseTotals = Object.values(baseline).reduce(
  (acc, v) => ({ dots: acc.dots + v.dots, muted: acc.muted + v.muted }),
  { dots: 0, muted: 0 },
);

if (problems.length) {
  console.log("⚠️ จุดที่ควรทบทวนการนำเสนอ (คำแนะนำ ไม่ใช่ผลตัดสิน UX)");
  problems.forEach((p) => console.log(`   ${p}`));
  console.log("   คงคำช่วยจำเป็นตรงจุดใช้ และตรวจจากหน้าจอจริงตาม ui-guidance");
} else {
  console.log("ℹ️ ไม่พบจำนวนจุดคั่น/ข้อความรองเพิ่มจาก snapshot; ยังต้องตรวจการใช้งานจริง");
}
console.log(
  `   จำนวนที่สำรวจ: dots ${totals.dots} (baseline ${baseTotals.dots}) · muted ${totals.muted} (baseline ${baseTotals.muted})`,
);
