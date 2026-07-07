/**
 * MCP tool: stock_check — เช็คสต๊อค (FLOW-REDESIGN ก้อน 5)
 *
 * proxy ไป Anajak Stock app (read-only) ผ่าน StockApiClient — ยอดสด availableQty/reservedQty
 *  - ระบุ sku → เช็คสินค้า/variant รายตัว
 *  - else → ยอดคงเหลือ (เลือก lowStockOnly เพื่อดูเฉพาะของใกล้หมด)
 *
 * อ่านอย่างเดียว — เรียกเฉพาะ getStock/getProductBySku · ห้ามแตะ movement/reservation (write)
 * ยังไม่ตั้งค่าเชื่อม Stock → ตอบ UNAVAILABLE (ไม่พังเงียบ)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStockClientFromSettings, StockApiError } from "@/lib/stock-api";
import { registerReadTool, McpToolError } from "../tool";

export function registerStockCheckTool(server: McpServer): void {
  registerReadTool(server, {
    name: "stock_check",
    title: "เช็คสต๊อค",
    description:
      "เช็คยอดสต๊อคสดจากระบบคลัง (Anajak Stock) — ระบุ sku เพื่อดูรายตัว, " +
      "หรือเว้นว่าง/ตั้ง lowStockOnly เพื่อดูยอดคงเหลือ (คงเหลือ/จองค้าง/หยิบได้)",
    // เดิม STOCK_ROLES = OWNER/MANAGER/PRODUCTION_STAFF/SALES — แตกเป็นสิทธิ์ตามเหตุผลเดิม:
    // ช่างเบิกของ (manage_production) + ขายเช็คของก่อนรับงาน (create_sales_docs)
    // union ของ default สองตัว = 4 role เดิมเป๊ะ · ตัวใดตัวหนึ่งพอ + override รายคนมีผล
    requiredPermission: ["manage_production", "create_sales_docs"],
    inputSchema: {
      sku: z.string().trim().optional().describe("รหัส SKU ของสินค้าหรือ variant"),
      search: z.string().trim().optional().describe("(ไม่บังคับ) ใช้ร่วม sku ไม่ได้ — ปัจจุบันรองรับ sku ตรงตัว"),
      lowStockOnly: z.boolean().optional().describe("แสดงเฉพาะของใกล้หมด"),
      limit: z.number().int().min(1).max(100).optional().describe("จำนวนรายการสูงสุด (ดีฟอลต์ 30)"),
    },
    handler: async (args) => {
      const client = await getStockClientFromSettings();
      if (!client) {
        throw new McpToolError(
          "UNAVAILABLE",
          "ยังไม่ได้ตั้งค่าเชื่อมระบบคลัง (Settings → Stock) — เช็คสต๊อคไม่ได้"
        );
      }

      try {
        // ── รายตัวตาม SKU ──
        if (args.sku) {
          const product = await client.getProductBySku(args.sku);
          if (!product) {
            throw new McpToolError("NOT_FOUND", `ไม่พบสินค้า SKU ${args.sku} ในคลัง`);
          }
          return {
            sku: product.sku,
            name: product.name,
            totalStock: product.totalStock,
            reorderPoint: product.reorderPoint,
            variants: product.variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              totalStock: v.totalStock,
              options: v.options,
            })),
          };
        }

        // ── ยอดคงเหลือรวม ──
        const limit = args.limit ?? 30;
        const res = await client.getStock({ low_stock: args.lowStockOnly, limit });
        return {
          summary: res.data.summary, // { totalItems, lowStockCount, totalQty }
          items: res.data.items.map((it) => ({
            sku: it.variantSku || it.productSku,
            name: it.variantName || it.productName,
            location: it.locationName,
            qty: it.qty,
            reserved: it.reservedQty,
            available: it.availableQty,
            isLowStock: it.isLowStock,
          })),
          note: "ยอดสด ณ ตอนนี้จากระบบคลัง",
        };
      } catch (err) {
        if (err instanceof McpToolError) throw err;
        if (err instanceof StockApiError) {
          throw new McpToolError("UNAVAILABLE", `ระบบคลังตอบกลับผิดพลาด: ${err.message}`);
        }
        throw err;
      }
    },
  });
}
