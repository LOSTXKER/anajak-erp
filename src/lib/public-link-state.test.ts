import { describe, expect, it } from "vitest";
import { isPublicLinkUnavailable } from "./public-link-state";

describe("public link cached data", () => {
  it.each(["NOT_FOUND", "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "PRECONDITION_FAILED"])("hides data after %s", (code) => {
    expect(isPublicLinkUnavailable({ data: { code } })).toBe(true);
  });
  it.each([undefined, "INTERNAL_SERVER_ERROR", "TIMEOUT", "TOO_MANY_REQUESTS"])("retains data with a retry notice after %s", (code) => {
    expect(isPublicLinkUnavailable({ data: { code } })).toBe(false);
  });
});
