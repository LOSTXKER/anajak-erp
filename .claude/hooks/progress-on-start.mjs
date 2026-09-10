#!/usr/bin/env node
// SessionStart hook — โหลด PROGRESS.md เข้า context (กัน "ลืมว่าทำถึงไหน")
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const f = join(root, 'PROGRESS.md');
if (existsSync(f)) {
  const body = readFileSync(f, 'utf8').trim();
  if (body) console.log('สถานะล่าสุด (PROGRESS.md) — อ่านก่อนทำต่อ แล้วลงมือจาก NEXT:\n\n' + body);
} else {
  console.log('ยังไม่มี PROGRESS.md — สร้างก่อนเริ่มงานยาว (skill new-repo ในสมองของ Nami)');
}
