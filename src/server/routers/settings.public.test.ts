import { describe, expect, it } from "vitest";
import { settingsRouter } from "./settings";
import type { Context } from "../trpc";

describe("settings.publicContact", () => {
  it("ผู้ใช้ที่ไม่ login อ่านได้เฉพาะชื่อ เบอร์ และอีเมล", async () => {
    const ctx: Context = {
      prisma: {
        setting: {
          findUnique: async () => ({
            value: JSON.stringify({
              name: "Anajak Print",
              phone: "02-000-0000",
              email: "hello@example.com",
              address: "ข้อมูลที่ห้ามรั่ว",
              taxId: "1234567890123",
              branch: "สำนักงานใหญ่",
            }),
          }),
        },
      } as unknown as Context["prisma"],
      userId: null,
      userRole: null,
      permissionOverrides: null,
    };

    await expect(settingsRouter.createCaller(ctx).publicContact()).resolves.toEqual({
      name: "Anajak Print",
      phone: "02-000-0000",
      email: "hello@example.com",
    });
  });
});
