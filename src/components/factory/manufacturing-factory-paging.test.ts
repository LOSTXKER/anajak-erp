import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FACTORY_CENTER_PAGE_SIZE,
  factoryCenterPage,
} from "./manufacturing-factory-paging";

const boardSource = readFileSync(
  new URL("./manufacturing-factory-board.tsx", import.meta.url),
  "utf8",
);

describe("Factory TV work center paging", () => {
  it("keeps at most six centers on a TV page and exposes every center before wrapping", () => {
    const centers = Array.from({ length: 13 }, (_, index) => `center-${index + 1}`);

    const first = factoryCenterPage(centers, 0);
    const second = factoryCenterPage(centers, 1);
    const third = factoryCenterPage(centers, 2);

    expect(FACTORY_CENTER_PAGE_SIZE).toBe(6);
    expect(first).toEqual({
      items: centers.slice(0, 6),
      page: 0,
      pageCount: 3,
    });
    expect(second.items).toEqual(centers.slice(6, 12));
    expect(third.items).toEqual(centers.slice(12));
    expect([...first.items, ...second.items, ...third.items]).toEqual(centers);
    expect(factoryCenterPage(centers, 3)).toEqual(first);
  });

  it("normalizes stale and invalid page indexes deterministically", () => {
    const centers = Array.from({ length: 7 }, (_, index) => index + 1);

    expect(factoryCenterPage(centers, -1).page).toBe(1);
    expect(factoryCenterPage(centers, Number.NaN).page).toBe(0);
    expect(factoryCenterPage([], 99)).toEqual({
      items: [],
      page: 0,
      pageCount: 1,
    });
    expect(() => factoryCenterPage(centers, 0, 0)).toThrow(
      "Factory center page size must be a positive integer",
    );
  });

  it("renders only the current page and rotates it instead of mapping every center", () => {
    expect(boardSource).toContain("pagedCenters.items.map");
    expect(boardSource).toContain("FACTORY_CENTER_PAGE_INTERVAL_MS");
    expect(boardSource).not.toContain("{centers.map((center)");
  });
});
