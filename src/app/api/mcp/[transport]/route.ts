/**
 * MCP server endpoint (FLOW-REDESIGN ก้อน 5 — read-only เฟสแรก)
 *
 * embed ใน Next.js ผ่าน mcp-handler — เรียก service กลางตรง (reuse logic เดียวกับ tRPC)
 * auth: withMcpAuth + verifyAgentToken (API key → User → Role) · fail-closed (ไม่มี key = 401)
 * stateless Streamable HTTP — ไม่ต้อง Redis · รันบนเครื่อง (localhost) หรือ deploy Vercel ได้
 *
 * client เชื่อมที่: <origin>/api/mcp/mcp  (เช่น http://localhost:3000/api/mcp/mcp)
 * ส่ง API key ผ่าน Authorization: Bearer <key> หรือ X-API-Key: <key>
 */

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAllTools } from "@/lib/mcp/tools";
import { verifyAgentToken } from "@/lib/mcp/auth";

export const runtime = "nodejs"; // SDK/prisma ต้อง Node runtime (ไม่ใช่ edge)
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  {
    serverInfo: { name: "anajak-erp", version: "1.0.0" },
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
    disableSse: true, // ใช้แค่ stateless Streamable HTTP — ปิด SSE (กัน GET /api/mcp/sse ไปโดน Redis init ที่ไม่ได้ตั้ง)
  }
);

// required: true → ไม่มี/ผิด key = 401 ทันที (fail-closed เหมือน cron)
const authed = withMcpAuth(handler, verifyAgentToken, { required: true });

export { authed as GET, authed as POST };
