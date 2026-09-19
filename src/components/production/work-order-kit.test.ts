/**
 * ใบผลิตจริง /production/[id] — เรนเดอร์ตัวหน้าเต็มด้วยข้อมูลปลอมของหน้าลอง
 * (ก่อนหน้านี้ด่านและเทสต์ทั้งหมดตรวจชุดเก่าที่ไม่มีใครเปิด หน้าจริงจึงไม่เคยถูกตรวจเลย — 2026-09-20)
 *
 * ที่ต้องคงไว้: ตารางรายรายการแบบหน้าออเดอร์ · ลายอยู่กับรายการของมันและกรองตามขั้น ·
 * ช่องกรอกยอดแถวละไซซ์ · ขั้นคู่มีพิกัดของตัวเอง · ไม่มีเงินบนใบผลิต
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";

import { useProtoController } from "@/app/proto/work-order-states/_controller";
import { makeOrder, stateOf, type Role } from "@/app/proto/work-order-states/_fixtures";
import type { ProductionDetail, ProductionStep } from "./types";
import { WorkOrderKitView } from "./work-order-kit";

(globalThis as Record<string, unknown>).React = React;

const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} } as never;

type Override = { order?: ProductionDetail["order"]; steps?: ProductionStep[] };

function Fixture({ scenario, role = "boss", over }: { scenario: string; role?: Role; over?: Override }) {
  const fixture = stateOf(scenario);
  const c = useProtoController(
    { ...fixture, ...(over?.order ? { order: over.order } : {}), ...(over?.steps ? { steps: over.steps } : {}) },
    role,
  );
  return React.createElement(WorkOrderKitView, { c });
}

function render(scenario: string, role?: Role, order?: ProductionDetail["order"], steps?: ProductionStep[]) {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: router },
      React.createElement(
        PathnameContext.Provider,
        { value: "/production/proto" },
        React.createElement(
          SearchParamsContext.Provider,
          { value: new URLSearchParams() },
          React.createElement(Fixture, { scenario, role, over: { order, steps } }),
        ),
      ),
    ),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** สองรายการในใบเดียว: เสื้อกีฬา (DTF หน้า+หลัง) กับ เสื้อโปโล (DTF อกซ้าย + ปักแขน) */
function twoItemOrder(): ProductionDetail["order"] {
  const base = makeOrder({}) as ProductionDetail["order"];
  const item = base.items[0]!;
  const second = {
    ...item,
    id: "it2",
    description: "เสื้อโปโลสตาฟ",
    totalQuantity: 18,
    prints: [
      { ...item.prints[0]!, id: "p2", position: "BACK", printType: "DTF" },
      { ...item.prints[0]!, id: "p3", position: "SLEEVE_R", printType: "EMBROIDERY", designImageUrl: null },
    ],
    products: [
      {
        ...item.products[0]!,
        id: "pr2",
        description: "เสื้อโปโล จูติ",
        product: { name: "เสื้อโปโล จูติ", sku: "PL-WHT", imageUrl: null },
        totalQuantity: 18,
        variants: [
          { id: "v2-m", size: "M", color: "ขาว", quantity: 8 },
          { id: "v2-l", size: "L", color: "ขาว", quantity: 10 },
        ],
      },
    ],
  } as (typeof base)["items"][number];
  return { ...base, items: [item, second] };
}

describe("ใบผลิตแสดงสินค้าเป็นตารางรายรายการแบบหน้าออเดอร์", () => {
  it("แต่ละรายการมีหัวของตัวเอง ชื่อสินค้าไม่ปนข้ามรายการ และเลขแถวนับต่อกันทั้งใบ", () => {
    const html = render("doing", "boss", twoItemOrder());
    expect(html).toContain("เสื้อทีมงานอีเวนต์");
    expect(html).toContain("เสื้อโปโลสตาฟ");
    // ชื่อสินค้าโผล่ครั้งเดียวต่อรายการ — ช่องสินค้าคร่อมทุกแถวไซซ์ (rowSpan) ไม่พิมพ์ซ้ำทุกบรรทัด
    const rowSpans = (html.match(/rowspan="(\d+)"/gi) ?? []).map((m) => m.replace(/\D/g, ""));
    expect(rowSpans).toEqual(["3", "2"]);
    // เลขแถวนับต่อกันทั้งใบ: รายการแรก 3 ไซซ์ (1-3) รายการที่สองต่อที่ 4-5
    const plain = text(html);
    expect(plain).toMatch(/4 เสื้อโปโล จูติ/);
    expect((plain.match(/รวมรายการนี้/g) ?? []).length).toBe(2);
    expect(plain).toContain("รวมทั้งใบ");
  });

  it("ลายอยู่กับรายการของมัน และขั้นรีดร้อนไม่เอาลายปักของอีกรายการมาปน", () => {
    const html = render("doing", "boss", twoItemOrder());
    const plain = text(html);
    // ขั้นรีดร้อนเห็นเฉพาะลาย DTF — ลายปักเป็นของขั้นร้านนอก ไม่โผล่มาในขั้นนี้
    expect(plain).toContain("DTF หน้า");
    expect(plain).toContain("DTF หลัง");
    expect(plain).not.toContain("ปัก");
  });

  it("กรอกยอดได้แถวละไซซ์ ทั้งทำแล้วและเสีย", () => {
    const html = render("doing");
    expect((html.match(/aria-label="ทำแล้ว /g) ?? []).length).toBe(3);
    expect((html.match(/aria-label="เสีย /g) ?? []).length).toBe(3);
    expect(html).toContain("ใส่ครบทุกไซซ์");
    // ปุ่มบันทึกยอดโผล่เมื่อแก้เท่านั้น
    expect(html).not.toContain(">บันทึกยอด<");
  });

  it("ของอยู่ร้านนอก: กรอกยอดเองไม่ได้ ต้องบันทึกจากใบรับกลับ", () => {
    const html = render("outsource-shop");
    expect(html).not.toContain('aria-label="ทำแล้ว ');
    expect(text(html)).toContain("อยู่ร้านนอก");
  });

  it("ขั้นคู่มีตารางและเช็คลิสต์ของตัวเองคนละพิกัด", () => {
    const html = render("pair");
    const anchors = html.match(/id="work-order-pieces-[^"]+"/g) ?? [];
    const checklists = html.match(/id="work-order-checklist-[^"]+"/g) ?? [];
    expect(new Set(anchors).size).toBe(2);
    expect(new Set(checklists).size).toBe(2);
  });

  it("ไม่มีเงินบนใบผลิตแม้เปิดในฐานะหัวหน้า", () => {
    for (const scenario of ["doing", "pair", "problem", "reopen"]) {
      const plain = text(render(scenario, "boss"));
      expect(plain).not.toContain("฿");
      expect(plain).not.toContain("ราคา");
      expect(plain).not.toContain("ค่าสกรีน");
      expect(plain).not.toContain("ยอดรวม");
    }
  });

  it("ติดปัญหาแล้วขึ้นแถบบนสุดและบอกเหตุ", () => {
    const plain = text(render("problem"));
    expect(plain).toContain("ติดปัญหา");
  });
});

describe("ระบบแจ้งปัญหาจบในการ์ดขั้น", () => {
  it("กล่องปัญหาบอกเหตุ ของเสียรายไซซ์ และเส้นทางว่าตอนนี้รอใคร", () => {
    const html = render("problem");
    const plain = text(html);
    expect(html).toContain('id="work-order-problem-');
    expect(plain).toContain("ฟิล์มลอกหลังรีด");
    // ของเสียที่บันทึกไว้แล้วต้องโผล่ในกล่อง ไม่ต้องให้หัวหน้าไปไล่หาในตาราง
    expect(plain).toMatch(/S 3 เสีย/);
    expect(plain).toContain("แจ้งแล้ว");
    expect(plain).toContain("หัวหน้าตัดสิน");
    expect(plain).toContain("แก้เสร็จ ทำต่อได้");
  });

  it("ช่างเห็นว่ารอหัวหน้า · หัวหน้าเห็นปุ่มตัดสินในกล่องเดียวกัน", () => {
    const staff = text(render("problem", "staff"));
    expect(staff).toContain("รอหัวหน้าตัดสินก่อนทำต่อ");
    expect(staff).not.toContain("แก้แล้ว ทำต่อได้");

    const boss = text(render("problem", "boss"));
    expect(boss).toContain("แก้แล้ว ทำต่อได้");
  });

  it("ขั้นที่มีปัญหาอยู่แล้วไม่มีปุ่มแจ้งซ้ำ", () => {
    expect(text(render("problem"))).not.toContain("แจ้งปัญหาขั้นนี้");
  });

  it("ขั้นงานแก้ (ขั้นพิเศษนอกสถานีประจำ) ก็มีปุ่มแจ้งปัญหา", () => {
    // เดิม server ปฏิเสธขั้นชนิดนี้ทุกครั้ง ทั้งที่ปุ่มขึ้นให้กด
    expect(text(render("reopen"))).toContain("แจ้งปัญหาขั้นนี้");
  });

  it("ปุ่มลงมือใช้ปุ่มชุดหน้าตากลาง ไม่ใช่ปุ่มชุดเก่าคนละหน้าตา", () => {
    const html = render("doing");
    expect(html).not.toContain("bg-blue-600 text-white");
  });

  it("ทุกขั้นปิดแล้วแต่ออเดอร์ยังผลิตอยู่ ต้องไม่อ้างว่าอยู่ QC และพาไปแท็บที่เกี่ยว", () => {
    const done = stateOf("doing").steps.map((step) => ({ ...step, status: "COMPLETED" as const, qtyDone: step.qtyTotal ?? 0 }));
    const plain = text(render("doing", "boss", undefined, done));
    expect(plain).toContain("ครบทุกขั้นในใบนี้แล้ว");
    expect(plain).toContain("กำลังผลิต");
    expect(plain).not.toContain("อยู่ที่ QC");
  });

  it("เวลาตัวอย่างตรงกันแม้ server และ browser เปิดคนละนาที", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-11T14:00:00Z"));
      const first = render("doing");
      vi.setSystemTime(new Date("2026-09-11T14:10:00Z"));
      expect(render("doing")).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});
