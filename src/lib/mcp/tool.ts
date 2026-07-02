/**
 * MCP read-only tool helper (FLOW-REDESIGN ก้อน 5)
 *
 * registerReadTool ครอบทุก tool ให้ได้พฤติกรรมเดียวกัน:
 *  ① ดึง AgentContext จาก auth  ② gate role ต่อ tool (reuse Role เดิม)
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
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

// ชุดบทบาท — ใช้ร่วมทุก tool (gate + ซ่อน field เงิน)
export const ALL_ROLES: Role[] = [
  "OWNER",
  "MANAGER",
  "ACCOUNTANT",
  "PRODUCTION_STAFF",
  "DESIGNER",
  "SALES",
];
// นิยามกลุ่ม role การเงินย้ายไปที่กลาง src/lib/roles.ts (Gate A2 ใช้ร่วมกับ router หลัก)
// re-export คงชื่อเดิม — MCP tools ที่ import จากไฟล์นี้ไม่ต้องแก้
export {
  FINANCE_ROLES,
  ORDER_MONEY_ROLES,
  canSeeFinance,
  canSeeOrderMoney,
} from "@/lib/roles";

export function assertAgentRole(ctx: AgentContext, allowed: Role[]): void {
  if (!allowed.includes(ctx.userRole)) {
    throw new McpToolError(
      "FORBIDDEN",
      `บทบาท ${ctx.userRole} ไม่มีสิทธิ์ใช้เครื่องมือนี้ (ต้องเป็น ${allowed.join("/")})`
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
  allowedRoles: Role[]; // gate ต่อ tool
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
      assertAgentRole(ctx, config.allowedRoles);
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
