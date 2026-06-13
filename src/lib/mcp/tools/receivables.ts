/**
 * MCP tool: receivables — ลูกหนี้ + ร่างข้อความทวง (FLOW-REDESIGN ก้อน 5)
 *
 *  - ไม่ระบุลูกค้า → รายงาน aging รวม (ใครค้างเท่าไร แยกถังอายุ)
 *  - ระบุลูกค้า → รายใบค้างของลูกค้า + (draft=true) ร่างข้อความทวงให้ "คนกดส่งเอง"
 *
 * ร่างทวง = surface ให้คนตัดสิน ไม่ยิงเอง (memory: bes-prefers-surface-over-autoenforce)
 * finance-only · กำกวมหลายราย = คืนรายชื่อให้เลือก (ไม่ทวงผิดคน)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import {
  loadAgingInvoices,
  buildAgingReport,
  loadReceivablesByCustomer,
  daysOverdue,
} from "@/server/services/receivables";
import { buildDunningDraft } from "@/server/services/dunning";
import { parseCompanyProfile, COMPANY_PROFILE_KEY } from "@/lib/company-profile";
import { registerReadTool, FINANCE_ROLES, McpToolError } from "../tool";

const round2 = (n: number): number => Math.round(n * 100) / 100;

async function loadOurCompany() {
  const s = await prisma.setting.findFirst({
    where: { key: COMPANY_PROFILE_KEY },
    select: { value: true }, // allow-list — Setting.value อาจมี secret ของ key อื่น (เลียน pattern กันรั่ว)
  });
  return parseCompanyProfile(s?.value);
}

export function registerReceivablesTool(server: McpServer): void {
  registerReadTool(server, {
    name: "receivables",
    title: "ลูกหนี้ + ร่างทวง",
    description:
      "ดูยอดลูกหนี้ค้างชำระ — เว้นว่างเพื่อดูภาพรวม aging (ใครค้างเท่าไร), " +
      "ระบุ customerName/customerId เพื่อดูรายใบของลูกค้า, ตั้ง draft=true เพื่อขอ 'ร่างข้อความทวง' " +
      "(ร่างให้ก๊อปส่งเอง ไม่ส่งอัตโนมัติ)",
    allowedRoles: FINANCE_ROLES,
    inputSchema: {
      customerId: z.string().trim().optional().describe("รหัสลูกค้า (ชัดเจนที่สุด)"),
      customerName: z.string().trim().optional().describe("ชื่อลูกค้า/บริษัท (ค้นหา)"),
      draft: z.boolean().optional().describe("true = ขอร่างข้อความทวง (ต้องระบุลูกค้า)"),
      tone: z.enum(["gentle", "firm"]).optional().describe("โทนข้อความทวง (ดีฟอลต์ gentle)"),
    },
    handler: async (args) => {
      // ── ระบุลูกค้า: รายใบ + ร่างทวง ──
      if (args.customerId || args.customerName) {
        let customer: { id: string; name: string; company: string | null } | null;
        if (args.customerId) {
          customer = await prisma.customer.findUnique({
            where: { id: args.customerId },
            select: { id: true, name: true, company: true },
          });
          if (!customer) throw new McpToolError("NOT_FOUND", `ไม่พบลูกค้า id ${args.customerId}`);
        } else {
          const matches = await prisma.customer.findMany({
            where: {
              OR: [
                { name: { contains: args.customerName!, mode: "insensitive" } },
                { company: { contains: args.customerName!, mode: "insensitive" } },
              ],
            },
            select: { id: true, name: true, company: true },
            take: 6,
          });
          if (matches.length === 0)
            throw new McpToolError("NOT_FOUND", `ไม่พบลูกค้า "${args.customerName}"`);
          if (matches.length > 1) {
            return {
              ambiguous: true,
              message: "พบลูกค้าหลายราย — ระบุ customerId ให้ชัดก่อนทวง",
              matches: matches.map((m) => ({ customerId: m.id, name: m.name, company: m.company })),
            };
          }
          customer = matches[0];
        }

        const rows = await loadReceivablesByCustomer(prisma, customer.id);
        const invoices = rows.map((r) => ({
          invoiceNumber: r.invoiceNumber,
          orderNumber: r.orderNumber,
          type: r.type,
          dueDate: r.dueDate,
          daysOverdue: daysOverdue(r.dueDate),
          outstanding: r.outstanding,
        }));
        const totalOutstanding = round2(invoices.reduce((s, r) => s + r.outstanding, 0));

        let draftMessage: string | null | undefined;
        if (args.draft) {
          if (invoices.length === 0) {
            draftMessage = null; // ไม่มีหนี้ค้าง — ไม่มีอะไรต้องทวง
          } else {
            const ourCompany = await loadOurCompany();
            const draft = buildDunningDraft({
              customerName: customer.name,
              company: customer.company,
              invoices,
              ourCompany: { name: ourCompany.name, phone: ourCompany.phone },
              tone: args.tone,
            });
            draftMessage = draft.text;
          }
        }

        return {
          customer: { name: customer.name, company: customer.company },
          invoiceCount: invoices.length,
          totalOutstanding,
          invoices,
          ...(args.draft ? { draftMessage } : {}),
        };
      }

      // ── ภาพรวม aging ──
      const report = buildAgingReport(await loadAgingInvoices(prisma));
      return {
        note: "ยอดลูกหนี้ค้างแยกถังอายุต่อลูกค้า (เรียงยอดมาก→น้อย)",
        grandTotal: report.grandTotal,
        totals: report.totals,
        agingByCustomer: report.rows,
      };
    },
  });
}
