/**
 * Backup export — ดึงข้อมูลทุกตารางเป็น JSON ก้อนเดียว (เบสเคาะ 2026-07-07:
 * Supabase แผนฟรีไม่มี backup อัตโนมัติ → ให้เจ้าของกด export เก็บเองจากหน้า ตั้งค่า)
 *
 * - อ่านทุกตารางใน schema public ภายใต้ transaction ระดับ RepeatableRead
 *   → ได้ snapshot เวลาเดียวกันทั้งฐาน (ไม่ใช่ไล่อ่านทีละตารางคนละจังหวะ)
 * - ชื่อตารางมาจาก pg_catalog เท่านั้น + กรอง regex ก่อนประกอบ SQL (กัน injection)
 * - ผลลัพธ์มีข้อมูลลับครบ (รวม settings ที่เก็บ key เชื่อม Stock) — ผู้เรียก (route)
 *   ต้อง gate เจ้าของเท่านั้น + audit ทุกครั้ง
 */
import { Prisma } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const SAFE_TABLE_NAME = /^[a-z0-9_]+$/;

export function isSafeTableName(name: string): boolean {
  return SAFE_TABLE_NAME.test(name);
}

// JSON.stringify เจอ BigInt = throw — แปลงเป็น string (Decimal/Date มี toJSON อยู่แล้ว)
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export interface BackupExport {
  app: "anajak-erp";
  exportedAt: string;
  tableCount: number;
  rowCount: number;
  tables: Record<string, unknown[]>;
}

export async function buildBackupExport(prisma: ExtendedPrismaClient): Promise<BackupExport> {
  const names = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const all = names.map((n) => n.tablename);
  // ตารางชื่อนอกแบบ snake_case = schema ผิดปกติ (เช่น model ใหม่ลืม @@map) — fail-loud
  // ทันที ห้าม export ขาดเงียบ (review จับ: ไฟล์สำรองที่ขาดตารางจะรู้ตัววันกู้ = สายไป)
  const dropped = all.filter((n) => !isSafeTableName(n));
  if (dropped.length > 0) {
    throw new Error(`backup-export: พบตารางชื่อนอกแบบ snake_case — export จะไม่ครบ: ${dropped.join(", ")}`);
  }

  const tables: Record<string, unknown[]> = {};
  let rowCount = 0;
  let exportedAt = "";
  // เพดานจริงของขาอ่านคือ timeout 120s ตรงนี้ (route ตั้ง maxDuration 300 เผื่อ serialize+ส่งไฟล์)
  await prisma.$transaction(
    async (tx) => {
      // SELECT now() เป็น statement แรก — ตรึง snapshot ของ RepeatableRead พร้อมได้ "เวลา snapshot"
      // เป๊ะ (now() = เวลาเริ่ม tx · จับหลัง tx จบจะเคลมสดกว่าข้อมูลจริงได้ถึง 120s — review จับ)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT now()`;
      exportedAt = now.toISOString();
      for (const name of all) {
        const rows = await tx.$queryRawUnsafe<unknown[]>(`SELECT * FROM "public"."${name}"`);
        tables[name] = rows;
        rowCount += rows.length;
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 }
  );

  return {
    app: "anajak-erp",
    exportedAt,
    tableCount: all.length,
    rowCount,
    tables,
  };
}
