import { describe, it, expect } from "vitest";
import {
  ORDER_FORM_TABS,
  ORDER_FORM_DEFAULT_TAB,
  buildOrderFormTabMarks,
  firstErrorTab,
  normalizeOrderFormTab,
  type OrderFormError,
  type OrderFormFilled,
} from "./order-form-tabs";

const EMPTY: OrderFormFilled = {
  intake: false,
  items: false,
  pricing: false,
  attachments: false,
};
const ALL: OrderFormFilled = { intake: true, items: true, pricing: true, attachments: true };

const marks = (errors: OrderFormError[], filled = ALL, submitted = true) =>
  buildOrderFormTabMarks({ filled, errors, submitted });

const byKey = (list: ReturnType<typeof marks>, key: string) =>
  list.find((m) => m.key === key)!;

describe("ผังแท็บของฟอร์มออเดอร์", () => {
  it("4 แท็บ ตรงกับ 4 ช่วงเดิมของหน้าเปิดงาน", () => {
    expect(ORDER_FORM_TABS.map((t) => t.key)).toEqual([
      "intake",
      "items",
      "pricing",
      "attachments",
    ]);
  });

  it("แท็บแรกคือรับเรื่อง — ลูกค้าเป็นช่องบังคับช่องเดียว ต้องอยู่หน้าแรกที่เปิดมาเจอ", () => {
    expect(ORDER_FORM_DEFAULT_TAB).toBe("intake");
    expect(ORDER_FORM_TABS[0].key).toBe(ORDER_FORM_DEFAULT_TAB);
  });

  it("normalizeOrderFormTab ปฏิเสธค่าที่ไม่รู้จัก", () => {
    expect(normalizeOrderFormTab("items")).toBe("items");
    expect(normalizeOrderFormTab("มั่ว")).toBeNull();
    expect(normalizeOrderFormTab(null)).toBeNull();
  });
});

describe("จุดเขียว / จุดแดงบนหัวแท็บ", () => {
  it("ยังไม่กดบันทึก = ไม่มีจุดแดงเลย ต่อให้มี error รออยู่ (ไม่ด่าคนตั้งแต่ยังไม่ได้กรอก)", () => {
    const list = buildOrderFormTabMarks({
      filled: EMPTY,
      errors: [{ tab: "intake", message: "กรุณาเลือกลูกค้า" }],
      submitted: false,
    });
    expect(list.every((m) => !m.red)).toBe(true);
  });

  it("กดบันทึกแล้ว แท็บที่ติดขึ้นจุดแดงพร้อมข้อความ", () => {
    const list = marks([{ tab: "items", message: "รายการ #1 สินค้า #1: กรุณาระบุราคา" }]);
    expect(byKey(list, "items").red).toBe(true);
    expect(byKey(list, "items").errors).toEqual(["รายการ #1 สินค้า #1: กรุณาระบุราคา"]);
    expect(byKey(list, "intake").red).toBe(false);
  });

  it("แดงชนะเขียว — แท็บที่มีข้อมูลแต่ข้อมูลผิด ไม่ใช่แท็บที่เสร็จแล้ว", () => {
    const list = marks([{ tab: "items", message: "ราคาต้องมากกว่า 0" }]);
    const items = byKey(list, "items");
    expect(items.red).toBe(true);
    expect(items.green).toBe(false);
  });

  it("แท็บที่มีข้อมูลและไม่มีปัญหา = เขียว", () => {
    const list = marks([]);
    expect(list.every((m) => m.green && !m.red)).toBe(true);
  });

  it("แท็บที่ยังไม่มีข้อมูลและไม่มีปัญหา = ไม่มีจุดเลย", () => {
    const list = marks([], EMPTY);
    expect(list.every((m) => !m.green && !m.red)).toBe(true);
  });

  it("รวมหลาย error ในแท็บเดียวไว้ด้วยกัน", () => {
    const list = marks([
      { tab: "intake", message: "กรุณาเลือกลูกค้า" },
      { tab: "intake", message: "เบอร์ผู้รับไม่ถูกต้อง" },
    ]);
    expect(byKey(list, "intake").errors).toHaveLength(2);
  });
});

describe("เด้งไปแท็บแรกที่ติด — หัวใจของกติกา 'ห้ามแยกทำ'", () => {
  it("คืนแท็บแรกตามลำดับแท็บ ไม่ใช่ตามลำดับที่ error ถูก push", () => {
    expect(
      firstErrorTab([
        { tab: "pricing", message: "ส่วนลดเกินยอด" },
        { tab: "intake", message: "กรุณาเลือกลูกค้า" },
      ]),
    ).toBe("intake");
  });

  it("ติดแท็บเดียวก็คืนแท็บนั้น", () => {
    expect(firstErrorTab([{ tab: "items", message: "x" }])).toBe("items");
  });

  it("ไม่มีปัญหา = null (ไม่ต้องเด้งไปไหน)", () => {
    expect(firstErrorTab([])).toBeNull();
  });

  it("ทุกแท็บที่ประกาศไว้ต้องเป็นปลายทางที่เด้งไปได้จริง", () => {
    for (const tab of ORDER_FORM_TABS) {
      expect(firstErrorTab([{ tab: tab.key, message: "x" }])).toBe(tab.key);
    }
  });
});
