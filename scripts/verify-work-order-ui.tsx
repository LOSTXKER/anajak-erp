// เรนเดอร์ชิ้นส่วนลงมือของใบผลิต/หน้างานเป็น HTML แล้ว assert โครงที่เบสเคาะ — ไม่ต่อฐาน ไม่ต้องล็อกอิน
// (โซนลงมือแบบ A 2026-09-03 · กล่องแจ้งเตือนแบบ B 2026-09-03) · อยู่ในด่าน verify:ui
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Alert } from "../src/components/ui/alert";
import { ActionZone } from "../src/components/ui/action-zone";
import { Button } from "../src/components/ui/button";
import { ChecklistCard, StepPieceTable, pieceRowsOf } from "../src/components/production/work-order-page";
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

const base = { customStepName: null, notes: null, qcNotes: null, outsourceOrders: [], printRunItems: [], qtyTotal: 240, startedAt: null, completedAt: null, assignedTo: null, qtyDone: 0 };
const c = { reportProblem: { isPending: false, mutate() {} }, openQty() {}, openEdit() {}, handleSupervisorStatus: async () => {} } as never;
const fakeOrder = {
  items: [
    {
      id: "it1",
      totalQuantity: 240,
      prints: [
        { id: "p1", position: "FRONT", printType: "DTF", printSize: "CUSTOM", width: 8, height: 8, colorCount: 4, designNote: null, designImageUrl: "/demo-mockups/front.svg", artwork: null },
        { id: "p2", position: "SLEEVE_L", printType: "EMBROIDERY", printSize: "CUSTOM", width: 5, height: 5, colorCount: 1, designNote: null, designImageUrl: null, artwork: null },
      ],
      products: [
        {
          id: "pr1",
          productType: "POLO",
          description: "โปโล Dry-Tech คอปก",
          itemSource: "FROM_STOCK",
          fabricColor: "กรมท่า",
          totalQuantity: 240,
          variants: [
            { id: "v1", size: "S", color: "กรมท่า", quantity: 20 },
            { id: "v2", size: "M", color: "กรมท่า", quantity: 40 },
            { id: "v3", size: "L", color: "กรมท่า", quantity: 60 },
          ],
        },
      ],
    },
  ],
} as never;
const nowById = new Map();
const ctrl = { reportProblem: { isPending: false, mutate() {} }, openEdit() {}, handleSupervisorStatus: async () => {}, nowById, canUpdateStep: true, canOwnOrSupervise: () => true, openQty() {} } as never;

/* ── ตารางรายตัวของขั้นที่ยืนอยู่ (เบสเคาะ 09-08 รอบ 11): แถวละไซซ์ · หัวตารางกลาง · ยอดตัวเลขเด่น ── */
const rows = pieceRowsOf(fakeOrder);
ok("แถวรายตัว: แถวละไซซ์ 3 แถว จากสินค้าเดียว", rows.length === 3 && rows.map((r) => r.size).join(",") === "S,M,L");
ok("แถวรายตัว: ชื่อ/สี/จำนวน/รูปลาย ครบ", rows[0]!.product === "โปโล Dry-Tech คอปก" && rows[0]!.color === "กรมท่า" && rows[2]!.qty === 60 && rows[0]!.thumb === "/demo-mockups/front.svg");
ok("แถวรายตัว: ลายเป็นภาษาคน (ตำแหน่ง + เทคนิค)", rows[0]!.prints.join("|") === "หน้า DTF|แขนซ้าย ปัก");

const table = render(<StepPieceTable step={{ ...base, id: "h", stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 96, qtyTotal: 240 } as never} order={fakeOrder} c={ctrl} />);
ok("ตาราง: หัวตารางใช้ TABLE_HEAD_SURFACE (โปร่งตามพื้นแม่)", table.includes("<thead class=\"border-b border-divider bg-transparent text-secondary\""));
ok("ตาราง: 3 แถว + แถวรวม 120 ตัว", (table.match(/<tr/g) ?? []).length === 5 && table.includes("120"));
ok("ตาราง: ยอดทำแล้วของขั้นอยู่หัวการ์ด (96 / 240)", /96\s*\/\s*240/.test(table.replace(/<[^>]+>/g, "")));
ok("ตาราง: ขั้นที่นับยอดมีปุ่มบันทึกยอด (ไปแผ่นกรอกยอดเดิม)", table.includes(">บันทึกยอด<"));
ok("ตาราง: ไม่มีคำอธิบายวิธีใช้ (A8)", !table.includes("กรอก") && !table.includes("กดเพื่อ"));
const pick = render(<StepPieceTable step={{ ...base, id: "g", stepType: "GARMENT_PICK", status: "PENDING", qtyDone: 0, qtyTotal: 240 } as never} order={fakeOrder} c={ctrl} />);
ok("ตาราง: ขั้นเบิกเสื้อไม่มีปุ่มบันทึกยอด (ยอดมาจากการเบิกจริง)", !pick.includes(">บันทึกยอด<"));

/* ── เช็คลิสต์ก่อนปิดขั้น (ข้อกำหนดมาตรฐาน v1 อ่านอย่างเดียว · ติ๊กจริงรอ A9.2) ── */
const check = render(<ChecklistCard step={{ ...base, id: "h", stepType: "HEAT_PRESS", status: "IN_PROGRESS", assignedTo: { id: "u", name: "บาส" } } as never} c={ctrl} nowMs={0} />);
ok("เช็คลิสต์: หัวการ์ด = ชื่อขั้น + สถานะ", check.includes("รีดร้อน") && check.includes(">กำลังทำ<"));
ok("เช็คลิสต์: มีผู้ทำ", check.includes("บาส"));
ok("เช็คลิสต์: ข้อกำหนดของรีดร้อนครบ 3 ข้อ แถวสูง 44px", (check.match(/min-h-11/g) ?? []).length === 3);
ok("เช็คลิสต์: ไม่มีศัพท์ภายใน (จดในระบบ/จดบนกระดาษ/ถือว่าผ่าน)", !check.includes("จดในระบบ") && !check.includes("จดบนกระดาษ") && !check.includes("ถือว่าผ่าน"));
const outsourced = render(
  <ChecklistCard
    step={{ ...base, id: "e", stepType: "EMBROIDERY", status: "IN_PROGRESS", assignedTo: { id: "u3", name: "พี่ก้อย" }, outsourceOrders: [{ id: "o1", status: "SENT", description: null, quantity: 240, sentAt: new Date("2026-09-05"), expectedBackAt: new Date("2026-09-09"), receivedAt: null, qcPassed: null, qcNotes: null, notes: null, createdAt: new Date("2026-09-05"), vendor: { id: "v", name: "ร้านปักพี่หน่อย" } }] } as never}
    c={ctrl}
    nowMs={new Date("2026-09-08").getTime()}
  />,
);
ok("เช็คลิสต์ (ร้านนอก): ร้าน + นัดรับกลับเป็น Fact/DueTag ไม่ใช่บรรทัดจุด", outsourced.includes("ร้านปักพี่หน่อย") && outsourced.includes("นัดรับกลับ") && !outsourced.includes("ร้านปักพี่หน่อย ·"));
const held = render(<ChecklistCard step={{ ...base, id: "x", stepType: "HEAT_PRESS", status: "ON_HOLD" } as never} c={ctrl} nowMs={0} />);
ok("เช็คลิสต์ (พักไว้): บอกสั้น ๆ ว่าพักไว้", held.includes("พักไว้"));

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
ok("Alert: พื้นเรียบ ไม่ใช่กล่องสีเต็ม (ไม่มี bg-red-50)", !alert.includes("bg-red-50 ") && alert.includes("bg-surface"));

const card = render(<ProblemCard step={{ ...base, id: "p", stepType: "GARMENT_PICK", status: "FAILED", notes: "ขาด 60", assignedTo: { id: "u", name: "เนส" } } as never} />);
ok("การ์ดปัญหาในใบผลิต: ขั้น + ผู้รับผิดชอบ เป็นชิป", card.includes(">ขั้น<") && card.includes(">ผู้รับผิดชอบ<") && card.includes(">เนส<"));

console.log(`verify-work-order-ui: ผ่าน ${pass} · ตก ${fails.length}`);
if (fails.length) process.exit(1);
