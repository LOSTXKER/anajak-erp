import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { createAdminClient } from "@/lib/supabase-admin";
import { createAuditLog, assertAnotherActiveOwner } from "@/server/helpers";
import {
  parsePermissionOverrides,
  defaultPermissionsOf,
  effectivePermissions,
  NON_OVERRIDABLE_PERMISSIONS,
  type Permission,
  type PermissionOverrides,
} from "@/lib/permissions";

// manage_users ไม่รับ override (กันล็อคตัวเอง) = OWNER เท่านั้นเสมอ ตรงพฤติกรรมเดิม
const ownerOnly = requirePermission("manage_users");
const managerUp = requirePermission("supervise_operations");

const roleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "ACCOUNTANT",
  "PRODUCTION_STAFF",
  "DESIGNER",
  "SALES",
]);

export const userRouter = router({
  // ข้อมูลผู้ใช้ที่ login อยู่ — ใช้โดย user menu / layout
  // PERM4: แนบชุดสิทธิ์จริง (default ± override) — จอโชว์เมนู/ปุ่มจากชุดนี้ แหล่งเดียวกับด่าน server
  me: protectedProcedure.query(async ({ ctx }) => {
    const { permissionOverrides, ...user } = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        permissionOverrides: true,
      },
    });
    return { ...user, permissions: effectivePermissions(user.role, permissionOverrides) };
  }),

  // รายชื่อสำหรับมอบหมายงาน (id+ชื่อ+role) — หัวหน้าใช้เลือกคนรับผิดชอบ step ผลิต
  // (user.list เต็มเป็น ownerOnly — อันนี้ข้อมูลแคบพอให้ MANAGER ใช้ได้ · audit ข้อ 18)
  assignables: protectedProcedure.use(managerUp).query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    });
  }),

  list: protectedProcedure.use(ownerOnly).query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissionOverrides: true,
        isActive: true,
        createdAt: true,
      },
    });
  }),

  // สร้างพนักงานใหม่: สร้าง Supabase auth user + User record ผูก supabaseId
  create: protectedProcedure
    .use(ownerOnly)
    .input(
      z.object({
        email: z.string().email("อีเมลไม่ถูกต้อง"),
        name: z.string().min(1, "กรุณากรอกชื่อ"),
        role: roleSchema,
        password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "มีผู้ใช้อีเมลนี้อยู่แล้ว",
        });
      }

      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `สร้างบัญชีไม่สำเร็จ: ${error?.message ?? "unknown"}`,
        });
      }

      try {
        // user + audit ใน transaction เดียว — กัน audit fail แล้ว rollback ลบ auth user
        // ทั้งที่ User row ค้างใน DB (จะได้บัญชีที่ login ไม่ได้ตลอดกาล)
        return await ctx.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              supabaseId: data.user.id,
              email: input.email,
              name: input.name,
              role: input.role,
            },
          });
          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "USER",
            entityId: user.id,
            newValue: { email: input.email, name: input.name, role: input.role },
          });
          return user;
        });
      } catch (dbError) {
        // DB สร้างไม่สำเร็จ → ลบ auth user ทิ้ง ไม่ให้ค้างเป็นบัญชีกำพร้า
        const { error: deleteError } = await admin.auth.admin.deleteUser(
          data.user.id
        );
        if (deleteError) {
          console.error(
            `user.create: rollback auth user ${data.user.id} ไม่สำเร็จ — ต้องลบมือใน Supabase dashboard:`,
            deleteError.message
          );
        }
        throw dbError;
      }
    }),

  update: protectedProcedure
    .use(ownerOnly)
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: roleSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role && input.id === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "เปลี่ยน role ของตัวเองไม่ได้ — กันล็อกตัวเองออกจากระบบ",
        });
      }
      const before = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.id },
        select: { name: true, role: true, isActive: true, permissionOverrides: true },
      });
      // invariant: ลด role ของ OWNER ที่ยัง active → ต้องมี OWNER active คนอื่นเหลือ
      if (input.role && input.role !== "OWNER" && before.role === "OWNER" && before.isActive) {
        await assertAnotherActiveOwner(
          ctx.prisma,
          input.id,
          "เปลี่ยนตำแหน่งไม่ได้ — ระบบต้องเหลือเจ้าของที่ใช้งานอยู่อย่างน้อย 1 คน"
        );
      }
      // PERM5 (review จับ least-privilege): เปลี่ยน role → normalize override เทียบ default ใหม่
      // (ตัด entry ที่บังเอิญเท่ากับ default ของ role ใหม่) — กัน demote แล้วสิทธิ์ที่เคยให้ค้าง
      // เงียบๆ · override ที่ยังต่างจาก default ใหม่ยังอยู่ (เจตนา: สิทธิ์ติดตัวคน) แต่โผล่ใน audit
      const roleChanged = input.role != null && input.role !== before.role;
      let normalizedOverrides: PermissionOverrides | undefined;
      if (roleChanged) {
        const parsed = parsePermissionOverrides(before.permissionOverrides);
        const newDefaults = defaultPermissionsOf(input.role!);
        normalizedOverrides = {};
        for (const [k, v] of Object.entries(parsed) as [Permission, boolean][]) {
          if (NON_OVERRIDABLE_PERMISSIONS.includes(k)) continue;
          if (v !== newDefaults.includes(k)) normalizedOverrides[k] = v;
        }
      }
      const user = await ctx.prisma.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          role: input.role,
          ...(roleChanged ? { permissionOverrides: normalizedOverrides } : {}),
        },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        oldValue: {
          name: before.name,
          role: before.role,
          ...(roleChanged ? { permissionOverrides: before.permissionOverrides } : {}),
        },
        newValue: {
          name: user.name,
          role: user.role,
          ...(roleChanged ? { permissionOverrides: normalizedOverrides } : {}),
        },
      });
      return user;
    }),

  setActive: protectedProcedure
    .use(ownerOnly)
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ปิดบัญชีตัวเองไม่ได้",
        });
      }
      // invariant: ปิดบัญชี OWNER ที่ยัง active → ต้องมี OWNER active คนอื่นเหลือ
      if (!input.isActive) {
        const target = await ctx.prisma.user.findUniqueOrThrow({
          where: { id: input.id },
          select: { role: true, isActive: true },
        });
        if (target.role === "OWNER" && target.isActive) {
          await assertAnotherActiveOwner(
            ctx.prisma,
            input.id,
            "ปิดบัญชีไม่ได้ — ระบบต้องเหลือเจ้าของที่ใช้งานอยู่อย่างน้อย 1 คน"
          );
        }
      }
      const user = await ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      // แบน/ปลดแบนฝั่ง Supabase ด้วย — ตัด session ที่ login ค้างอยู่ทันที
      // (ลำพัง isActive ใน DB กันได้แค่ tRPC layer แต่ middleware ยังเห็น session valid)
      const admin = createAdminClient();
      const { error: banError } = await admin.auth.admin.updateUserById(
        user.supabaseId,
        { ban_duration: input.isActive ? "none" : "876600h" }
      );
      if (banError) {
        console.error(
          `user.setActive: อัปเดต ban ฝั่ง Supabase ไม่สำเร็จ (${user.email}):`,
          banError.message
        );
      }
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        newValue: { isActive: input.isActive },
      });
      return user;
    }),

  // PERM2: ติ๊กสิทธิ์รายคนทับ default ของ role — เก็บเฉพาะคู่ที่ "ต่างจาก default" จริง
  // (override ติดตัวคน ไม่ผูก role: เปลี่ยน role แล้วที่เคยติ๊กไว้ยังมีผลต่อ — ตั้งใจ)
  setPermissions: protectedProcedure
    .use(ownerOnly)
    .input(
      z.object({
        id: z.string(),
        // UI ส่งเฉพาะคู่ที่ต่างจาก default มาแล้ว — server กรองซ้ำ (key แปลก/ห้าม override/เท่ากับ default)
        overrides: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "แก้สิทธิ์ของตัวเองไม่ได้ — กันลดสิทธิ์ตัวเองค้าง/เพิ่มสิทธิ์เองเงียบๆ",
        });
      }
      const before = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.id },
        select: { role: true, permissionOverrides: true },
      });
      const parsed = parsePermissionOverrides(input.overrides);
      const roleDefaults = defaultPermissionsOf(before.role);
      const normalized: PermissionOverrides = {};
      for (const [k, v] of Object.entries(parsed) as [Permission, boolean][]) {
        if (NON_OVERRIDABLE_PERMISSIONS.includes(k)) continue;
        if (v !== roleDefaults.includes(k)) normalized[k] = v;
      }
      const user = await ctx.prisma.user.update({
        where: { id: input.id },
        data: { permissionOverrides: normalized },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        oldValue: { permissionOverrides: before.permissionOverrides },
        newValue: { permissionOverrides: normalized },
        reason: "ปรับสิทธิ์รายคน",
      });
      return user;
    }),

  resetPassword: protectedProcedure
    .use(ownerOnly)
    .input(
      z.object({
        id: z.string(),
        password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true, supabaseId: true },
      });
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(user.supabaseId, {
        password: input.password,
      });
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `รีเซ็ตรหัสผ่านไม่สำเร็จ: ${error.message}`,
        });
      }
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        reason: "reset password",
      });
      return { success: true };
    }),
});
