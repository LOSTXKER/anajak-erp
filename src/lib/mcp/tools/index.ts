import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrderStatusTool } from "./order-status";
import { registerTodayQueueTool } from "./today-queue";
import { registerReceivablesTool } from "./receivables";
import { registerStockCheckTool } from "./stock-check";

/** ลงทะเบียน MCP read-only tools ทั้งหมด (ก้อน 5 เฟสแรก) */
export function registerAllTools(server: McpServer): void {
  registerOrderStatusTool(server); // สถานะออเดอร์
  registerTodayQueueTool(server); // คิววันนี้ + งานเสี่ยงสาย
  registerReceivablesTool(server); // ลูกหนี้ + ร่างทวง
  registerStockCheckTool(server); // เช็คสต๊อค
}
