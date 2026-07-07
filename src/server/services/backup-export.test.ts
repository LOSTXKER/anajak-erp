/**
 * เทส backup-export — ด่านชื่อตาราง (กัน SQL injection ผ่านชื่อตารางแปลก)
 * + jsonReplacer (BigInt ต้องไม่ทำ JSON.stringify ระเบิด)
 * ตัว buildBackupExport เทสกับ DB จริงใน scripts/verify-backup-export.ts
 */
import { describe, it, expect } from "vitest";
import { buildBackupExport, isSafeTableName, jsonReplacer } from "./backup-export";

describe("isSafeTableName", () => {
  it("ชื่อ snake_case ปกติ → ผ่าน", () => {
    for (const n of ["users", "audit_logs", "_prisma_migrations", "order_items2"]) {
      expect(isSafeTableName(n)).toBe(true);
    }
  });

  it("ชื่อที่ประกอบ SQL อันตรายได้ → ไม่ผ่าน", () => {
    for (const n of [
      'x"; DROP TABLE users; --',
      "users; select",
      'a"b',
      "ตาราง",
      "Users", // ตัวใหญ่ = นอกแบบ Prisma @@map — ไม่รับ
      "",
      "a b",
    ]) {
      expect(isSafeTableName(n)).toBe(false);
    }
  });
});

describe("buildBackupExport — fail-loud เมื่อ schema ผิดปกติ", () => {
  it("เจอตารางชื่อนอกแบบ → โยนทันทีก่อนแตะ transaction (กัน backup ขาดเงียบ)", async () => {
    const stub = {
      $queryRaw: async () => [{ tablename: "users" }, { tablename: "WebhookEvent" }],
      $transaction: async () => {
        throw new Error("ต้องไม่ถึง transaction");
      },
    } as unknown as Parameters<typeof buildBackupExport>[0];
    await expect(buildBackupExport(stub)).rejects.toThrow("WebhookEvent");
  });
});

describe("jsonReplacer", () => {
  it("BigInt → string · ค่าอื่นคงเดิม", () => {
    const out = JSON.parse(
      JSON.stringify({ big: BigInt("9007199254740993"), n: 1, s: "x", d: null }, jsonReplacer)
    );
    expect(out).toEqual({ big: "9007199254740993", n: 1, s: "x", d: null });
  });
});
