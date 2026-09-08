import { describe, expect, it } from "vitest";
import { clampedListPage, positivePage } from "./use-list-page-state";

describe("list navigation recovery", () => {
  it("rejects invalid page numbers from a shared URL", () => {
    for (const value of [null, "", "0", "-2", "1.5", "NaN", "Infinity"]) expect(positivePage(value)).toBe(1);
    expect(positivePage("42")).toBe(42);
  });

  it("returns to the first page when reading or filtering removes the final record", () => {
    expect(clampedListPage(7, 0)).toBe(1);
    expect(clampedListPage(1, 0)).toBe(1);
  });

  it("clamps to the remaining page without moving a valid page", () => {
    expect(clampedListPage(7, 3)).toBe(3);
    expect(clampedListPage(2, 3)).toBe(2);
  });

  it("keeps the requested page while the total is unavailable", () => {
    for (const pages of [undefined, NaN, Infinity, -1]) expect(clampedListPage(7, pages)).toBe(7);
  });
});
