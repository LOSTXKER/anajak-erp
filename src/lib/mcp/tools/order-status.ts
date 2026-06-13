/**
 * MCP tool: order_status — สถานะออเดอร์ (FLOW-REDESIGN ก้อน 5)
 *
 * โหมด:
 *  - ระบุ orderNumber → ใบเดียว พร้อม "ติดอะไร รอใคร" (readiness)
 *  - ระบุ search (ชื่อลูกค้า/ชื่องาน) → รายการที่ตรง (ทุกสถานะ)
 *  - ไม่ระบุ → ออเดอร์ที่ยัง active ล่าสุด
 *
 * กันรั่ว: allow-list select เท่านั้น — ไม่มี totalCost/profitMargin/platformFee/notes/token
 * ราคาขาย (totalAmount) แสดงเฉพาะ role ที่เห็นเงินออเดอร์ (ช่าง/กราฟิกไม่เห็น)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InternalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  INTERNAL_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
  getCustomerStatus,
  ORDER_TYPE_LABELS,
  CHANNEL_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { getOrdersReadiness } from "@/server/services/production-readiness";
import { registerReadTool, ALL_ROLES, canSeeOrderMoney, McpToolError } from "../tool";
import type { AgentContext } from "../auth";

// allow-list — ห้ามมี cost/profit/platformFee/notes/token (extended client แปลง cost เป็น number อัตโนมัติ
// ถ้าเผลอ select = รั่วทันที) · totalAmount เก็บไว้แล้วค่อยตัดทิ้งตาม role ตอน map
const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  title: true,
  orderType: true,
  channel: true,
  priority: true,
  internalStatus: true,
  customerStatus: true,
  deadline: true,
  paymentTerms: true,
  totalAmount: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true, company: true } },
} as const;

type OrderRow = {
  id: string;
  orderNumber: string;
  title: string;
  orderType: string;
  channel: string;
  priority: string;
  internalStatus: InternalStatus;
  customerStatus: string;
  deadline: Date | null;
  paymentTerms: string | null;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string; company: string | null };
};

function formatOrder(o: OrderRow, ctx: AgentContext) {
  return {
    orderNumber: o.orderNumber,
    title: o.title,
    customer: o.customer.company || o.customer.name,
    type: ORDER_TYPE_LABELS[o.orderType as keyof typeof ORDER_TYPE_LABELS] ?? o.orderType,
    channel: CHANNEL_LABELS[o.channel] ?? o.channel,
    priority: PRIORITY_LABELS[o.priority] ?? o.priority,
    status: INTERNAL_STATUS_LABELS[o.internalStatus],
    customerFacingStatus: CUSTOMER_STATUS_LABELS[getCustomerStatus(o.internalStatus)],
    deadline: o.deadline,
    paymentTerms: o.paymentTerms,
    ...(canSeeOrderMoney(ctx.userRole) ? { totalAmount: o.totalAmount } : {}),
    createdAt: o.createdAt,
  };
}

export function registerOrderStatusTool(server: McpServer): void {
  registerReadTool(server, {
    name: "order_status",
    title: "สถานะออเดอร์",
    description:
      "ดูสถานะออเดอร์ของโรงงาน — ระบุ orderNumber เพื่อดูใบเดียวพร้อม 'ติดอะไร รอใคร', " +
      "ระบุ search (ชื่อลูกค้า/ชื่องาน) เพื่อค้นหา, หรือเว้นว่างเพื่อดูงานที่ยังทำอยู่ล่าสุด",
    allowedRoles: ALL_ROLES,
    inputSchema: {
      orderNumber: z.string().trim().optional().describe("เลขออเดอร์ เช่น ORD-2606-0024"),
      search: z.string().trim().optional().describe("คำค้นชื่อลูกค้าหรือชื่องาน"),
      limit: z.number().int().min(1).max(50).optional().describe("จำนวนรายการสูงสุด (ดีฟอลต์ 10)"),
    },
    handler: async (args, ctx) => {
      const limit = args.limit ?? 10;

      // ── ใบเดียว: detail + readiness ──
      if (args.orderNumber) {
        const order = (await prisma.order.findUnique({
          where: { orderNumber: args.orderNumber },
          select: ORDER_SELECT,
        })) as OrderRow | null;
        if (!order) {
          throw new McpToolError("NOT_FOUND", `ไม่พบออเดอร์ ${args.orderNumber}`);
        }
        const readinessMap = await getOrdersReadiness(prisma, [order.id]);
        const readiness = readinessMap.get(order.id);
        return {
          order: formatOrder(order, ctx),
          readiness: readiness
            ? {
                ready: readiness.ready,
                blockedBy: readiness.checks
                  .filter((c) => !c.ok)
                  .map((c) => ({
                    check: c.label,
                    // ช่อง payment ฝัง "รับแล้ว X/Y บาท" (+ % มัดจำใน label) → ถอดยอดออเดอร์กลับได้
                    // role ที่ไม่เห็นเงินออเดอร์ให้เห็นแค่ "รอใคร" (waitingOn) ไม่เห็นตัวเลข
                    detail:
                      c.key === "payment" && !canSeeOrderMoney(ctx.userRole)
                        ? c.waitingOn ?? c.detail
                        : c.detail,
                    waitingOn: c.waitingOn,
                  })),
              }
            : null,
        };
      }

      // ── ค้นหา / รายการ active ──
      const where = args.search
        ? {
            OR: [
              { title: { contains: args.search, mode: "insensitive" as const } },
              { customer: { name: { contains: args.search, mode: "insensitive" as const } } },
              { customer: { company: { contains: args.search, mode: "insensitive" as const } } },
            ],
          }
        : { internalStatus: { notIn: ["COMPLETED", "CANCELLED"] as InternalStatus[] } };

      const orders = (await prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: "desc" },
        take: limit,
      })) as OrderRow[];

      return {
        count: orders.length,
        mode: args.search ? "search" : "active",
        orders: orders.map((o) => formatOrder(o, ctx)),
      };
    },
  });
}
