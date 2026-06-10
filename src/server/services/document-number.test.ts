import { describe, it, expect, vi } from "vitest";
import { currentPeriod, nextDocumentNumber, withDocNumberRetry } from "./document-number";
import type { PrismaTx } from "@/lib/prisma";

// เกราะของเลขเอกสาร — format/period/retry semantics ห้ามเปลี่ยนโดยไม่รู้ผลกฎหมายใบกำกับ

describe("currentPeriod — อิงเวลาไทยเสมอ", () => {
  it("เดือนปกติ", () => {
    expect(currentPeriod(new Date("2026-06-10T08:00:00+07:00"))).toBe("2606");
    expect(currentPeriod(new Date("2026-12-15T12:00:00+07:00"))).toBe("2612");
  });

  it("รอยต่อเดือนบน host UTC: 30 มิ.ย. 17:30Z = 1 ก.ค. ตี 0:30 ไทย → ต้องเป็นเดือน 07", () => {
    expect(currentPeriod(new Date("2026-06-30T17:30:00Z"))).toBe("2607");
    expect(currentPeriod(new Date("2026-06-30T16:30:00Z"))).toBe("2606");
  });
});

describe("nextDocumentNumber", () => {
  function mockTx(lastNumber: number) {
    return {
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ lastNumber }),
      },
    } as unknown as PrismaTx;
  }

  it("format <PREFIX>-<YYMM>-<NNNN> เลข pad 4 หลัก", async () => {
    const period = currentPeriod();
    expect(await nextDocumentNumber(mockTx(7), "FINAL_INVOICE")).toBe(`INV-F-${period}-0007`);
    expect(await nextDocumentNumber(mockTx(1234), "ORDER")).toBe(`ORD-${period}-1234`);
    expect(await nextDocumentNumber(mockTx(1), "QUOTATION")).toBe(`QT-${period}-0001`);
    expect(await nextDocumentNumber(mockTx(2), "CREDIT_NOTE")).toBe(`CN-${period}-0002`);
    expect(await nextDocumentNumber(mockTx(3), "BILLING_NOTE")).toBe(`BN-${period}-0003`);
  });

  it("upsert ด้วย key (docType, period) + increment — โครงห้ามเปลี่ยน (atomicity อยู่ที่ ON CONFLICT)", async () => {
    const tx = mockTx(1);
    await nextDocumentNumber(tx, "RECEIPT");
    const upsertArgs = (tx.documentSequence.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertArgs.where.docType_period.docType).toBe("RECEIPT");
    expect(upsertArgs.create.lastNumber).toBe(1);
    expect(upsertArgs.update.lastNumber).toEqual({ increment: 1 });
  });
});

describe("withDocNumberRetry", () => {
  const p2002 = () => Object.assign(new Error("unique constraint"), { code: "P2002" });

  it("สำเร็จรอบแรก → ไม่ retry", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withDocNumberRetry(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("P2002 → ลองใหม่จนหมดโควต้าแล้วโยน error เดิม", async () => {
    const fn = vi.fn().mockRejectedValue(p2002());
    await expect(withDocNumberRetry(fn, 3)).rejects.toThrow("unique constraint");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("error อื่นที่ไม่ใช่ P2002 → โยนทันที ไม่ retry", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(withDocNumberRetry(fn)).rejects.toThrow("db down");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("P2002 แล้วรอบถัดไปสำเร็จ → คืนค่าปกติ", async () => {
    const fn = vi.fn().mockRejectedValueOnce(p2002()).mockResolvedValueOnce("second");
    expect(await withDocNumberRetry(fn)).toBe("second");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
