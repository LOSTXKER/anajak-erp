import { describe, expect, it } from "vitest";
import { groupTaskItems, type TaskListItem } from "./task-groups";

const task = (overrides: Partial<TaskListItem>): TaskListItem => ({
  key: "task-1",
  href: "/orders/1",
  title: "งานทดสอบ",
  attention: "normal",
  ownership: "team",
  ...overrides,
});

describe("groupTaskItems", () => {
  it("ให้งานเร่งด่วนอยู่กองต้องทำก่อนเพียงกองเดียว", () => {
    const groups = groupTaskItems([
      task({ key: "mine-overdue", attention: "overdue", ownership: "mine" }),
    ]);

    expect(groups[0].items.map((item) => item.key)).toEqual(["mine-overdue"]);
    expect(groups[1].items).toHaveLength(0);
  });

  it("ตัด action key ซ้ำและเก็บตัวที่สำคัญกว่าตามลำดับ", () => {
    const groups = groupTaskItems([
      task({ key: "same", title: "คิวปกติ" }),
      task({ key: "same", title: "งานติดปัญหา", attention: "blocked" }),
    ]);

    expect(groups.flatMap((group) => group.items)).toHaveLength(1);
    expect(groups[0].items[0]?.title).toBe("งานติดปัญหา");
  });

  it("เรียงติดปัญหา ก่อนเลยกำหนด ก่อนใกล้กำหนด", () => {
    const groups = groupTaskItems([
      task({ key: "soon", attention: "due-soon" }),
      task({ key: "blocked", attention: "blocked" }),
      task({ key: "overdue", attention: "overdue" }),
    ]);

    expect(groups[0].items.map((item) => item.key)).toEqual([
      "blocked",
      "overdue",
      "soon",
    ]);
  });
});
