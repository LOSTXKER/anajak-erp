// เรนเดอร์ "ใบผลิตจริง" (/production/[id]) เป็น HTML แล้ว assert โครงที่เบสเคาะ — ไม่ต่อฐาน ไม่ต้องล็อกอิน
//
// 2026-09-20: ด่านนี้เคยตรวจชุดคอมโพเนนต์เก่าที่ไม่มีหน้าไหนเปิด (WorkOrderSteps/StepPieceTable/ChecklistCard เดิม)
// หน้าจริงจึงไม่เคยถูกตรวจเลย — ย้ายมาตรวจตัวหน้าจริงผ่านข้อมูลปลอมชุดเดียวกับหน้าลอง
// โครงที่ต้องคงไว้: ตารางรายรายการแบบหน้าออเดอร์ · ลายอยู่กับรายการของมัน · ช่องกรอกยอดแถวละไซซ์ · ไม่มีเงิน
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Alert } from "../src/components/ui/alert";
import { ActionZone } from "../src/components/ui/action-zone";
import { Button } from "../src/components/ui/button";
import { useProtoController } from "../src/app/proto/work-order-states/_controller";
import { makeOrder, stateOf } from "../src/app/proto/work-order-states/_fixtures";
import { WorkOrderKitView } from "../src/components/production/work-order-kit";
import type { ProductionDetail } from "../src/components/production/types";
import { ProblemCard } from "../src/components/production/work-order-pieces";

let pass = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean) {
  if (cond) pass++;
  else {
    fails.push(name);
    console.log("FAIL:", name);
  }
}

const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} } as never;
function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/production/x">
        <SearchParamsContext.Provider value={new URLSearchParams()}>{node}</SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );
}

type Order = ProductionDetail["order"];

/** ใบที่มีสองรายการ: เสื้อกีฬา (DTF หน้า) กับ โปโลสตาฟ (DTF หลัง + ปักแขน) */
function twoItemOrder(): Order {
  const base = makeOrder({}) as Order;
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

function Sheet({ scenario, order, boss = true }: { scenario: string; order?: Order; boss?: boolean }) {
  const fixture = stateOf(scenario);
  const c = useProtoController(order ? { ...fixture, order } : fixture, boss ? "boss" : "staff");
  return <WorkOrderKitView c={c} />;
}

const sheet = (scenario: string, order?: Order, boss?: boolean) => render(<Sheet scenario={scenario} order={order} boss={boss} />);
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/* ── ตารางรายรายการแบบหน้าออเดอร์ (เบสสั่ง 2026-09-19 "ไม่รู้ว่าต้องสกรีนกับเสื้อตัวไหน") ── */
const two = sheet("doing", twoItemOrder());
const twoText = plain(two);
ok(
  "ตาราง: แต่ละรายการมีหัวของตัวเอง (เลข · ชื่อ · จำนวน) ไม่รวมสินค้าทุกรายการเป็นกองเดียว",
  twoText.includes("1 เสื้อทีมงานอีเวนต์") && twoText.includes("2 เสื้อโปโลสตาฟ") && (twoText.match(/รวมรายการนี้/g) ?? []).length === 2,
);
ok("ตาราง: หัวคอลัมน์ครบชุดเดียวกับหน้าออเดอร์ + ช่องกรอกของขั้น", /# สินค้า ไซซ์ สั่ง ทำแล้ว เสีย/.test(twoText));
ok(
  "ตาราง: ช่องสินค้าคร่อมทุกแถวไซซ์ของสินค้าตัวเดียวกัน ไม่พิมพ์ชื่อซ้ำทุกบรรทัด",
  (two.match(/rowspan="(\d+)"/gi) ?? []).map((m) => m.replace(/\D/g, "")).join(",") === "3,2",
);
ok("ตาราง: เลขแถวนับต่อกันทั้งใบเหมือนบิล (รายการที่สองเริ่มที่ 4)", /4 เสื้อโปโล จูติ/.test(twoText));
ok("ตาราง: ไซซ์เป็นคอลัมน์ของตัวเอง และมีแถวรวมทั้งใบเมื่อมีหลายรายการ", twoText.includes("3 ไซซ์") && twoText.includes("รวมทั้งใบ"));
ok(
  "ตาราง: ช่องกรอกทำแล้ว/เสีย แถวละไซซ์ (2 รายการ 5 ไซซ์ = 10 ช่อง)",
  (two.match(/aria-label="ทำแล้ว /g) ?? []).length === 5 && (two.match(/aria-label="เสีย /g) ?? []).length === 5,
);
ok("ตาราง: มีปุ่มใส่ครบทุกไซซ์ · ปุ่มบันทึกยอดยังไม่โผล่ตอนยังไม่แก้", two.includes(">ใส่ครบทุกไซซ์<") && !two.includes(">บันทึกยอด<"));
ok(
  "ตาราง: ชื่อพื้นที่และหัวคอลัมน์อ่านได้ด้วยเครื่องช่วยอ่าน",
  two.includes('role="region"') && two.includes('aria-label="รายการเสื้อ ขั้นรีดร้อน"') && (two.match(/scope="col"/g) ?? []).length === 12,
);
ok("ตาราง: แจ้งสถานะบันทึกยอดให้เครื่องช่วยอ่านรับรู้", two.includes('aria-live="polite"'));
ok("หัวการ์ด: ยอดทำแล้วของขั้นอยู่ที่หัว (20 / 60 ตัว)", /20 \/ 60 ตัว/.test(twoText));

/* ── ลายอยู่กับรายการของมัน และกรองตามชนิดขั้น ── */
ok("ลาย: แถบลายอยู่เหนือตารางของรายการนั้น พร้อมตำแหน่งและขนาด", twoText.includes("DTF หน้า") && twoText.includes("DTF หลัง"));
ok("ลาย: ขั้นรีดร้อนไม่เอาลายปักของอีกรายการมาปน", !twoText.includes("ปัก"));

/* ── ใบผลิตห้ามมีเงินแม้เปิดในฐานะเจ้าของ (SPEC) ── */
const moneyWords = ["฿", "ราคา", "ค่าสกรีน", "ยอดรวม", "ส่วนลด"];
ok(
  "เงิน: ไม่มีตัวเลข/คำเรื่องเงินบนใบผลิตทุกสถานการณ์ แม้เปิดในฐานะหัวหน้า",
  ["doing", "pair", "problem", "outsource-shop"].every((scenario) => {
    const text = plain(sheet(scenario));
    return moneyWords.every((word) => !text.includes(word));
  }),
);

/* ── ขั้นคู่: แต่ละขั้นมีตาราง/เช็คลิสต์/ปุ่มของตัวเอง (A14) ── */
const paired = sheet("pair");
ok(
  "ขั้นคู่: ทั้งสองขั้นมีตารางยอดและพิกัดของตัวเอง",
  new Set(paired.match(/id="work-order-pieces-[^"]+"/g) ?? []).size === 2,
);
ok(
  "ขั้นคู่: แต่ละเช็คลิสต์มีพิกัดของตัวเองให้ปุ่มปิดขั้นพาไป",
  new Set(paired.match(/id="work-order-checklist-[^"]+"/g) ?? []).size === 2,
);

/* ── เช็คลิสต์ (A9.2 ติ๊กได้ · ผลติ๊กมาจาก step.checks · ชิปบอกจำนวนที่เหลือ) ── */
const doing = sheet("doing");
ok("เช็คลิสต์: หัวการ์ด = “เช็คลิสต์” ไม่ซ้ำชื่อขั้น/ชิปสถานะกับการ์ดซ้าย", doing.includes(">เช็คลิสต์<"));
ok("เช็คลิสต์: ข้อกำหนดของรีดร้อนเป็น checkbox ติ๊กได้ และบอกจำนวนที่ยังไม่ติ๊ก", (doing.match(/type="checkbox"/g) ?? []).length === 3 && /ติ๊กอีก \d+ ข้อ/.test(plain(doing)));
ok("เช็คลิสต์: มีผู้ทำของขั้นนั้น", plain(doing).includes("ผู้ทำ"));
ok("เช็คลิสต์: ไม่มีศัพท์ภายใน (จดในระบบ/จดบนกระดาษ/ถือว่าผ่าน)", !doing.includes("จดในระบบ") && !doing.includes("จดบนกระดาษ") && !doing.includes("ถือว่าผ่าน"));

/* ── ของอยู่ร้านนอก: ยอดมาจากใบรับกลับ ไม่ใช่กรอกเอง ── */
const atShop = sheet("outsource-shop");
ok("ร้านนอก: ไม่มีช่องกรอกยอด และบอกว่าของอยู่ร้าน", !atShop.includes('aria-label="ทำแล้ว ') && plain(atShop).includes("อยู่ร้านนอก"));

/* ── ติดปัญหา: ขึ้นแถบบนสุดของหน้า (ต้นแบบ 2026-09-16) ── */
const problem = sheet("problem");
ok("ปัญหา: ขึ้นแถบแจ้งเตือนบนสุดก่อนหัวใบ", problem.indexOf("alerts") < problem.indexOf("crumbs") && plain(problem).includes("ติดปัญหา"));

/* ── ช่องกรอกยอดสูงพอสำหรับนิ้วบนจอทัชในโรงงาน ── */
const kitCss = readFileSync("src/components/kit/kit.module.css", "utf8");
const qinHeight = Number(/\.mfg \.qin \{[^}]*height: (\d+)px/.exec(kitCss)?.[1] ?? 0);
ok(`ช่องกรอกสูงพอนิ้วบนจอทัช (${qinHeight}px ≥ 42px)`, qinHeight >= 42);

/* ── ActionZone: note อยู่แถวบน · ปุ่มแถวล่าง ── */
const zone = render(
  <ActionZone note="เงื่อนไข" menu={<Button>เพิ่มเติม</Button>}>
    <Button>หลัก</Button>
  </ActionZone>,
);
ok("ActionZone: ประโยคสถานะมาก่อนปุ่ม (อยู่แถวบน)", zone.indexOf("เงื่อนไข") < zone.indexOf(">หลัก<"));
ok("ActionZone: เมนูอยู่หลังปุ่มหลัก", zone.indexOf(">หลัก<") < zone.indexOf(">เพิ่มเติม<"));

/* ── Alert แบบ B: ไอคอนอัตโนมัติ · meta เป็นชิป · action ชิดขวา ── */
const alert = render(
  <Alert variant="error" title="เสื้อไม่พอ" meta={[{ label: "ขั้น", value: "เตรียมเสื้อ" }]} action={<Button>แก้ให้</Button>}>
    ไซซ์ L ขาด 60 ตัว
  </Alert>,
);
ok("Alert: มี role=alert และไอคอนโดยไม่ต้องส่ง", alert.includes('role="alert"') && alert.includes("<svg"));
ok("Alert: meta เป็นชิป (ป้าย + ค่า) ไม่ใช่บรรทัดจุด", alert.includes(">ขั้น<") && alert.includes(">เตรียมเสื้อ<") && !alert.includes("ขั้น เตรียมเสื้อ ·"));
ok("Alert: หัวเรื่อง + เนื้อความ + ปุ่ม ครบ", alert.includes("เสื้อไม่พอ") && alert.includes("ไซซ์ L ขาด 60 ตัว") && alert.includes(">แก้ให้<"));
// กล่องแจ้งเตือนแบบ callout ของชุด kit (2026-09-17 เบสสั่งให้ทุกหน้าเข้ากัน): พื้นสีอ่อนตามความหมาย ขอบจาง ไม่มีแถบข้าง
ok("Alert: พื้นสีอ่อนแบบ callout ขอบจาง ไม่มีแถบสีข้าง", alert.includes("bg-red-50") && alert.includes("border-red-600/25") && !alert.includes("border-l-"));

const card = render(<ProblemCard step={{ id: "p", stepType: "GARMENT_PICK", status: "FAILED", notes: "ขาด 60", assignedTo: { id: "u", name: "เนส" }, customStepName: null, qcNotes: null } as never} />);
ok("การ์ดปัญหาในจอหน้างาน: ขั้น + ผู้รับผิดชอบ เป็นชิป", card.includes(">ขั้น<") && card.includes(">ผู้รับผิดชอบ<") && card.includes(">เนส<"));

console.log(`verify-work-order-ui: ผ่าน ${pass} · ตก ${fails.length}`);
if (fails.length) process.exit(1);
