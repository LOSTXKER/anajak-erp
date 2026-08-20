import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Shirt } from "lucide-react";
import { StationCurrentLayout } from "./station-current-layout";
import {
  StationQueueView,
  groupStationQueueItems,
  tagStationQueueBuckets,
  type StationQueueItem,
} from "./station-queue-view";

function queueItem(
  key: string,
  status: StationQueueItem["status"],
  overrides: Partial<StationQueueItem> = {},
): StationQueueItem {
  return {
    key,
    orderId: `order-${key}`,
    productionId: `production-${key}`,
    orderNumber: `ORD-${key.toUpperCase()}`,
    title: `งาน ${key}`,
    customerName: "ลูกค้าทดสอบ",
    deadline: "2026-08-20T00:00:00.000Z",
    priority: "NORMAL",
    stepLabel: "รีดร้อน",
    status,
    qtyDone: 0,
    qtyTotal: 10,
    overdue: false,
    waitingOn: [],
    note: null,
    ...overrides,
  };
}

describe("Station queue presentation", () => {
  it("ยึด bucket เป็นสถานะ UI แม้ blocked entry ยังมี workflow status PENDING", () => {
    const tagged = tagStationQueueBuckets({
      active: [{ id: "active", workflowStatus: "IN_PROGRESS" }],
      ready: [{ id: "ready", workflowStatus: "PENDING" }],
      blocked: [{ id: "blocked", workflowStatus: "PENDING" }],
    });

    expect(tagged.map(({ entry, status }) => [entry.id, entry.workflowStatus, status])).toEqual([
      ["active", "IN_PROGRESS", "active"],
      ["ready", "PENDING", "ready"],
      ["blocked", "PENDING", "blocked"],
    ]);
  });

  it("ตัดบริบทที่เลือกออกจาก rail และคงกลุ่ม active/ready/blocked", () => {
    const selected = queueItem("selected", "ready");
    const groups = groupStationQueueItems(
      [
        queueItem("active", "active"),
        selected,
        queueItem("ready", "ready"),
        queueItem("blocked", "blocked"),
      ],
      { productionId: selected.productionId },
    );

    expect(groups.selected?.key).toBe("selected");
    expect(groups.active.map((item) => item.key)).toEqual(["active"]);
    expect(groups.ready.map((item) => item.key)).toEqual(["ready"]);
    expect(groups.blocked.map((item) => item.key)).toEqual(["blocked"]);
  });

  it("render current ก่อน ready ก่อน blocked และแสดงเหตุจริงโดยไม่มีข้อความเงิน", () => {
    const selected = queueItem("selected", "ready");
    const html = renderToStaticMarkup(
      StationCurrentLayout({
        items: [
          selected,
          queueItem("ready", "ready"),
          queueItem("blocked", "blocked", {
            waitingOn: ["รอฟิล์มจากรอบพิมพ์"],
            note: "เครื่องรีดหยุดตรวจอุณหภูมิ",
          }),
        ],
        selection: { productionId: selected.productionId },
        scan: createElement("div", { "data-test-scan": "" }, "สแกนเลขงาน"),
        onOpen: vi.fn(),
        children: createElement(
          "article",
          { "data-station-current-job": "" },
          "งานปัจจุบัน",
        ),
      }),
    );

    const currentIndex = html.indexOf('data-station-region="current"');
    const readyIndex = html.indexOf('data-station-region="ready"');
    const blockedIndex = html.indexOf('data-station-region="blocked"');

    expect(currentIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(currentIndex);
    expect(blockedIndex).toBeGreaterThan(readyIndex);
    expect(html).not.toContain(selected.orderNumber);
    expect(html).toContain("รอฟิล์มจากรอบพิมพ์");
    expect(html).toContain("เครื่องรีดหยุดตรวจอุณหภูมิ");
    expect(html).not.toMatch(/฿|ราคา|ยอดเงิน|ยอดชำระ/);
  });

  it("การเปิดบริบทไม่ย้าย bucket ready/blocked ไปเป็นงานกำลังทำ", () => {
    const selected = queueItem("selected-blocked", "blocked");
    const html = renderToStaticMarkup(
      StationCurrentLayout({
        items: [selected, queueItem("ready", "ready")],
        selection: { productionId: selected.productionId },
        scan: createElement("div"),
        onOpen: vi.fn(),
        children: createElement("article", null, "บริบทงานติดปัญหา"),
      }),
    );

    expect(html).toMatch(/กำลังทำ<\/dt><dd[^>]*>0<\/dd>/);
    expect(html).toMatch(/พร้อมถัดไป<\/dt><dd[^>]*>1<\/dd>/);
    expect(html).toMatch(/ติดปัญหา<\/dt><dd[^>]*>1<\/dd>/);
    expect(html).toContain('aria-label="บริบทงานติดปัญหาที่เปิดดู"');
  });

  it("หน้า queue เต็มเรียง active/ready/blocked และคง no-money contract", () => {
    const html = renderToStaticMarkup(
      createElement(StationQueueView, {
        stationLabel: "สถานีรีดร้อน",
        stationDescription: "ทำเฉพาะงานที่เสื้อและฟิล์มพร้อม",
        icon: Shirt,
        items: [
          queueItem("active", "active"),
          queueItem("ready", "ready"),
          queueItem("blocked", "blocked", {
            waitingOn: ["รอเสื้อจากสถานีเตรียม"],
          }),
        ],
        onOpen: vi.fn(),
      }),
    );

    const activeIndex = html.indexOf('data-station-region="active"');
    const readyIndex = html.indexOf('data-station-region="ready"');
    const blockedIndex = html.indexOf('data-station-region="blocked"');

    expect(activeIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(activeIndex);
    expect(blockedIndex).toBeGreaterThan(readyIndex);
    expect(html).toContain("รอเสื้อจากสถานีเตรียม");
    expect(html).not.toMatch(/฿|ราคา|ยอดเงิน|ยอดชำระ/);
  });
});
