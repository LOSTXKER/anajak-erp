import { describe, it, expect, afterEach } from "vitest";
import { validateEnv } from "./env";

// สแนปช็อต env จริงไว้คืนหลังแต่ละเทส (validateEnv อ่าน process.env ตรง)
const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const snapshot: Record<string, string | undefined> = {};
for (const k of [...REQUIRED, "NODE_ENV"]) snapshot[k] = process.env[k];

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const VALID = {
  DATABASE_URL: "postgresql://u:p@h:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

describe("validateEnv", () => {
  afterEach(() => setEnv(snapshot));

  it("ครบทุกตัวที่จำเป็น → ไม่ throw", () => {
    setEnv(VALID);
    expect(() => validateEnv()).not.toThrow();
  });

  it("ขาดตัวจำเป็น (SUPABASE_SERVICE_ROLE_KEY) → throw + บอกชื่อที่ขาด", () => {
    setEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(() => validateEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("SUPABASE_URL ไม่ใช่ URL → throw", () => {
    setEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("ตัว recommended (CRON_SECRET) หายบน production → ไม่ throw (แค่เตือน)", () => {
    setEnv({ ...VALID, NODE_ENV: "production", CRON_SECRET: undefined });
    expect(() => validateEnv()).not.toThrow();
  });
});
