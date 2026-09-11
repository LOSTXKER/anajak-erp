import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("prototype frame boundary", () => {
  it("keeps every production route protected against embedding", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      source: "/:path*",
      headers: expect.arrayContaining([{ key: "X-Frame-Options", value: "DENY" }]),
    });
  });

  it("only allows same-origin prototype frames in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(2);
    expect(rules[0].headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(rules[1]).toEqual({
      source: "/proto/:path*",
      headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
    });
  });
});
