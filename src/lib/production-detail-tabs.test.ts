import { describe, expect, it } from "vitest";
import {
  PRODUCTION_DETAIL_DEFAULT_TAB,
  PRODUCTION_DETAIL_TABS,
  normalizeProductionDetailTab,
} from "./production-detail-tabs";

describe("production detail tabs", () => {
  it("keeps the ERP work sequence stable", () => {
    expect(PRODUCTION_DETAIL_TABS.map((tab) => tab.key)).toEqual([
      "work",
      "inventory",
      "history",
    ]);
    expect(PRODUCTION_DETAIL_DEFAULT_TAB).toBe("work");
  });

  it.each(["work", "inventory", "history"])("accepts %s", (value) => {
    expect(normalizeProductionDetailTab(value)).toBe(value);
  });

  it.each([null, undefined, "", "materials", "unknown"])(
    "rejects invalid value %s",
    (value) => {
      expect(normalizeProductionDetailTab(value)).toBeNull();
    },
  );
});
