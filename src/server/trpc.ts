import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "@/lib/superjson";
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

// zod ปฏิเสธ input → ข้อความไทยอ่านได้ ไม่ใช่ JSON ดิบภาษาอังกฤษ (audit ข้อ 2 —
// ผู้ใช้คือแอดมินไทย เจอ "too_small ... variants.0.quantity" = ติดตัน)
const ZOD_FIELD_LABELS: Record<string, string> = {
  quantity: "จำนวน",
  size: "ไซส์",
  baseUnitPrice: "ราคาต่อหน่วย",
  unitPrice: "ราคาต่อหน่วย",
  description: "คำอธิบาย",
  amount: "ยอดเงิน",
  discount: "ส่วนลด",
  taxRate: "อัตราภาษี",
  customerId: "ลูกค้า",
  title: "ชื่องาน",
  name: "ชื่อ",
  phone: "เบอร์โทร",
  email: "อีเมล",
  reason: "เหตุผล",
  products: "สินค้าในรายการ",
};

function thaiZodMessage(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const field = [...issue.path].reverse().find((p) => typeof p === "string");
      const label = (field && ZOD_FIELD_LABELS[field]) || field || "ข้อมูล";
      switch (issue.code) {
        case "too_small":
          return `${label}: ต้องไม่น้อยกว่า ${"minimum" in issue ? issue.minimum : "ที่กำหนด"}`;
        case "too_big":
          return `${label}: ต้องไม่เกิน ${"maximum" in issue ? issue.maximum : "ที่กำหนด"}`;
        case "invalid_type":
          return `${label}: รูปแบบข้อมูลไม่ถูกต้อง`;
        case "invalid_enum_value":
          return `${label}: ค่าไม่อยู่ในตัวเลือกที่ระบบรองรับ`;
        default:
          return `${label}: ${issue.message}`;
      }
    })
    .join(" · ");
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      return {
        ...shape,
        message: `ข้อมูลไม่ผ่านการตรวจสอบ — ${thaiZodMessage(error.cause)}`,
      };
    }
    return shape;
  },
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
