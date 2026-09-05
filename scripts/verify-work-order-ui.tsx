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
import { StepDetail } from "../src/components/production/work-order-page";
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
function stepDetail(step: Record<string, unknown>, opts: { now?: unknown; primary?: React.ReactNode; boss: boolean }) {
  const done = step.status === "COMPLETED";
  return render(
    <StepDetail
      c={c}
      step={{ ...base, ...step } as never}
      now={opts.now as never}
      nowMs={0}
      primary={opts.primary ?? null}
      canReport={!done && step.status !== "FAILED"}
      canFix={opts.boss && !done}
      canEdit={!done}
      onEdit={() => {}}
      garment={null}
    />,
  );
}

/* ── โซนลงมือแบบ A: ไม่มีปุ่มที่กดไม่ได้ · ปุ่มหลักเดียว · เมนูเพิ่มเติม ── */
const waiting = stepDetail({ id: "w", stepType: "HEAT_PRESS", status: "PENDING" }, { now: { action: "start", group: "current", waitingOn: ["รอเสื้อ"], note: undefined }, boss: true });
ok("ขั้นที่รออยู่: ไม่มีปุ่มเทา 'ลงมือไม่ได้ตอนนี้'", !waiting.includes("ลงมือไม่ได้ตอนนี้"));
ok("ขั้นที่รออยู่: ประโยคสถานะบอกว่ารออะไร", waiting.includes("รอเสื้อ"));
ok("ขั้นที่รออยู่: ไม่มีปุ่มหลักน้ำเงิน แต่มีเมนูเพิ่มเติม", !waiting.includes("บันทึกยอด") && waiting.includes("เพิ่มเติม"));

/* ── กระดาษเป็นหลัก (เบสเคาะ A 09-05 · ROADMAP §A5): รีดร้อน = จดบนกระดาษ ไม่มีปุ่มหลักแม้ระบบจะให้ · ร้านนอก = จดในระบบ มีปุ่มหลัก 1 ── */
const paper = stepDetail({ id: "r", stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 96, assignedTo: { id: "u", name: "บาส" } }, { now: { action: "record-qty", group: "current", waitingOn: [], note: undefined }, primary: <Button>บันทึกยอด / ปิดขั้น</Button>, boss: true });
ok("ขั้นกระดาษ (รีดร้อน): ไม่มีปุ่มหลัก — ช่างจดบนใบสั่งงาน", !paper.includes("บันทึกยอด / ปิดขั้น"));
ok("ขั้นกระดาษ: ประโยคสถานะบอกว่าจดบนใบสั่งงานและถือว่าผ่านตอนส่งเข้า QC", paper.includes("จดบนใบสั่งงาน") && paper.includes("ส่งเข้า QC"));
ok("ขั้นกระดาษ: ชิปโหมด 'จดบนกระดาษ' + ข้อกำหนดบอกว่าช่องติ๊กอยู่บนใบ", paper.includes(">จดบนกระดาษ<") && paper.includes("ช่องติ๊กอยู่บนใบสั่งงาน"));
ok("ขั้นกระดาษ: ปุ่มแจ้งปัญหา + เมนูเพิ่มเติม (หัวหน้าจดว่าเสร็จได้จากเมนู) อยู่ครบ", /แจ้งปัญหา<\/button>/.test(paper) && paper.includes("เพิ่มเติม"));
ok("ขั้นกระดาษ: 'แก้ให้' ไม่ใช่ปุ่มลอยอีก (อยู่ในเมนู)", !/>\s*แก้ให้\s*</.test(paper.replace(/<svg[\s\S]*?<\/svg>/g, "")));
ok("ขั้นกระดาษ: ชิปสถานีของขั้นอยู่ที่หัว", paper.includes("พิมพ์ DTF / รีดร้อน"));

const ready = stepDetail({ id: "e", stepType: "EMBROIDERY", status: "IN_PROGRESS", qtyDone: 0, assignedTo: { id: "u3", name: "พี่ก้อย" } }, { now: { action: "send-outsource", group: "current", waitingOn: [], note: undefined }, primary: <Button>ส่งร้าน</Button>, boss: true });
ok("ขั้นจดในระบบ (ร้านนอก): มีปุ่มหลัก 1 ตัว", (ready.match(/>ส่งร้าน</g) ?? []).length === 1);
ok("ขั้นจดในระบบ: ประโยคสถานะบอกว่าทำไมต้องแตะจอ (ของออกจากโรงงาน)", ready.includes("ของออกจากโรงงาน"));
ok("ขั้นจดในระบบ: ชิปโหมด 'จดในระบบ'", ready.includes(">จดในระบบ<"));
ok("ขั้นจดในระบบ: ปุ่มแจ้งปัญหา + เมนูเพิ่มเติม อยู่ครบ", /แจ้งปัญหา<\/button>/.test(ready) && ready.includes("เพิ่มเติม"));

const inferred = stepDetail({ id: "i", stepType: "HEAT_PRESS", status: "COMPLETED", qtyDone: 240, completedAt: new Date("2026-09-02T16:10:00"), notes: "[ถือว่าผ่าน] ปิดให้ตอนส่งเข้า QC" }, { boss: true });
ok("ขั้นกระดาษที่ถือว่าผ่าน: ชิป 'ถือว่าผ่าน' ไม่ใช่ 'ผ่านแล้ว' และประโยคบอกที่มา", inferred.includes(">ถือว่าผ่าน<") && !inferred.includes(">ผ่านแล้ว<") && inferred.includes("ถือว่าผ่านตอนส่งเข้า QC"));

const problemBoss = stepDetail({ id: "p", stepType: "GARMENT_PICK", status: "FAILED", notes: "ไซซ์ L ขาด 60 ตัว", assignedTo: { id: "u2", name: "เนส" } }, { boss: true });
ok("ขั้นติดปัญหา (หัวหน้า): ปุ่มหลักเป็น 'ปลดปัญหา / เปลี่ยนคน'", problemBoss.includes("ปลดปัญหา / เปลี่ยนคน"));
// (ข้อความ "แจ้งปัญหา" ในข้อกำหนดของขั้นไม่นับ — เช็กเฉพาะปุ่ม)
ok("ขั้นติดปัญหา: ไม่มีปุ่มแจ้งปัญหาซ้ำ", !/แจ้งปัญหา<\/button>/.test(problemBoss));
const problemWorker = stepDetail({ id: "p", stepType: "GARMENT_PICK", status: "FAILED", notes: "ไซซ์ L ขาด 60 ตัว" }, { boss: false });
ok("ขั้นติดปัญหา (ช่าง): ไม่มีปุ่มปลดปัญหา", !problemWorker.includes("ปลดปัญหา"));

const done = stepDetail({ id: "d", stepType: "DTF_PRINT", status: "COMPLETED", qtyDone: 240, completedAt: new Date("2026-08-28T11:30:00"), assignedTo: { id: "u", name: "บาส" } }, { boss: true });
ok("ขั้นผ่านแล้ว: ไม่มีปุ่มใด ๆ ในโซนลงมือ (ไม่มีเพิ่มเติม ไม่มีแจ้งปัญหา)", !done.includes("เพิ่มเติม") && !/แจ้งปัญหา<\/button>/.test(done));
ok("ขั้นผ่านแล้ว: ประโยคสถานะบอกว่าปิดแล้วโดยใคร", done.includes("ปิดขั้นแล้ว") && done.includes("บาส"));

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
