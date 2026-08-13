import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface OrderItemsListHeaderProps {
  headingId: string;
  itemIdPrefix: string;
  title: string;
  count: number;
  onAdd: () => void;
}

/**
 * หัวรายการงานร่วมของหน้าเปิดงานและหน้าแก้ไข
 * CTA ต้องอยู่ก่อน list เสมอ เพื่อให้เพิ่มรายการได้โดยไม่ต้องเลื่อนผ่านการ์ดเดิมทั้งหมด
 */
export function OrderItemsListHeader({
  headingId,
  itemIdPrefix,
  title,
  count,
  onAdd,
}: OrderItemsListHeaderProps) {
  const handleAdd = () => {
    const addedItemId = `${itemIdPrefix}-${count + 1}`;
    onAdd();

    // การ์ดหนึ่งใบยาวกว่าหนึ่ง viewport โดยเฉพาะมือถือ จึงพาไปยังใบที่เพิ่งเพิ่ม
    // หลัง React วาดเสร็จทันที มิฉะนั้นผู้ใช้เห็นเพียงตัวเลข count เปลี่ยนที่หัว list
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const addedItem = document.getElementById(addedItemId);
        if (!addedItem) return;
        addedItem.focus({ preventScroll: true });
        addedItem.scrollIntoView({ block: "start" });
      });
    });
  };

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-base font-semibold text-strong">
          {title}
        </h2>
        <Badge variant="default" size="sm" aria-label={`${count} รายการงาน`}>
          {count} รายการ
        </Badge>
      </div>
      <Button type="button" onClick={handleAdd} className="w-full gap-1.5 sm:w-auto">
        <Plus />
        เพิ่มรายการ
      </Button>
    </header>
  );
}
