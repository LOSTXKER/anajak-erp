"use client";

import { useState, type MouseEvent } from "react";
import { ClipboardList, PackageCheck, Share2, Truck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrderOverviewTab, type OrderOverviewVariant } from "@/components/orders/detail/order-overview-tab";
import { OrderArtworkCardView } from "@/components/orders/detail/order-artwork-card";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { OrderNextStepAction, OrderNextStepGuidance } from "@/components/orders/detail/order-next-step-action";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { OrderPriceSummary } from "@/components/orders/new/order-price-summary";
import { OrderRevisions } from "@/components/orders/detail/order-revisions";
import { getFlowSteps } from "@/lib/order-status";
import { getOrderNextStep } from "@/lib/order-next-step";
import { ORDER_TAB_DEFS, tabForAnchor, type TabKey } from "@/lib/order-tabs";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { PREVIEW_ARTWORK, PREVIEW_FEES, PREVIEW_ITEMS, PREVIEW_ORDER, PREVIEW_ORDER_NUMBER, PREVIEW_PRICING } from "./_order-data";

export function UiResetOrder({ variant }: { variant: OrderOverviewVariant }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [feedback, setFeedback] = useState("");
  const showFeedback = (action: string) => setFeedback(`หน้าลอง: ${action} — ยังไม่ได้บันทึกหรือส่งข้อมูล`);
  const onAnchor = (target: Parameters<typeof tabForAnchor>[0]) => setTab(tabForAnchor(target) ?? "overview");
  const nextStep = getOrderNextStep({
    orderType: "CUSTOM", internalStatus: "DESIGNING", itemCount: 1, totalAmount: 5992,
    paymentTerms: "DEPOSIT_50", hasInvoice: true, hasPendingDesign: true, hasApprovedDesign: false,
    hasProduction: false, hasDelivery: false, billingHandled: false,
  });
  const flowSteps = getFlowSteps("CUSTOM");
  const rail = <OrderStatusBar flowSteps={flowSteps} currentStepIndex={flowSteps.indexOf("DESIGNING")} internalStatus="DESIGNING" customerStatus={PREVIEW_ORDER.customerStatus} />;
  const openFiles = () => setTab("files");
  const artwork = <OrderArtworkCardView variant={variant} latest={PREVIEW_ARTWORK} versionCount={2} rawCount={2} printCount={0} description={PREVIEW_ORDER.description} onOpenFiles={tab === "files" ? undefined : openFiles} />;
  const interceptLinks = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    showFeedback(link.textContent?.trim() || "เปิดลิงก์");
  };

  return (
    <div onClickCapture={interceptLinks} onAuxClickCapture={interceptLinks}>
      <PageShell title={PREVIEW_ORDER_NUMBER} titleBadge={<Badge variant="accent">กำลังเตรียมงาน</Badge>} action={
        <>
          <Button variant="outline" size="sm" onClick={() => showFeedback("เปิดใบสั่งงาน")}><ClipboardList />ใบสั่งงาน</Button>
          <Button variant="outline" size="sm" onClick={() => showFeedback("คัดลอกลิงก์ลูกค้า")}><Share2 />ลิงก์ลูกค้า</Button>
          <OrderNextStepAction nextStep={nextStep} readiness={null} isPending={false} onStatus={() => showFeedback("เปลี่ยนสถานะ")} onAnchor={onAnchor} canSeeMoney />
        </>
      }>
        {variant === "current" ? rail : (
          <details className="border-b border-divider pb-3">
            <summary className={`w-fit cursor-pointer rounded-lg py-2 text-sm text-secondary ${FOCUS_BUTTON}`}>กำลังออกแบบ · ดูเส้นทางออเดอร์</summary>
            <div className="pt-3">{rail}</div>
          </details>
        )}
        <OrderNextStepGuidance nextStep={nextStep} readiness={null} onAnchor={onAnchor} canSeeMoney />
        <Alert variant="warning" title="หมายเหตุใบนี้">{PREVIEW_ORDER.notes}</Alert>
        {feedback && <p role="status" className="text-sm text-secondary">{feedback}</p>}
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <TabsBar><TabsList aria-label="ส่วนของออเดอร์ตัวอย่าง">
            {ORDER_TAB_DEFS.map((item) => <TabsTrigger key={item.key} value={item.key}>{item.label}</TabsTrigger>)}
          </TabsList></TabsBar>
          <TabsContent value="overview" className="pt-6">
            <OrderOverviewTab variant={variant} order={PREVIEW_ORDER} showMoney totalAmount={5992} totalQuantity={30}
              onOpenMoney={() => setTab("money")} onOpenDelivery={() => setTab("delivery")}
              onEditInfo={(section) => showFeedback(section === "shipping" ? "แก้ไขที่อยู่จัดส่ง" : "แก้ไขข้อมูลออเดอร์")}
              onOpenCustomer={() => showFeedback("เปิดหน้าลูกค้า")} artwork={artwork}
              channelColor={{ bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300" }} isMarketplace={false}
            />
          </TabsContent>
          <TabsContent value="items" className="pt-6">
            <OrderItemsDisplay orderId={PREVIEW_ORDER.id} items={PREVIEW_ITEMS} fees={PREVIEW_FEES} showMoney canEditReceiveTracking={false}
              onEditItems={() => showFeedback("แก้ไขรายการงาน")} totals={{ discount: 0, taxRate: 7, taxAmount: 392, totalAmount: 5992 }} />
          </TabsContent>
          <TabsContent value="production" className="pt-6"><Section title="งานผลิต"><EmptyState icon={PackageCheck} title="ยังไม่เปิดใบผลิต" description="รอลูกค้าอนุมัติแบบ แล้วตรวจเงินและเสื้อก่อนเข้าคิวผลิต" /></Section></TabsContent>
          <TabsContent value="delivery" className="pt-6"><Section title="จัดส่ง"><EmptyState icon={Truck} title="ยังไม่ถึงขั้นจัดส่ง" description="ส่วนนี้จะเปิดเมื่อผลิตและตรวจนับเสร็จ" /></Section></TabsContent>
          <TabsContent value="money" className="pt-6">
            <OrderPriceSummary pricingSummary={PREVIEW_PRICING} showFeeSections isMarketplace={false} channelLabel="LINE" taxRate={7} platformFee={0} discount={0} />
          </TabsContent>
          <TabsContent value="files" className="pt-6">{artwork}</TabsContent>
          <TabsContent value="history" className="pt-6"><OrderRevisions revisions={[
            { id: "preview-revision-2", description: "ส่งม็อกอัพ v2 ให้ลูกค้าตรวจ", changedBy: "ดีไซเนอร์", changeType: "DESIGN", createdAt: "2026-09-11T09:20:00+07:00" },
            { id: "preview-revision-1", description: "เปิดออเดอร์ 30 ตัว", changedBy: "ฝ่ายขาย", changeType: "INFO", createdAt: PREVIEW_ORDER.createdAt },
          ]} /></TabsContent>
        </Tabs>
      </PageShell>
    </div>
  );
}
