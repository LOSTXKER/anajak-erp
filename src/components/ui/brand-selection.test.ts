import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const tokensSource = read("./tokens.ts");
const tabsSource = read("./tabs.tsx");
const filterChipSource = read("./filter-chip.tsx");
const shellSource = read("../layout/app-shell.tsx");
const ordersSource = read("../orders/orders-page.tsx");

describe("Anajak selected-state contract", () => {
  it("ล็อก active underline และ toolbar filter เป็น Anajak Blue ทั้ง Light/Dark", () => {
    expect(tokensSource).toContain("export const ACTIVE_UNDERLINE");
    expect(tokensSource).toContain("border-blue-600 font-semibold text-blue-700");
    expect(tokensSource).toContain("dark:border-blue-400 dark:text-blue-400");
    expect(tokensSource).toContain('ACTIVE_FILTER =\n  "border-blue-600');
  });

  it("primitive แบบเส้นใต้ไม่ย้อนกลับไปใช้เส้นดำหรือขาว", () => {
    for (const source of [tabsSource, filterChipSource]) {
      expect(source).not.toContain("border-slate-900");
      expect(source).not.toContain("dark:border-white");
    }
    expect(tabsSource).toContain("data-[state=active]:border-blue-600");
    expect(filterChipSource).toContain("ACTIVE_UNDERLINE");
  });

  /* แถบเมนูของ app shell: เมนูที่เปิดอยู่เป็นพื้นฟ้าอ่อน + ตัวหนังสือ/ไอคอนน้ำเงิน ไม่มีขีดริมซ้าย
     (รื้อ 2026-09-14 ตามต้นแบบหน้าแรกแนว minimal ที่เบสเคาะ) — ใช้ token selected ชุดเดียวกับ
     ของที่ถูกเลือกทั้งเว็บ · ก่อนหน้านี้ (2026-08-26) เคยเป็น "เทากลาง + ขีดแบรนด์" แต่ถูกแทนแล้ว
     ส่วน active filter เฉพาะหน้า (ความเร่งด่วนที่ส่งมาจากหน้าแรก) เป็นชิปฟ้าอ่อนมีไอคอนกรอง + ปุ่มล้าง
     อยู่หัวการ์ดตาราง ตามต้นแบบหน้าออเดอร์รอบ 2 (.fchip — เบสตีว่าหน้าจริงไม่เหมือนต้นแบบ 2026-09-15) */
  it("navigation ที่เปิดอยู่ใช้ selected role ฟ้าอ่อน ไม่มีขีดแบรนด์ · active filter เฉพาะหน้าเป็นชิปมีไอคอนกรองและปุ่มล้าง", () => {
    expect(shellSource).toContain('cn("font-medium", INTERACTIVE_SELECTED)');
    expect(shellSource).toContain("text-interactive-selected-text");
    // ขีดริมซ้ายของเมนูซ้ายหายไป (แถบล่างมือถือยังมีเส้นบนของแท็บที่เปิดอยู่ — คนละชิ้น)
    expect(shellSource).not.toContain("before:-left-3");
    expect(shellSource).not.toContain('onChrome ? "bg-interactive-chrome-pressed" : "bg-interactive-pressed"');
    // หน้าออเดอร์ยกจากต้นแบบ .fchip (2026-09-15) — ชิปพื้นฟ้าอ่อนอยู่ kit/kit.module.css
    expect(ordersSource).toContain('className={c("fchip")}');
    expect(ordersSource).toContain('<Filter aria-hidden="true" />');
    expect(ordersSource).toContain('aria-label="ล้างตัวกรองความเร่งด่วน"');
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

});
