#!/usr/bin/env node
// SessionStart hook — โหลดสถานะล่าสุดจาก PROGRESS.md เข้า context (กัน "ลืมว่าทำถึงไหน") · วางโดย scaffold-doctor
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const f = join(root, 'PROGRESS.md');
if (existsSync(f)) {
  const body = readFileSync(f, 'utf8').trim();
  if (body) console.log('📍 สถานะล่าสุด (PROGRESS.md) — อ่านก่อนทำงานต่อ แล้วลงมือจาก NEXT:\n\n' + body);
} else {
  console.log('⚠️ ยังไม่มี PROGRESS.md — track สถานะที่ไหน? (ดู skill new-project)');
}
