import { describe, expect, it } from "vitest";

import { ManufacturingDomainError } from "./manufacturing-domain";
import {
  assertExpectedRevision,
  decideManufacturingCommand,
  hashManufacturingCommand,
  nextManufacturingRevision,
} from "./manufacturing-command";

describe("hashManufacturingCommand", () => {
  const base = {
    commandType: "reportOutput",
    expectedRevision: 3,
    productionStepId: "step-1",
  };

  it("is stable across object key order and undefined optional fields", () => {
    const left = hashManufacturingCommand({
      ...base,
      payload: { qtyGood: 4, nested: { b: 2, a: 1 }, omitted: undefined },
    });
    const right = hashManufacturingCommand({
      ...base,
      payload: { nested: { a: 1, b: 2 }, qtyGood: 4 },
    });
    expect(left).toBe(right);
  });

  it("changes when quantity or expected revision changes", () => {
    const original = hashManufacturingCommand({ ...base, payload: { qtyGood: 4 } });
    expect(hashManufacturingCommand({ ...base, payload: { qtyGood: 5 } })).not.toBe(original);
    expect(
      hashManufacturingCommand({ ...base, expectedRevision: 4, payload: { qtyGood: 4 } }),
    ).not.toBe(original);
  });
});
describe("decideManufacturingCommand", () => {
  it("executes a new command and never executes an existing command again", () => {
    expect(decideManufacturingCommand({ existing: null, requestHash: "hash" })).toEqual({
      kind: "EXECUTE",
    });
    expect(
      decideManufacturingCommand({
        requestHash: "hash",
        existing: {
          requestHash: "hash",
          status: "PENDING",
          result: null,
          errorCode: null,
          errorMessage: null,
        },
      }),
    ).toEqual({ kind: "IN_FLIGHT" });
  });

  it("replays the original success result", () => {
    const result = { revision: 4, qtyGood: 7 };
    expect(
      decideManufacturingCommand({
        requestHash: "hash",
        existing: {
          requestHash: "hash",
          status: "SUCCEEDED",
          result,
          errorCode: null,
          errorMessage: null,
        },
      }),
    ).toEqual({ kind: "REPLAY_SUCCESS", result });
  });

  it("replays the original failure instead of rerunning side effects", () => {
    expect(
      decideManufacturingCommand({
        requestHash: "hash",
        existing: {
          requestHash: "hash",
          status: "FAILED",
          result: null,
          errorCode: "NOT_READY",
          errorMessage: "งานก่อนหน้ายังไม่เสร็จ",
        },
      }),
    ).toEqual({
      kind: "REPLAY_FAILURE",
      errorCode: "NOT_READY",
      errorMessage: "งานก่อนหน้ายังไม่เสร็จ",
    });
  });

  it("rejects reusing commandId with a different request hash", () => {
    expect(() =>
      decideManufacturingCommand({
        requestHash: "new-hash",
        existing: {
          requestHash: "old-hash",
          status: "SUCCEEDED",
          result: {},
          errorCode: null,
          errorMessage: null,
        },
      }),
    ).toThrow("commandId นี้ถูกใช้กับคำสั่งคนละชุดข้อมูลแล้ว");
  });
});

describe("manufacturing optimistic revision", () => {
  it("accepts the exact revision and increments once", () => {
    expect(() =>
      assertExpectedRevision({ entityLabel: "งานสถานี", currentRevision: 2, expectedRevision: 2 }),
    ).not.toThrow();
    expect(nextManufacturingRevision(2)).toBe(3);
  });

  it("rejects stale, negative and fractional revisions with a typed conflict", () => {
    for (const expectedRevision of [1, -1, 1.5]) {
      try {
        assertExpectedRevision({
          entityLabel: "งานสถานี",
          currentRevision: 2,
          expectedRevision,
        });
        throw new Error("expected revision guard to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ManufacturingDomainError);
        expect((error as ManufacturingDomainError).code).toBe("REVISION_CONFLICT");
      }
    }
  });
});
