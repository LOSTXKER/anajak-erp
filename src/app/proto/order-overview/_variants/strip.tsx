"use client";

/**
 * A · แถบลายบนสุด — "เติมของที่ขาด ไม่รื้ออะไรเลย"
 *
 * เนื้อหาแท็บภาพรวมข้างล่างคือ `OrderOverviewTab` **ตัวจริง** ไม่ได้วาดใหม่แม้แต่ช่องเดียว
 * สิ่งเดียวที่เพิ่มคือการ์ด "ลายและไฟล์งาน" เต็มความกว้างวางไว้บนสุด
 * → เสี่ยงน้อยที่สุด (ของเดิมไม่ขยับเลย) แต่ก็ไม่ได้ทำให้หน้ากระชับขึ้น หน้ายาวขึ้นด้วยซ้ำ
 */

import { ArrowRight, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import { CHANNEL_COLORS, isMarketplaceChannel } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";

import { demoOrder, demoTotals } from "../../order-detail/_data";
import { demoMockups, demoPrintFiles, demoRawFiles } from "../_artwork";
import {
  ArtworkThumbRow,
  FileCountLine,
  MockupStatusBadge,
  NoMockupNote,
  SectionTitle,
} from "../_ui";

export function StripVariant({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const mockups = demoMockups(thin);
  const latest = mockups[0];
  const rawFiles = demoRawFiles(thin);
  const printFiles = demoPrintFiles(thin);

  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-secondary",
  };

  return (
    <div className="space-y-5">
      <Section
        compact
        title={<SectionTitle icon={Palette}>ลายและไฟล์งาน</SectionTitle>}
        action={
          <Button variant="ghost" size="sm">
            เปิดแท็บม็อกอัพ &amp; ไฟล์
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      >
        {latest ? (
          /* แถบเตี้ยแถวเดียว: รูปเล็กซ้าย — สถานะ/ไฟล์ขวา (เบสสั่งให้รูปเล็ก 2026-08-31) */
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            <ArtworkThumbRow version={latest} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <MockupStatusBadge version={latest} />
                <span className="font-medium text-strong">
                  ม็อกอัพ v{latest.versionNumber}
                </span>
                <span className="text-muted">
                  {latest.approvedAt
                    ? `ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                    : `ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
                  {mockups.length > 1 && ` · แก้มาแล้ว ${mockups.length - 1} รอบ`}
                </span>
              </p>
              <FileCountLine rawCount={rawFiles.length} printCount={printFiles.length} />
            </div>
          </div>
        ) : (
          <NoMockupNote rawCount={rawFiles.length} />
        )}
      </Section>

      {/* ↓ ของจริงทั้งดุ้น ไม่แตะ */}
      <OrderOverviewTab
        order={order}
        showMoney={showMoney}
        totalAmount={totals.totalAmount}
        totalQuantity={totals.totalQuantity}
        onOpenMoney={showMoney ? () => {} : undefined}
        onOpenDelivery={() => {}}
        onEditInfo={() => {}}
        channelColor={channelColor}
        isMarketplace={isMarketplaceChannel(order.channel)}
      />
    </div>
  );
}
