import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requirePermission } from "../trpc";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";
import { COST_RATES_KEY, parseCostRates } from "@/lib/cost-rates";
import { estimateOrderMargin } from "@/server/services/margin-estimate";

const adminOnly = requirePermission("manage_settings");
// เรตต้นทุน/กำไรขั้นต้น = ข้อมูลเงิน — จำกัดฝั่งบริหาร-บัญชี (RBAC §7 ห้ามรั่วถึงขาย/ช่าง)
const financeRoles = requirePermission("see_finance");

export const settingsRouter = router({
  // ช่องทางกู้คืนของลิงก์ลูกค้าที่เสีย/หมดอายุ — เผยเฉพาะข้อมูลติดต่อที่ตั้งใจใช้สาธารณะ
  // ห้ามคืน address/taxId/branch เพราะ endpoint นี้ไม่ต้อง login
  publicContact: publicProcedure.query(async ({ ctx }) => {
    const setting = await ctx.prisma.setting.findUnique({
      where: { key: COMPANY_PROFILE_KEY },
    });
    const profile = parseCompanyProfile(setting?.value);
    return {
      name: profile.name || "Anajak Print",
      phone: profile.phone || null,
      email: profile.email || null,
    };
  }),

  // ข้อมูลกิจการ — ทุก role อ่านได้ (ใช้บนหัวเอกสารพิมพ์) · แก้ได้เฉพาะ OWNER/MANAGER
  companyProfile: protectedProcedure.query(async ({ ctx }) => {
    const setting = await ctx.prisma.setting.findUnique({
      where: { key: COMPANY_PROFILE_KEY },
    });
    return parseCompanyProfile(setting?.value);
  }),

  setCompanyProfile: protectedProcedure
    .use(adminOnly)
    .input(
      z.object({
        name: z.string().min(1, "กรุณากรอกชื่อกิจการ"),
        address: z.string().min(1, "กรุณากรอกที่อยู่"),
        taxId: z.string().regex(/^\d{13}$/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"),
        branch: z.string().min(1),
        phone: z.string().default(""),
        email: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.upsert({
        where: { key: COMPANY_PROFILE_KEY },
        update: { value: JSON.stringify(input) },
        create: { key: COMPANY_PROFILE_KEY, value: JSON.stringify(input) },
      });
      return { success: true };
    }),

  // เรตต้นทุนกลาง (FLOW-REDESIGN ก้อน 2) — เข็มทิศกำไรขั้นต้นตอนตีราคา
  costRates: protectedProcedure.use(financeRoles).query(async ({ ctx }) => {
    const setting = await ctx.prisma.setting.findUnique({ where: { key: COST_RATES_KEY } });
    return parseCostRates(setting?.value);
  }),

  // กำไรขั้นต้นโดยประมาณตอนตีราคา — เข็มทิศ ไม่บันทึกลงออเดอร์ (ก้อน 2 ชิ้น 5b)
  // gate การเงิน: ตัวเลขทุน/กำไรห้ามรั่วถึงขาย/ช่าง (UI เรียกแบบ retry:false ซ่อนเมื่อ FORBIDDEN)
  estimateMargin: protectedProcedure
    .use(financeRoles)
    .input(
      z.object({
        revenue: z.number().min(0),
        items: z
          .array(
            z.object({
              products: z.array(
                z.object({
                  productId: z.string().nullish(),
                  itemSource: z.string().nullish(),
                  variants: z.array(
                    z.object({
                      size: z.string().default(""),
                      color: z.string().default(""),
                      quantity: z.number().default(0),
                    })
                  ),
                })
              ),
              prints: z.array(
                z.object({
                  widthCm: z.number().nullish(),
                  heightCm: z.number().nullish(),
                })
              ),
            })
          )
          .max(100),
      })
    )
    .query(({ ctx, input }) => estimateOrderMargin(ctx.prisma, input)),

  setCostRates: protectedProcedure
    .use(adminOnly)
    .input(
      z.object({
        filmRatePerMeter: z.number().min(0),
        filmRollWidthCm: z.number().positive(),
        laborPerPiece: z.number().min(0),
        overheadPerPiece: z.number().min(0),
        costDeviationAlertPct: z.number().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.upsert({
        where: { key: COST_RATES_KEY },
        update: { value: JSON.stringify(input) },
        create: { key: COST_RATES_KEY, value: JSON.stringify(input) },
      });
      return { success: true };
    }),

  get: protectedProcedure
    .use(adminOnly)
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.setting.findUnique({
        where: { key: input.key },
      });
      return setting ? setting.value : null;
    }),

  getMany: protectedProcedure
    .use(adminOnly)
    .input(z.object({ keys: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.prisma.setting.findMany({
        where: { key: { in: input.keys } },
      });
      const map: Record<string, string> = {};
      for (const s of settings) {
        map[s.key] = s.value;
      }
      return map;
    }),

  set: protectedProcedure
    .use(adminOnly)
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.upsert({
        where: { key: input.key },
        update: { value: input.value },
        create: { key: input.key, value: input.value },
      });
      return { success: true };
    }),

  setMany: protectedProcedure
    .use(adminOnly)
    .input(z.object({ settings: z.array(z.object({ key: z.string(), value: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      for (const s of input.settings) {
        await ctx.prisma.setting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        });
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .use(adminOnly)
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.deleteMany({
        where: { key: input.key },
      });
      return { success: true };
    }),
});
