"use client";

/**
 * ส่วนของหน้าใบงานที่ "ไม่ได้กำลังเทียบ" — ใช้ของจริงทั้งหมด ทุกทางได้ชุดเดียวกัน
 *   · แถบสถานะ (OrderStatusBar ตัวจริง)
 *   · แถบแท็บ 7 แท็บ (Tabs ตัวจริง)
 *   · แถบเตือนนอกแท็บ (ส่งแบบไม่ระบุผู้ส่ง · หมายเหตุใบนี้) — สูตร TINT ตัวจริง
 *   · ปุ่ม "ขั้นต่อไป" — เรียก getOrderNextStep() ตัวจริง ป้ายปุ่มจึงเป็นของจริง
 *
 * ตั้งใจให้เหมือนกันทุกทาง เพื่อให้สิ่งที่เบสเทียบคือ "หน้าตาของเนื้อหาในแท็บภาพรวม
 * กับหัวใบ" ไม่ใช่ของอย่างอื่นที่เปลี่ยนไปพร้อมกันจนแยกไม่ออกว่าชอบเพราะอะไร
 */

import { ClipboardList, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { OrderNextStepAction } from "@/components/orders/detail/order-next-step-action";
import { getOrderNextStep, type NextStep } from "@/lib/order-next-step";
import { getFlowSteps } from "@/lib/order-status";
import { ORDER_TAB_DEFS } from "@/lib/order-tabs";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import type { DemoOrder } from "./_data";
import { demoStatus, demoTotals } from "./_data";

/** ขั้นต่อไปของใบตัวอย่าง — ผ่านตรรกะจริง ไม่ได้เขียนป้ายปุ่มเอง */
export function protoNextStep(thin: boolean, showMoney: boolean): NextStep | null {
  const totals = demoTotals(thin);
  return getOrderNextStep({
    internalStatus: demoStatus(thin).internalStatus,
    orderType: "CUSTOM",
    itemCount: thin ? 0 : 4,
    totalAmount: showMoney ? totals.totalAmount : null,
    paymentTerms: thin ? null : "DEPOSIT_50",
    hasInvoice: !thin,
    hasPendingDesign: false,
    hasApprovedDesign: !thin,
    hasProduction: !thin,
    hasDelivery: false,
    billingHandled: false,
  });
}

export function ProtoNextStepButton({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  return (
    <OrderNextStepAction
      nextStep={protoNextStep(thin, showMoney)}
      readiness={null}
      isPending={false}
      onStatus={() => {}}
      onEditItems={() => {}}
      onAnchor={() => {}}
      canSeeMoney={showMoney}
    />
  );
}

/** ปุ่ม ⋯ ของจริงมีเมนู — ในหน้าลองเป็นปุ่มเปล่า (เมนูไม่ใช่สิ่งที่กำลังเทียบ) */
export function ProtoMoreButton() {
  return (
    <Button variant="outline" size="icon-sm" aria-label="เพิ่มเติม">
      <MoreHorizontal />
    </Button>
  );
}

/** CTA ที่ของจริงยกออกมาจากเมนู ⋯ แล้ว (เบสสั่ง 2026-08-30) — ใช้บ่อยจึงต้องเห็น */
export function ProtoQuickActions({ isSalesUp = true }: { isSalesUp?: boolean }) {
  return (
    <>
      <Button variant="outline" size="sm" aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
        <ClipboardList />
        <span className="hidden sm:inline">ใบสั่งงาน</span>
      </Button>
      {isSalesUp && (
        <Button variant="outline" size="sm" aria-label="คัดลอกลิงก์สถานะสำหรับลูกค้า">
          <Share2 />
          <span className="hidden sm:inline">ลิงก์ลูกค้า</span>
        </Button>
      )}
    </>
  );
}

export function ProtoStatusRail({ thin }: { thin: boolean }) {
  const status = demoStatus(thin);
  const flowSteps = getFlowSteps("CUSTOM");
  return (
    <OrderStatusBar
      flowSteps={flowSteps}
      currentStepIndex={flowSteps.indexOf(status.internalStatus as never)}
      internalStatus={status.internalStatus}
      customerStatus={status.customerStatus}
      revisions={[]}
      cancelledAt={null}
      cancelledReason={null}
      blockers={[]}
    />
  );
}

/** แถบที่อยู่ "นอกแท็บ" ของจริง — คนแพ็ค/ช่างต้องเห็นโดยไม่ต้องกลับมาแท็บภาพรวม */
export function ProtoNotices({ order }: { order: DemoOrder }) {
  return (
    <>
      {order.blindShip && (
        <div
          className={cn(
            TINT.warning,
            "flex flex-wrap gap-x-2 gap-y-1 rounded-lg border px-4 py-3 text-sm",
          )}
        >
          <span className="font-medium">ส่งแบบไม่ระบุผู้ส่ง</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            ชื่อผู้ส่งบนกล่อง:{" "}
            {order.blindShipSenderName || "ยังไม่ระบุ — ต้องกรอกก่อนแพ็ค"}
          </span>
        </div>
      )}
      {order.notes?.trim() && (
        <div
          className={cn(
            TINT.warning,
            "flex flex-wrap gap-x-2 gap-y-1 rounded-lg border px-4 py-3 text-sm",
          )}
        >
          <span className="font-medium">หมายเหตุใบนี้</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{order.notes}</span>
        </div>
      )}
    </>
  );
}

/** แถบแท็บของจริง — ล็อกที่ "ภาพรวม" เพราะเป็นแท็บเดียวที่หน้าลองนี้วาด */
export function ProtoTabBar({
  showMoney,
  pendingTab,
}: {
  showMoney: boolean;
  pendingTab?: string | null;
}) {
  const tabs = ORDER_TAB_DEFS.filter((t) => t.key !== "money" || showMoney);
  return (
    <Tabs value="overview">
      <TabsBar className="!static">
        <TabsList aria-label="ส่วนของออเดอร์">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              hasPending={t.key === pendingTab}
              // หน้าลองวาดแค่แท็บภาพรวม — แท็บอื่นจึงกดไม่ได้ (เขียนบอกไว้บนหน้ารวมแล้ว)
              disabled={t.key !== "overview"}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </TabsBar>
    </Tabs>
  );
}
