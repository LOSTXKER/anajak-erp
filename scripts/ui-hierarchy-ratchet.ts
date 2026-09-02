/**
 * ด่าน "ลำดับความสำคัญทางสายตา" — ratchet (เพิ่ม 2026-09-02 · docs/DESIGN.md §ลำดับความสำคัญทางสายตา)
 *
 * นับต่อไฟล์ .tsx ใน src (ยกเว้น test):
 *   dots  = บรรทัดที่ต่อข้อมูล ≥3 อย่างด้วย " · " (มีจุดคั่น ≥2 ตัวในบรรทัดเดียว)
 *   muted = จำนวน "text-xs text-muted" / "text-2xs text-muted"
 * เทียบกับ baseline ใน scripts/ui-hierarchy-baseline.json:
 *   - ไฟล์ใหม่ที่ไม่มีใน baseline: dots ต้องเป็น 0
 *   - ไฟล์เดิม: ห้ามเกิน baseline (ลดได้ เพิ่มไม่ได้)
 * `--update` = เขียน baseline ใหม่จากค่าปัจจุบัน (ใช้หลัง refactor ให้ตัวเลขลดลงเท่านั้น)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASELINE = "scripts/ui-hierarchy-baseline.json";
const DOT_CHAIN = / · [^\n]* · /;

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx") && !path.includes(".test.")) out.push(path);
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
  console.log("❌ ไม่มี baseline — รัน `npx tsx scripts/ui-hierarchy-ratchet.ts --update` ก่อน");
  process.exit(1);
}

const problems: string[] = [];
for (const [file, value] of Object.entries(current)) {
  const base = baseline[file];
  if (!base) {
    if (value.dots > 0) problems.push(`${file}: ไฟล์ใหม่ต่อข้อมูล ≥3 อย่างด้วยจุด ${value.dots} บรรทัด — ใช้ FactList / InfoChipRow`);
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
  console.log("❌ ลำดับความสำคัญทางสายตาถอยหลัง (docs/DESIGN.md §ลำดับความสำคัญทางสายตา)");
  problems.forEach((p) => console.log(`   ${p}`));
  process.exit(1);
}
console.log(
  `✅ ไม่มีไฟล์ไหนต่อข้อมูลด้วยจุด/ตัวเทาเพิ่ม — ตอนนี้ dots ${totals.dots} (baseline ${baseTotals.dots}) · muted ${totals.muted} (baseline ${baseTotals.muted})`,
);
