import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type Context = {
  prisma: typeof prisma;
  userId: string | null;
  userRole: Role | null;
};

// Cache the dev user ID so we only query once
let cachedDevUserId: string | null = null;

async function getDevUserId(): Promise<string> {
  if (cachedDevUserId) return cachedDevUserId;
  const user = await prisma.user.findFirst({ where: { role: "OWNER" } });
  cachedDevUserId = user?.id ?? "dev-user";
  return cachedDevUserId;
}

export async function createContext(): Promise<Context> {
  // In a real app, extract user from Supabase auth session
  // For now, use the first OWNER user from the database for development
  const devUserId = await getDevUserId();
  return {
    prisma,
    userId: devUserId,
    userRole: "OWNER" as Role,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware: require authenticated user
const isAuthed = t.middleware(async ({ ctx, next }) => {
  // For development, resolve a real user ID from the database
  // In production, check Supabase auth
  const userId = ctx.userId ?? (await getDevUserId());
  return next({
    ctx: {
      ...ctx,
      userId,
      userRole: ctx.userRole ?? ("OWNER" as Role),
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware: require specific role
export function requireRole(...roles: Role[]) {
  return t.middleware(async ({ ctx, next }) => {
    const userRole = ctx.userRole ?? ("OWNER" as Role);
    if (!roles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้",
      });
    }
    const userId = ctx.userId ?? (await getDevUserId());
    return next({ ctx: { ...ctx, userId, userRole } });
  });
}
