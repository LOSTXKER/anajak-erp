import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
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

const layoutSource = readFileSync(
  new URL("./station-current-layout.tsx", import.meta.url),
  "utf8",
);

function queueItem(
  key: string,
  status: StationQueueItem["status"],
  overrides: Partial<StationQueueItem> = {},
): StationQueueItem {
  return {
    key,
    orderId: `order-${key}`,
    productionId: `production-${key}`,
    stepId: `step-${key}`,
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

  it("ตัดเฉพาะ step ที่เปิด โดยคง lane อื่นของ production เดียวกันไว้ในคิว", () => {
    const firstLane = queueItem("lane-1", "active", {
      productionId: "production-mixed",
      stepId: "step-lane-1",
    });
    const secondLane = queueItem("lane-2", "ready", {
      productionId: "production-mixed",
      stepId: "step-lane-2",
    });
    const groups = groupStationQueueItems(
      [firstLane, secondLane],
      {
        productionId: "production-mixed",
        stepId: "step-lane-1",
      },
    );

    expect(groups.selected?.stepId).toBe("step-lane-1");
    expect(groups.ready.map((item) => item.stepId)).toEqual(["step-lane-2"]);
  });

  it("render current ก่อน ready ก่อน blocked และแสดงเหตุจริงโดยไม่มีข้อความเงิน", () => {
    const selected = queueItem("selected", "ready");
    const layoutProps: ComponentProps<typeof StationCurrentLayout> = {
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
    };
    const html = renderToStaticMarkup(
      createElement(StationCurrentLayout, layoutProps),
    );

    const currentIndex = html.indexOf('data-station-region="current"');
    const queueDisclosureIndex = html.indexOf("<details");
    const readyIndex = html.indexOf('data-station-region="ready"');
    const blockedIndex = html.indexOf('data-station-region="blocked"');
    const scanIndex = html.indexOf('data-test-scan=""');

    expect(currentIndex).toBeGreaterThanOrEqual(0);
    expect(queueDisclosureIndex).toBeGreaterThan(currentIndex);
    expect(readyIndex).toBeGreaterThan(queueDisclosureIndex);
    expect(blockedIndex).toBeGreaterThan(readyIndex);
    expect(scanIndex).toBeGreaterThan(blockedIndex);
    expect(html).toContain("คิวและสแกนงาน");
    expect(html).toContain("เปิดคิว");
    expect(html).toContain("ปิดคิว");
    expect(html).toContain("data-station-queue-rail");
    expect(html).toContain("pb-24");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).not.toContain("lg:grid-cols");
    expect(html).not.toContain(selected.orderNumber);
    expect(html).toContain("รอฟิล์มจากรอบพิมพ์");
    expect(html).toContain("เครื่องรีดหยุดตรวจอุณหภูมิ");
    expect(html).not.toMatch(/฿|ราคา|ยอดเงิน|ยอดชำระ/);
  });

  it("การเปิดบริบทไม่ย้าย bucket ready/blocked ไปเป็นงานกำลังทำ", () => {
    const selected = queueItem("selected-blocked", "blocked");
    const layoutProps: ComponentProps<typeof StationCurrentLayout> = {
      items: [selected, queueItem("ready", "ready")],
      selection: { productionId: selected.productionId },
      scan: createElement("div"),
      onOpen: vi.fn(),
      children: createElement("article", null, "บริบทงานติดปัญหา"),
    };
    const html = renderToStaticMarkup(
      createElement(StationCurrentLayout, layoutProps),
    );

    expect(html).toContain("กำลังทำ 0 · พร้อม 1 · ติดปัญหา 1");
    expect(html).not.toContain("สรุปคิวสถานี");
    expect(html).toContain('aria-label="บริบทงานติดปัญหาที่เปิดดู"');
  });

  it("พัก CTA งานเดิมตลอดเวลาที่เปิดคิวหรือโฟกัสช่องสแกนใน disclosure", () => {
    expect(layoutSource).toContain(
      "onToggle={(event) => setQueueOpen(event.currentTarget.open)}",
    );
    expect(layoutSource).toContain(
      'queueOpen && "[&_[data-station-action-bar]]:hidden"',
    );
    expect(layoutSource).toContain("ช่องสแกนอยู่ภายใน disclosure นี้เสมอ");
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
