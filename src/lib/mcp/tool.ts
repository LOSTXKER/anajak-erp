/**
 * MCP read-only tool helper (FLOW-REDESIGN ก้อน 5)
 *
 * registerReadTool ครอบทุก tool ให้ได้พฤติกรรมเดียวกัน:
 *  ① ดึง AgentContext จาก auth  ② gate สิทธิ์ต่อ tool ผ่าน hasPermission (PERM — default ตาม role
 *     ตรงชุด role เดิมเป๊ะ + override รายคนจาก /settings/users มีผลบน MCP key ด้วย)
 *  ③ audit call ที่ผ่าน auth+schema ลง AgentCallLog (สำเร็จ/ล้ม + เวลา) — call ที่โดน 401/args ผิด schema
 *     ถูกปัดที่ gateway ก่อนถึง wrapper นี้  ④ จับ error → ข้อความอ่านง่าย (ไม่ throw หลุด)
 *  ⑤ format ผลเป็น JSON text (MCP content)
 */

import { z } from "zod";
import type { ZodRawShape } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";
import { getAgentContext, type AgentContext } from "./auth";

export type McpErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_INPUT"
  | "UNAVAILABLE" // ระบบปลายทางไม่พร้อม (เช่น ยังไม่ต่อท่อ Stock)
  | "INTERNAL";

// error ที่ตั้งใจให้ผู้ใช้เห็น (มี code สำหรับ audit) — ต่างจาก error ระบบที่กลายเป็น INTERNAL
export class McpToolError extends Error {
  constructor(
    public code: McpErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

// จุดตัดสินสิทธิ์ของ MCP — ตัวเดียวกับด่าน tRPC (requirePermission/strip): default ตาม role
// + override รายคน · ใช้ทั้ง gate ต่อ tool และซ่อน field เงินใน handler
export function agentHasPermission(ctx: AgentContext, perm: Permission): boolean {
  return hasPermission(ctx.userRole, ctx.permissionOverrides, perm);
}

// gate ต่อ tool — ส่ง array = มีสิทธิ์ตัวใดตัวหนึ่งพอ (ตรง semantics permAllows ฝั่งจอ)
export function assertAgentPermission(
  ctx: AgentContext,
  required: Permission | Permission[]
): void {
  const list = Array.isArray(required) ? required : [required];
  if (!list.some((p) => agentHasPermission(ctx, p))) {
    throw new McpToolError(
      "FORBIDDEN",
      "คุณไม่มีสิทธิ์ใช้เครื่องมือนี้ — ให้เจ้าของปรับสิทธิ์ที่ ตั้งค่า → ผู้ใช้"
    );
  }
}

// audit ทุก call — ไม่ให้ความล้มเหลวของ log ทำ request พัง
async function logAgentCall(
  keyId: string,
  tool: string,
  ok: boolean,
  errorCode?: McpErrorCode,
  durationMs?: number
): Promise<void> {
  try {
    await prisma.agentCallLog.create({
      data: { keyId, tool, ok, errorCode: errorCode ?? null, durationMs: durationMs ?? null },
    });
  } catch (e) {
    console.error("[mcp] logAgentCall failed", e);
  }
}

export interface ReadToolConfig<S extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: S; // raw zod shape (ไม่ใช่ z.object) — ตาม mcp-handler
  // gate ต่อ tool: ไม่ระบุ = ทุกคนใช้ได้ · array = มีสิทธิ์ตัวใดตัวหนึ่งพอ
  requiredPermission?: Permission | Permission[];
  handler: (args: z.infer<z.ZodObject<S>>, ctx: AgentContext) => Promise<unknown>;
}

export function registerReadTool<S extends ZodRawShape>(
  server: McpServer,
  config: ReadToolConfig<S>
): void {
  // cast เป็น ToolCallback<S> — bridge generic ของ SDK (OutputArgs ไม่มี default + CallToolResult
  // มี index signature ทำให้ inference ของ union return เพี้ยน) · args/extra type ไว้เองให้ตรง
  const cb = (async (
    args: z.infer<z.ZodObject<S>>,
    extra: { authInfo?: AuthInfo }
  ): Promise<CallToolResult> => {
    const start = Date.now();
    let ctx: AgentContext | null = null;
    try {
      ctx = getAgentContext(extra?.authInfo);
      if (config.requiredPermission) assertAgentPermission(ctx, config.requiredPermission);
      const data = await config.handler(args, ctx);
      // await (logAgentCall กลืน error เองอยู่แล้ว) — กัน audit หายบน serverless ที่ freeze หลัง response
      await logAgentCall(ctx.keyId, config.name, true, undefined, Date.now() - start);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      const code: McpErrorCode = err instanceof McpToolError ? err.code : "INTERNAL";
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดภายใน";
      if (ctx) await logAgentCall(ctx.keyId, config.name, false, code, Date.now() - start);
      else console.error(`[mcp] ${config.name} auth/ctx error`, err);
      return {
        content: [{ type: "text" as const, text: `ผิดพลาด (${code}): ${message}` }],
        isError: true,
      };
    }
  }) as unknown as ToolCallback<S>;

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
    },
    cb
  );
}
