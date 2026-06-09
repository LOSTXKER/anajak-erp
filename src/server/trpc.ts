import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/supabase-server";
import type { Role } from "@prisma/client";

export type Context = {
  prisma: typeof prisma;
  userId: string | null;
  userRole: Role | null;
};

export async function createContext(): Promise<Context> {
  // fail closed เฉพาะฝั่ง auth: Supabase ล่ม = ไม่มี session ไม่ใช่หลุดเป็น OWNER
  // ส่วน DB error ปล่อย throw ให้เป็น 500 — ไม่กลืนเป็น 401 หลอกว่าโดน logout
  let sessionUser = null;
  try {
    sessionUser = await getServerSession();
  } catch (error) {
    console.error("createContext: getServerSession failed", error);
  }

  if (sessionUser?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: sessionUser.id },
      select: { id: true, role: true, isActive: true },
    });
    if (dbUser?.isActive) {
      return { prisma, userId: dbUser.id, userRole: dbUser.role };
    }
  }
  return { prisma, userId: null, userRole: null };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware: require authenticated user
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.userRole) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "กรุณาเข้าสู่ระบบ",
    });
  }
  return next({
    ctx: { ...ctx, userId: ctx.userId, userRole: ctx.userRole },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware: require specific role
export function requireRole(...roles: Role[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.userId || !ctx.userRole) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "กรุณาเข้าสู่ระบบ",
      });
    }
    if (!roles.includes(ctx.userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้",
      });
    }
    return next({
      ctx: { ...ctx, userId: ctx.userId, userRole: ctx.userRole },
    });
  });
}
