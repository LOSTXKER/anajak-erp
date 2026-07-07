/**
 * MCP tool: today_queue — คิววันนี้ + งานเสี่ยงสาย (FLOW-REDESIGN ก้อน 5)
 *
 * ใช้ getOwnerPulse (service กลางที่จงใจทำไว้ให้ MCP เฟสแรก) เป็นตัวเลขสรุป
 * + รายการงานเสี่ยงสาย (เลยกำหนด/ใน 48 ชม.) พร้อม "ติดอะไร รอใคร" จาก readiness
 *
 * กันรั่ว: ตัวเลข money (บิลเลยกำหนด/ใบเสนอค้าง) แสดงเฉพาะคนมีสิทธิ์ see_finance
 * (default = role การเงิน เลียน analytics.dashboard · override รายคนมีผลด้วย)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InternalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { getOwnerPulse } from "@/server/services/owner-pulse";
import { getOrdersReadiness } from "@/server/services/production-readiness";
import { registerReadTool, agentHasPermission } from "../tool";

export function registerTodayQueueTool(server: McpServer): void {
  registerReadTool(server, {
    name: "today_queue",
    title: "คิววันนี้ + งานเสี่ยงสาย",
    description:
      "สรุปงานของโรงงานวันนี้ — งานเสี่ยงเลยกำหนด, คิวผลิตวันนี้, ของค้างร้านนอก, งานติดหล่ม " +
      "และรายการงานเสี่ยงสายพร้อมเหตุที่ติด (รอเงิน/รอแบบ/รอของ)",
    // ไม่ gate — คิวงานเปิดทุกคนเหมือนเดิม (เงินตัดตามสิทธิ์ข้างล่าง)
    inputSchema: {
      riskLimit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("จำนวนรายการงานเสี่ยงสายสูงสุด (ดีฟอลต์ 10)"),
    },
    handler: async (args, ctx) => {
      const riskLimit = args.riskLimit ?? 10;
      const pulse = await getOwnerPulse(prisma);

      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const riskOrders = await prisma.order.findMany({
        where: {
          internalStatus: { notIn: ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"] as InternalStatus[] },
          deadline: { lte: in48h }, // เลยกำหนดแล้ว + จะถึงใน 48 ชม. (null deadline = ไม่นับ)
        },
        select: {
          id: true,
          orderNumber: true,
          title: true,
          deadline: true,
          internalStatus: true,
          customer: { select: { name: true, company: true } },
        },
        orderBy: { deadline: "asc" },
        take: riskLimit,
      });

      const readiness = await getOrdersReadiness(
        prisma,
        riskOrders.map((o) => o.id)
      );

      return {
        summary: {
          atRiskOrders: pulse.atRiskOrders, // { overdue, dueSoon }
          todayQueue: pulse.todayQueue, // { done, open }
          outsource: pulse.outsource, // { pending, overduePickup }
          stuckOrders: pulse.stuckOrders,
          ...(agentHasPermission(ctx, "see_finance") ? { money: pulse.money } : {}),
        },
        riskOrders: riskOrders.map((o) => {
          const r = readiness.get(o.id);
          return {
            orderNumber: o.orderNumber,
            title: o.title,
            customer: o.customer.company || o.customer.name,
            deadline: o.deadline,
            overdue: o.deadline ? o.deadline < now : false,
            status: INTERNAL_STATUS_LABELS[o.internalStatus],
            blockedBy: r
              ? r.checks.filter((c) => !c.ok).map((c) => c.waitingOn ?? c.detail)
              : [],
          };
        }),
      };
    },
  });
}
