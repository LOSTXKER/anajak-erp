import { TRPCError } from "@trpc/server";

export function notFound(entity: string, id?: string): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: id
      ? `ไม่พบ${entity} (${id})`
      : `ไม่พบ${entity}`,
  });
}

export function forbidden(message = "คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้"): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

export function badRequest(message: string): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

export function conflict(message: string): never {
  throw new TRPCError({
    code: "CONFLICT",
    message,
  });
}

export function internal(message = "เกิดข้อผิดพลาดภายในระบบ"): never {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
}
