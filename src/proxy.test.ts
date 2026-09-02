import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const supabaseState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  cookiesToSet: [] as Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }>,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (cookies: typeof supabaseState.cookiesToSet) => void;
      };
    },
  ) => ({
    auth: {
      getUser: async () => {
        if (supabaseState.cookiesToSet.length > 0) {
          options.cookies.setAll(supabaseState.cookiesToSet);
        }
        return { data: { user: supabaseState.user } };
      },
    },
  }),
}));

import { config, proxy } from "./proxy";

const matches = (url: string) =>
  unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url,
  });

describe("Proxy route boundary", () => {
  it.each([
    "/",
    "/login",
    "/orders?status=CONFIRMED",
    "/production",
    "/factory",
    "/api/trpc/user.me",
    "/api/files/order/example.pdf",
  ])("refreshes the session for %s", (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png&w=128&q=75",
    "/favicon.ico",
    "/approve/design/token",
    "/upload/token",
    "/status/token",
    "/quote/token",
    "/job/token",
    "/api/mcp/http",
    "/assets/example.webp",
  ])("keeps the public/static boundary for %s", (url) => {
    expect(matches(url)).toBe(false);
  });
});

describe("Proxy auth behavior", () => {
  beforeEach(() => {
    supabaseState.user = null;
    supabaseState.cookiesToSet = [];
  });

  it("redirects an unauthenticated page and preserves the intended path", async () => {
    supabaseState.cookiesToSet = [
      { name: "sb-session", value: "rotated", options: { httpOnly: true } },
    ];

    const response = await proxy(
      new NextRequest("http://localhost/orders?status=CONFIRMED"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Forders%3Fstatus%3DCONFIRMED",
    );
    expect(response.cookies.get("sb-session")?.value).toBe("rotated");
  });

  it("redirects an authenticated login request and forwards refreshed cookies", async () => {
    supabaseState.user = { id: "user-1" };
    supabaseState.cookiesToSet = [
      { name: "sb-session", value: "rotated", options: { httpOnly: true } },
    ];

    const response = await proxy(
      new NextRequest("http://localhost/login?next=%2Fproduction"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/production",
    );
    expect(response.cookies.get("sb-session")?.value).toBe("rotated");
  });

  it("refreshes API cookies without redirecting an unauthenticated request", async () => {
    supabaseState.cookiesToSet = [
      { name: "sb-session", value: "rotated", options: { httpOnly: true } },
    ];

    const response = await proxy(
      new NextRequest("http://localhost/api/trpc/user.me"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get("sb-session")?.value).toBe("rotated");
  });
});
