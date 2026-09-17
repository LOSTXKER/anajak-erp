"use client";

/**
 * /production/outsource — หน้า "ร้านนอก" (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16)
 *
 * ตารางใบส่งร้านเต็มกว้าง แยกคอลัมน์ ร้าน · งาน · ออเดอร์ · จำนวน · นัดรับกลับ · สถานะ · ปุ่ม (ไม่มีการ์ดรายชื่อร้าน — เบสเลือก)
 * ปุ่มของแต่ละแถวมาจาก availableCommands ที่ server ตัดสินต่อใบ (สิทธิ์ + สถานะ) — หน้าไม่ตัดสินเอง
 * รับของกลับ = นับผ่านใบตรวจรับก่อน แล้วค่อยเปลี่ยนสถานะ (มติเดิมของหน้าร้านนอกที่ถอดไป 09-02)
 * ไม่มีค่าจ้างร้านบนหน้านี้ (SPEC ห้ามช่องเงินใน flow ผลิต/outsource)
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Link2, PackageCheck, SearchX, Send, TriangleAlert, X } from "lucide-react";

import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { OUTSOURCE_STATUS_LABELS } from "@/lib/outsource-ui";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { formatDateShort } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { c, Callout, Empty } from "@/components/kit/kit";
import { Seg } from "@/components/kit/seg";
import { ProductionModuleHead } from "@/components/production/production-module-head";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { OutsourceShareDialog } from "@/components/outsource/outsource-share-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type OutsourceOrder = RouterOutput["outsource"]["listOrders"][number];
type SegKey = "open" | "draft" | "shop" | "late" | "check" | "done";

const AT_SHOP = new Set(["SENT", "IN_PROGRESS", "COMPLETED"]);
const DONE = new Set(["QC_PASSED", "QC_FAILED", "CANCELLED"]);
const STEP_OF: Record<string, number> = { DRAFT: 0, SENT: 1, IN_PROGRESS: 2, COMPLETED: 3, RECEIVED_BACK: 4, QC_PASSED: 4, QC_FAILED: 4 };

function v2CommandFields(order: OutsourceOrder) {
  return order.operationJobId && order.operationRevision !== null
    ? { commandId: crypto.randomUUID(), expectedRevision: order.operationRevision }
    : {};
}

function qcQuantityLines(order: OutsourceOrder, disposition: "PASS" | "REWORK" | "SCRAP") {
  if (!order.executionEnabled) return undefined;
  const allocated = order.quantityAllocations.reduce((sum, line) => sum + line.qty, 0);
  if (order.quantityAllocations.length === 0 || allocated !== order.quantity) return null;
  return order.quantityAllocations.map((line) => ({
    quantityLineId: line.quantityLineId,
    qtyGood: disposition === "PASS" ? line.qty : 0,
    qtyScrap: disposition === "SCRAP" ? line.qty : 0,
    qtyRework: disposition === "REWORK" ? line.qty : 0,
  }));
}

function workLabel(order: OutsourceOrder) {
  const step = order.productionStep;
  return order.description || step.customStepName || (STEP_TYPE_LABELS[step.stepType] ?? step.stepType).replace(" (ร้านนอก)", "");
}

function OutsourceList() {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.outsource.listOrders.useQuery({}, { refetchInterval: 60_000 });
  const orders = ordersQuery.data ?? [];
  const nowMs = ordersQuery.dataUpdatedAt || 0;
  const [seg, setSeg] = useState<SegKey>("open");
  const [failTarget, setFailTarget] = useState<string | null>(null);
  const [failNotes, setFailNotes] = useState("");
  const [failDisposition, setFailDisposition] = useState<"REWORK" | "SCRAP">("REWORK");
  const [receiveTarget, setReceiveTarget] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<string | null>(null);

  const updateStatus = useMutationWithInvalidation(trpc.outsource.updateOrderStatus, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId, utils.production.getById, utils.production.kanban],
    onSuccess: () => {
      setFailTarget(null);
      setFailNotes("");
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตไม่สำเร็จ"),
  });
  const cancelDraft = useMutationWithInvalidation(trpc.outsource.cancelDraftOrder, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId, utils.production.getById],
    onError: (err: { message?: string }) => toast.error(err.message ?? "ยกเลิกไม่สำเร็จ"),
  });

  const backIn = (order: OutsourceOrder) => (nowMs > 0 ? differenceInBangkokDays(order.expectedBackAt, nowMs) : null);
  const isLate = (order: OutsourceOrder) => AT_SHOP.has(order.status) && (backIn(order) ?? 0) < 0;
  const filters: Record<SegKey, (order: OutsourceOrder) => boolean> = {
    open: (order) => !DONE.has(order.status),
    draft: (order) => order.status === "DRAFT",
    shop: (order) => AT_SHOP.has(order.status),
    late: isLate,
    check: (order) => order.status === "RECEIVED_BACK",
    done: (order) => DONE.has(order.status),
  };
  const segOptions: { key: SegKey; label: string; count: number }[] = [
    { key: "open", label: "ยังไม่จบ", count: orders.filter(filters.open).length },
    { key: "draft", label: "รอส่ง", count: orders.filter(filters.draft).length },
    { key: "shop", label: "อยู่ที่ร้าน", count: orders.filter(filters.shop).length },
    { key: "late", label: "เลยนัดรับ", count: orders.filter(filters.late).length },
    { key: "check", label: "รอตรวจรับ", count: orders.filter(filters.check).length },
    { key: "done", label: "จบแล้ว", count: orders.filter(filters.done).length },
  ];
  const rows = orders.filter(filters[seg]);
  const stale = ordersQuery.isError && Boolean(ordersQuery.data);
  const find = (id: string | null) => (id ? (orders.find((order) => order.id === id) ?? null) : null);
  const failOrder = find(failTarget);
  const receiveOrder = find(receiveTarget);
  const shareOrder = find(shareTarget);

  function move(order: OutsourceOrder, status: "SENT" | "RECEIVED_BACK" | "QC_PASSED" | "QC_FAILED", options: { qcNotes?: string; disposition?: "REWORK" | "SCRAP" } = {}) {
    const quantityLines =
      status === "QC_PASSED" ? qcQuantityLines(order, "PASS") : status === "QC_FAILED" && options.disposition ? qcQuantityLines(order, options.disposition) : undefined;
    if (order.executionEnabled && (status === "QC_PASSED" || status === "QC_FAILED") && !quantityLines) {
      toast.error("ใบงานนี้ไม่มีจำนวนแยกตามรายการที่ครบถ้วน ให้หัวหน้าตรวจใบงาน");
      return;
    }
    updateStatus.mutate({ id: order.id, status, ...options, ...v2CommandFields(order), ...(quantityLines ? { quantityLines } : {}) });
  }

  // เคยนับผ่านใบตรวจรับแล้ว (เปลี่ยนสถานะรอบก่อนพลาด) → เปลี่ยนสถานะเลย · ยังไม่เคยนับ → เปิดใบตรวจรับ
  async function receiveBack(order: OutsourceOrder) {
    try {
      const receipts = await utils.goodsReceipt.listByOrder.fetch({ orderId: order.productionStep.production.orderId });
      if (receipts.some((r) => r.outsourceOrderId === order.id && r.receiptType === "OUTSOURCE_RETURN")) {
        move(order, "RECEIVED_BACK");
        return;
      }
    } catch {
      // อ่านใบตรวจรับไม่ได้ — เปิดฟอร์มนับตามปกติ
    }
    setReceiveTarget(order.id);
  }

  async function finishReceiveBack(id: string) {
    const fresh = await utils.outsource.listOrders.fetch({});
    const target = fresh.find((order) => order.id === id);
    if (!target) {
      toast.error("บันทึกใบรับแล้ว แต่โหลดใบงานร้านนอกล่าสุดไม่สำเร็จ");
      return;
    }
    move(target, "RECEIVED_BACK");
  }

  function dueCell(order: OutsourceOrder) {
    if (order.status === "RECEIVED_BACK" || DONE.has(order.status)) {
      return <span className={c("due n")}>{order.receivedAt ? `รับกลับ ${formatDateShort(order.receivedAt)}` : "รับกลับแล้ว"}</span>;
    }
    const days = backIn(order);
    if (!order.expectedBackAt || days === null) return <span className={c("due n")}>ยังไม่นัด</span>;
    if (days < 0) return <span className={c("due bad")}>เลยนัดรับ {-days} วัน</span>;
    if (days === 0) return <span className={c("due warn")}>นัดรับวันนี้</span>;
    return <span className={c("due n")}>{formatDateShort(order.expectedBackAt)}</span>;
  }

  function actions(order: OutsourceOrder) {
    const can = (command: string) => (order.availableCommands as string[]).includes(command) && !stale;
    const busy = updateStatus.isPending || cancelDraft.isPending;
    return (
      <div className={c("acell")}>
        {can("share") ? (
          <button type="button" className={c("btn sm icon")} onClick={() => setShareTarget(order.id)} aria-label={`ส่งลิงก์ใบงานให้ ${order.vendor.name}`} title="ส่งลิงก์ใบงานให้ร้าน">
            <Link2 aria-hidden="true" />
          </button>
        ) : null}
        {can("cancelDraft") ? (
          <button type="button" className={c("btn sm ghost")} disabled={busy} onClick={() => cancelDraft.mutate({ id: order.id, ...v2CommandFields(order) })}>
            ยกเลิกร่าง
          </button>
        ) : null}
        {can("markSent") ? (
          <button type="button" className={c("btn sm primary")} disabled={busy} onClick={() => move(order, "SENT")}>
            <Send aria-hidden="true" />
            ส่งร้านแล้ว
          </button>
        ) : null}
        {can("receiveBack") ? (
          <button type="button" className={c("btn sm", isLate(order) && "primary")} disabled={busy} onClick={() => void receiveBack(order)}>
            <PackageCheck aria-hidden="true" />
            รับของกลับ
          </button>
        ) : null}
        {can("failQc") ? (
          <button
            type="button"
            className={c("btn sm")}
            disabled={busy}
            onClick={() => {
              setFailNotes("");
              setFailDisposition("REWORK");
              setFailTarget(order.id);
            }}
          >
            <X aria-hidden="true" />
            ไม่ผ่าน
          </button>
        ) : null}
        {can("passQc") ? (
          <button type="button" className={c("btn sm primary")} disabled={busy} onClick={() => move(order, "QC_PASSED")}>
            <Check aria-hidden="true" />
            ผ่าน
          </button>
        ) : null}
        {order.availableCommands.length === 0 && order.blockedReason ? <span className={c("whoc none")}>{order.blockedReason}</span> : null}
      </div>
    );
  }

  return (
    <PageShell
      title="ร้านนอก"
      header={<div className="sr-only">ร้านนอก</div>}
      loading={ordersQuery.isLoading}
      skeleton={
        <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดใบส่งร้าน">
          <span className={c("sk")} style={{ height: 112 }} />
          <span className={c("sk")} style={{ height: 420 }} />
        </div>
      }
      error={ordersQuery.isError && !ordersQuery.data ? { message: "โหลดใบส่งร้านไม่สำเร็จ", onRetry: () => void ordersQuery.refetch() } : null}
    >
      <div className={c("tokens page mfg")}>
        {stale ? (
          <div className={c("alerts")}>
            <Callout icon={TriangleAlert} role="alert">
              <b>ข้อมูลล่าสุดอาจยังไม่ครบ</b> ปุ่มลงมือถูกซ่อนจนกว่าจะโหลดใหม่ได้
            </Callout>
          </div>
        ) : null}

        <ProductionModuleHead active="outsource" title="ร้านนอก" />

        <section className={c("card")} aria-label="ใบส่งร้าน">
          <div className={c("tools top")}>
            <Seg label="กรองตามสถานะ" options={segOptions} value={seg} onChange={setSeg} />
          </div>
          <div className={c("tblw list")}>
            <table className={c("orders outt")}>
              <caption className={c("sr")}>ใบส่งร้านนอก</caption>
              <colgroup>
                <col className={c("o-v")} />
                <col />
                <col className={c("o-o")} />
                <col className={c("o-q")} />
                <col className={c("o-d")} />
                <col className={c("o-s")} />
                <col className={c("o-a")} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">ร้าน</th>
                  <th scope="col">งาน</th>
                  <th scope="col">ออเดอร์</th>
                  <th scope="col" className={c("r")}>จำนวน</th>
                  <th scope="col">นัดรับกลับ</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col"><span className={c("sr")}>คำสั่ง</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const step = STEP_OF[order.status] ?? 0;
                  const sourceOrder = order.productionStep.production.order;
                  return (
                    <tr key={order.id} className={c("row")}>
                      <td>
                        <b className={c("ov")}>{order.vendor.name}</b>
                      </td>
                      <td>
                        <span className={c("ow")}>{workLabel(order)}</span>
                      </td>
                      <td>
                        <Link href={`/production/${order.productionStep.productionId}`} className={c("idbtn")} title={sourceOrder.customer.name} aria-label={`เปิดใบผลิต ${sourceOrder.orderNumber}`}>
                          <span className={c("mono")}>{sourceOrder.orderNumber}</span>
                        </Link>
                      </td>
                      <td className={c("qty r")}>
                        <b>{order.quantity.toLocaleString("th-TH")}</b>
                        <small>ตัว</small>
                      </td>
                      <td>{dueCell(order)}</td>
                      <td>
                        <div className={c("os")} aria-label={OUTSOURCE_STATUS_LABELS[order.status] ?? order.status}>
                          <span className={c("stflow")} aria-hidden="true">
                            {[1, 2, 3, 4].map((index) => (
                              <i key={index} className={c(order.status === "QC_FAILED" ? "bad" : order.status === "QC_PASSED" ? "g" : index <= step ? "d" : null)} />
                            ))}
                          </span>
                          <span>{OUTSOURCE_STATUS_LABELS[order.status] ?? order.status}</span>
                        </div>
                      </td>
                      <td>{actions(order)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 ? (
              /* กล่องว่างของชุดกลาง เหมือนหน้าอื่นทั้งเว็บ — เดิมวาด .noresult เอง */
              <Empty icon={SearchX} title="ไม่มีใบในกลุ่มนี้" />
            ) : null}
          </div>
          <ul className={c("ocards")}>
            {rows.map((order) => (
              <li key={order.id}>
                <div className={c("ocard")}>
                  <span className={c("l1")}>
                    <b>
                      {order.vendor.name} · {workLabel(order)}
                    </b>
                    {dueCell(order)}
                  </span>
                  <span className={c("l2")}>
                    <span className={c("mono")}>{order.productionStep.production.order.orderNumber}</span>
                    <span>{OUTSOURCE_STATUS_LABELS[order.status] ?? order.status}</span>
                    <span className={c("amt")}>{order.quantity.toLocaleString("th-TH")} ตัว</span>
                  </span>
                  {actions(order)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Dialog open={failOrder !== null && (failOrder.availableCommands as string[]).includes("failQc")} onOpenChange={(open) => !open && setFailTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ตรวจรับไม่ผ่าน</DialogTitle>
            <DialogDescription>ขั้นผลิตยังเปิดอยู่ ส่งแก้รอบใหม่ได้จากใบผลิต</DialogDescription>
          </DialogHeader>
          <Field label="ปัญหาที่พบ" required>
            <Textarea value={failNotes} onChange={(event) => setFailNotes(event.target.value)} rows={3} required placeholder="เช่น สีเพี้ยนจากแบบ 5 ตัว" />
          </Field>
          <Field label="จัดการงานที่ไม่ผ่าน" required>
            <Select value={failDisposition} onChange={(event) => setFailDisposition(event.target.value as "REWORK" | "SCRAP")}>
              <option value="REWORK">ส่งกลับแก้และตรวจซ้ำ</option>
              <option value="SCRAP">คัดทิ้ง</option>
            </Select>
          </Field>
          <DialogSubmitFooter
            pending={updateStatus.isPending}
            disabled={!failNotes.trim()}
            submitLabel="ยืนยันตรวจรับไม่ผ่าน"
            submitIcon={<X />}
            destructive
            onCancel={() => setFailTarget(null)}
            onSubmit={() => failOrder && move(failOrder, "QC_FAILED", { qcNotes: failNotes.trim(), disposition: failDisposition })}
          />
        </DialogContent>
      </Dialog>

      {shareOrder && (shareOrder.availableCommands as string[]).includes("share") && !stale ? (
        <OutsourceShareDialog
          job={{ id: shareOrder.id, description: shareOrder.description, quantity: shareOrder.quantity, expectedBackAt: shareOrder.expectedBackAt }}
          onClose={() => setShareTarget(null)}
        />
      ) : null}

      {receiveOrder && (receiveOrder.availableCommands as string[]).includes("receiveBack") && !stale ? (
        <GoodsReceiptDialog
          orderId={receiveOrder.productionStep.production.orderId}
          receiptType="OUTSOURCE_RETURN"
          outsourceOrderId={receiveOrder.id}
          presetLines={[{ description: receiveOrder.description, qtyExpected: receiveOrder.quantity }]}
          onCreated={() => void finishReceiveBack(receiveOrder.id)}
          onClose={() => setReceiveTarget(null)}
        />
      ) : null}
    </PageShell>
  );
}

export function OutsourcePage() {
  return (
    <Suspense fallback={null}>
      <OutsourceList />
    </Suspense>
  );
}
