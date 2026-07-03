"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  DollarSign,
  AlertCircle,
  Hourglass,
  MessageSquare,
  Copy,
  Loader2,
} from "lucide-react";

const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];
type DunningTone = "gentle" | "firm";

// ลำดับ + ป้ายถังอายุหนี้ — ตรงกับ AGING_BUCKETS ใน services/receivables.ts
const BUCKETS = [
  { key: "current", label: "ยังไม่ครบกำหนด" },
  { key: "d1_30", label: "เลย 1-30 วัน" },
  { key: "d31_60", label: "เลย 31-60 วัน" },
  { key: "d61_90", label: "เลย 61-90 วัน" },
  { key: "d90plus", label: "เกิน 90 วัน" },
] as const;

export default function AgingPage() {
  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? FINANCE_ROLES.includes(me.role) : true;
  const { data, isLoading, isError, refetch } = trpc.billingNote.aging.useQuery(undefined, {
    enabled: canView,
  });

  // ร่างข้อความทวงต่อลูกค้า — ก๊อปส่งเอง (ไม่ยิงอัตโนมัติ) · โหลด draft เมื่อเลือกลูกค้า
  const [draftFor, setDraftFor] = useState<{ id: string; label: string } | null>(null);
  const [tone, setTone] = useState<DunningTone>("gentle");
  const draft = trpc.billingNote.dunningDraft.useQuery(
    { customerId: draftFor?.id ?? "", tone },
    { enabled: !!draftFor }
  );

  async function copyDraft(text: string) {
    // clipboard undefined บน insecure context (http LAN) — fallback textarea+execCommand
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = fallback();
    }
    toast.success(copied ? "คัดลอกข้อความแล้ว — วางส่งลูกค้าได้เลย" : "คัดลอกไม่สำเร็จ");
  }

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="ลูกหนี้ค้างชำระ" description="ยอดค้างแยกตามอายุหนี้" />
        <p className="text-sm text-slate-400">หน้านี้เปิดเฉพาะเจ้าของ ผู้จัดการ และบัญชี</p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  const overdueTotal = data
    ? data.totals.d1_30 + data.totals.d31_60 + data.totals.d61_90 + data.totals.d90plus
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลูกหนี้ค้างชำระ (Aging)"
        description="ยอดค้างต่อลูกค้า แยกตามอายุหนี้นับจากวันครบกำหนด"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ลูกหนี้" }]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ลูกหนี้รวม"
          value={formatCurrency(data?.grandTotal ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="เลยกำหนดแล้ว"
          value={formatCurrency(overdueTotal)}
          icon={AlertCircle}
        />
        <StatCard
          title="ยังไม่ครบกำหนด"
          value={formatCurrency(data?.totals.current ?? 0)}
          icon={Hourglass}
        />
        <StatCard title="ลูกหนี้" value={data?.rows.length ?? 0} icon={Users} caption="ราย" />
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            {BUCKETS.map((b) => (
              <DataTable.Th key={b.key} align="right">
                {b.label}
              </DataTable.Th>
            ))}
            <DataTable.Th align="right">รวม</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-16" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.rows.map((row) => (
            <DataTable.Row key={row.customerId}>
              <DataTable.Td>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/customers/${row.customerId}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.company ? `${row.company} (${row.name})` : row.name}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="ร่างข้อความทวง"
                    onClick={() => {
                      setTone("gentle");
                      setDraftFor({
                        id: row.customerId,
                        label: row.company ? `${row.company} (${row.name})` : row.name,
                      });
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </DataTable.Td>
              {BUCKETS.map((b) => (
                <DataTable.Td
                  key={b.key}
                  align="right"
                  className={`tabular-nums ${
                    row.buckets[b.key] === 0
                      ? "text-slate-300 dark:text-slate-600"
                      : b.key === "current"
                        ? ""
                        : "font-medium text-red-600 dark:text-red-400"
                  }`}
                >
                  {row.buckets[b.key] === 0 ? "—" : formatCurrency(row.buckets[b.key])}
                </DataTable.Td>
              ))}
              <DataTable.Td
                align="right"
                className="font-semibold tabular-nums text-slate-900 dark:text-white"
              >
                {formatCurrency(row.total)}
              </DataTable.Td>
            </DataTable.Row>
          ))}
          {!isLoading && data && data.rows.length > 0 && (
            <DataTable.Row>
              <DataTable.Td className="font-semibold">รวมทั้งหมด</DataTable.Td>
              {BUCKETS.map((b) => (
                <DataTable.Td key={b.key} align="right" className="font-semibold tabular-nums">
                  {data.totals[b.key] === 0 ? "—" : formatCurrency(data.totals[b.key])}
                </DataTable.Td>
              ))}
              <DataTable.Td align="right" className="font-semibold tabular-nums">
                {formatCurrency(data.grandTotal)}
              </DataTable.Td>
            </DataTable.Row>
          )}
          {!isLoading && data?.rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={Users}
                  title="ไม่มีลูกหนี้ค้างชำระ"
                  description="ใบแจ้งหนี้ทุกใบชำระครบแล้ว หรือยังไม่มีการวางบิล"
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>

      {/* ร่างข้อความทวงหนี้ — ก๊อปส่งเอง (ไม่ยิงอัตโนมัติ · เบสเลือก surface ให้คนตัดสิน) */}
      <Dialog open={draftFor !== null} onOpenChange={(open) => !open && setDraftFor(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ร่างข้อความทวง</DialogTitle>
            <DialogDescription>
              {draftFor?.label} — ตรวจข้อความก่อน คัดลอกไปส่งลูกค้าเอง (ระบบไม่ส่งอัตโนมัติ)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {(["gentle", "firm"] as const).map((t) => (
                <Button
                  key={t}
                  variant={tone === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTone(t)}
                >
                  {t === "gentle" ? "สุภาพ" : "หนักแน่น"}
                </Button>
              ))}
            </div>
            {draft.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังร่าง...
              </div>
            ) : draft.isError ? (
              <p className="py-8 text-center text-sm text-red-500">ร่างข้อความไม่สำเร็จ</p>
            ) : draft.data?.text ? (
              <>
                <Textarea
                  value={draft.data.text}
                  readOnly
                  rows={12}
                  className="font-mono text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {draft.data.invoiceCount} ใบ · ค้างรวม {formatCurrency(draft.data.totalOutstanding)}
                  </p>
                  <Button size="sm" className="gap-1.5" onClick={() => copyDraft(draft.data!.text!)}>
                    <Copy className="h-3.5 w-3.5" />
                    คัดลอกข้อความ
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                ลูกค้ารายนี้ไม่มียอดค้าง — ไม่มีอะไรต้องทวง
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
