import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const tokensSource = read("./tokens.ts");
const tabsSource = read("./tabs.tsx");
const filterChipSource = read("./filter-chip.tsx");
const flowFilterSource = read("./flow-filter-bar.tsx");
const shellSource = read("../layout/app-shell.tsx");
const productionNavSource = read("../production/production-module-nav.tsx");
const productionWorklistSource = read("../production/production-control-worklist.tsx");
const ordersSource = read("../orders/orders-page.tsx");

describe("Anajak selected-state contract", () => {
  it("ล็อก active underline และ toolbar filter เป็น Anajak Blue ทั้ง Light/Dark", () => {
    expect(tokensSource).toContain("export const ACTIVE_UNDERLINE");
    expect(tokensSource).toContain("border-blue-600 font-semibold text-blue-700");
    expect(tokensSource).toContain("dark:border-blue-400 dark:text-blue-400");
    expect(tokensSource).toContain('ACTIVE_FILTER =\n  "border-blue-600');
  });

  it("primitive แบบเส้นใต้ไม่ย้อนกลับไปใช้เส้นดำหรือขาว", () => {
    for (const source of [tabsSource, filterChipSource, flowFilterSource]) {
      expect(source).not.toContain("border-slate-900");
      expect(source).not.toContain("dark:border-white");
    }
    expect(tabsSource).toContain("data-[state=active]:border-blue-600");
    expect(filterChipSource).toContain("ACTIVE_UNDERLINE");
    expect(flowFilterSource).toContain("ACTIVE_UNDERLINE");
  });

  it("status flow ใช้ hairline จัดกลุ่มและบอก affordance โดยไม่คืน progress track", () => {
    expect(flowFilterSource).not.toContain("border-y border-divider");
    expect(flowFilterSource).not.toContain("border-l border-slate");
    expect(flowFilterSource).not.toContain("border-b-2 border-slate-100 pb-1");
    expect(flowFilterSource).not.toContain("ratioMax");
    expect(flowFilterSource).not.toContain("style={{ width:");
    expect(flowFilterSource).toContain("border-b border-divider pb-1");
    expect(flowFilterSource).toContain("INTERACTIVE_HOVER");
    expect(flowFilterSource).not.toContain("กดสถานะเพื่อกรอง · กดซ้ำเพื่อล้างตัวกรอง");
    expect(flowFilterSource).toContain('"กดเพื่อกรอง"');
    expect(flowFilterSource).toContain("เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง");
    expect(flowFilterSource).toContain("item.dotClass");
    expect(flowFilterSource).toContain("ACTIVE_UNDERLINE");
  });

  /* แถบเมนูของ app shell ถอยจากพิลฟ้ามาเป็น "เทากลาง + ขีดแบรนด์" (แบบ ก · เบสเคาะ 2026-08-26)
     เพราะพิลฟ้าเต็มแถบไปแย่งสายตากับปุ่มหลักที่ใช้น้ำเงินเหมือนกัน
     ส่วนเมนูโมดูลในหน้าผลิตยังใช้ selected role เดิม — คนละระดับกัน จงใจให้ต่าง */
  it("navigation ใช้เทากลาง + ขีดแบรนด์ · active filter เฉพาะหน้ายังใช้ selected role สีน้ำเงิน", () => {
    expect(shellSource).toContain(
      'onChrome ? "bg-interactive-chrome-pressed" : "bg-interactive-pressed"',
    );
    expect(shellSource).toContain("before:bg-blue-600");
    expect(shellSource).toContain("dark:before:bg-blue-400");
    expect(shellSource).not.toContain("text-interactive-selected-text");
    expect(productionNavSource).toContain(
      'active && "bg-interactive-selected font-medium text-interactive-selected-text"',
    );
    expect(productionNavSource).not.toContain("data-production-module-nav");
    expect(ordersSource).toContain(
      "border-b-2 border-blue-600",
    );
  });

  /* ตราสัญลักษณ์ไม่ได้ถูกล็อกไว้เลย จึงหลุดไปเงียบ ๆ ระหว่างรื้อ UI-2026:
     กติกา "สงวนน้ำเงินให้ปุ่มหลัก/สิ่งที่เลือก/โฟกัส" ไม่มีช่องสำหรับคำว่า "ตัวตน"
     พอโลโก้ไม่ใช่ปุ่มและไม่ใช่สถานะ มันเลยถูกทำเป็นเทาโดยไม่มีอะไรร้อง
     (เบสทัก 2026-08-26 "อย่าลืมสีฟ้าที่เป็น asset เรา") */
  it("ตราสัญลักษณ์เป็นสีแบรนด์เสมอ — ไม่อยู่ใต้กติกาสงวนสี", () => {
    // ตอนนี้มีตราสองก้อน (หัวเมนูซ้ายบนจอกว้าง + บนแถบบนของจอแคบ) — ต้องเป็นสีแบรนด์ทั้งคู่
    // เช็คจำนวน ไม่ใช่แค่ toContain ไม่งั้นก้อนหนึ่งกลายเป็นเทาแล้วเทสยังเขียว
    expect(shellSource.match(/bg-blue-600 text-white/g)).toHaveLength(2);
    expect(shellSource).toContain("bg-blue-600 text-white");
    expect(shellSource).not.toContain("bg-surface text-secondary ring-1 ring-border");
    // หน้า login คือจอแรกที่คนเห็น ตราต้องเป็นสีแบรนด์เหมือนกัน
    expect(read("../../app/(auth)/login/page.tsx")).toContain("bg-blue-600");
  });

  /* กระดาษคือที่ที่แบรนด์อยู่ได้นานที่สุด — ลูกค้า B2B เก็บใบกำกับภาษีเป็นปี
     grayscale lock ใน globals.css มีไว้กัน slate ของ app shell ไหลลงกระดาษ
     ไม่ได้มีไว้ห้ามแบรนด์ · ตราหัวใบกับเส้นคาดหนึ่งเส้นเท่านั้นที่ได้สี ที่เหลือคงเทา */
  it("เอกสารพิมพ์มีตราสีแบรนด์และพิมพ์ออกมาแล้วสีติดจริง", () => {
    const printSource = read("../print/print-document.tsx");
    expect(printSource).toContain("bg-blue-600");
    expect(printSource).toContain("border-b-2 border-blue-600");
    expect(read("../../app/globals.css")).toContain("print-color-adjust: exact");
  });

  /* หน้าที่ลูกค้าเห็นคือจอเดียวที่คนนอกเจอแบรนด์เรา — หัวการ์ดเคยเป็นเทาล้วน
     ยกเว้นออเดอร์ blind ship ที่ต้องปิดตราตามสัญญากับลูกค้า */
  it("หัวหน้าลูกค้ามีตราสีแบรนด์ และปิดได้ตอน blind ship", () => {
    const publicSource = read("../public/public-page.tsx");
    expect(publicSource).toContain("bg-blue-600 text-white");
    // blind ship ต้องปิดตราเองโดยไม่ต้องรอให้ caller จำ
    expect(publicSource).toContain("hideBrandMark = hideFooter");
  });

  /* จอโรงงาน /factory ไม่มี sidebar/topbar เลย — ตราจึงไม่มีที่อยู่โดยอัตโนมัติ
     ก่อน 2026-08-26 ทั้งจอไม่มีคำว่า Anajak อยู่สักที่ ทั้งที่แขวนหน้าโรงงานทั้งวัน */
  it("จอโรงงานทั้งสองรุ่นมีตรา Anajak สีแบรนด์ในหัวจอ", () => {
    for (const source of [
      read("../../app/factory/page.tsx"),
      read("../factory/manufacturing-factory-board.tsx"),
    ]) {
      expect(source).toContain("bg-blue-600 text-white");
      expect(source).toContain("Anajak Print");
    }
  });

  /* user-menu.tsx ไม่เคยมีด่านหรือเทสแตะเลยสักบรรทัด ทั้งที่เป็นของที่อยู่บนทุกหน้า
     บั๊กวงรี 36×44 บนจอทัชจึงอยู่มานานโดยไม่มีอะไรร้อง (เจอตอนไล่ตรวจ 2026-08-26) */
  it("รูปผู้ใช้บนแถบบนเป็นวงกลมจริงทุกจอ และไม่แย่งความเป็นแบรนด์กับตรา", () => {
    const userMenuSource = read("../layout/user-menu.tsx");
    // ความกว้างต้องเดินตามความสูงทุกช่วง — CONTROL_H มี override ให้จอทัช ความกว้างก็ต้องมี
    expect(userMenuSource).toContain("w-11");
    expect(userMenuSource).toContain("sm:w-9");
    expect(userMenuSource).toContain("[@media(pointer:coarse)]:w-11");
    // น้ำเงินเหลืออยู่ที่ตราชิ้นเดียว ที่นี่เป็นวงเงียบมีขอบ
    expect(userMenuSource).not.toContain("bg-blue-600");
    // ทั้งเว็บบอก hover ด้วยสี ไม่ใช่การขยายตัว
    expect(userMenuSource).not.toContain("hover:scale");
  });

  it("Production ใช้การ์ดตัวกรองเรียบและ selected คงสีประจำสถานะ", () => {
    expect(productionWorklistSource).toContain("card-surface card-surface-hover");
    expect(productionWorklistSource).not.toContain("INTERACTIVE_SELECTED");
    expect(productionWorklistSource).toContain("WORKLIST_LENS_PRESENTATION");
    expect(productionWorklistSource).toContain("text-module-production-text");
    expect(productionWorklistSource).toContain("PackageCheck");
    /* ตัวการ์ดต้องยัง "เรียบ" — พื้นขาว + เส้นขอบตอนถูกเลือก ห้ามเป็นการ์ดพื้นสี
       (นี่คือใจความเดิมของข้อนี้ ล็อกด้วยสูตรจริงแทนการห้ามคำว่า bg-module ทั้งไฟล์)
       ส่วนไอคอนอยู่ในกล่องสีอ่อนได้ ตั้งแต่แบบ B "สีบอกหมวด" เบสเคาะ 2026-08-31
       เพื่อให้แถบตัวเลขหน้านี้พูดภาษาเดียวกับหน้าแรกและหน้าการเงิน */
    expect(productionWorklistSource).toContain(
      'isOn && cn("bg-surface", presentation.selectedBorder)',
    );
    expect(productionWorklistSource).toContain("iconChip");
    expect(productionWorklistSource).toContain("selectedBorder");
    expect(productionWorklistSource).toContain("border-red-600 dark:border-red-400");
    expect(productionWorklistSource).toContain("border-module-production-solid");
    expect(productionWorklistSource).toContain("border-amber-600 dark:border-amber-400");
    expect(productionWorklistSource).toContain("border-green-600 dark:border-green-400");
    expect(productionWorklistSource).toContain('isOn ? presentation.iconColor : "text-muted"');
    expect(productionWorklistSource).not.toContain("bg-blue-600 text-white");
    expect(productionWorklistSource).toContain("aria-pressed={isOn}");
    expect(productionWorklistSource).not.toContain("<FlowFilterBar");
  });
});
