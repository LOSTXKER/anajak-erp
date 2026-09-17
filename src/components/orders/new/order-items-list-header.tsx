import { Plus } from "lucide-react";
import { c } from "@/components/kit/kit";
import { cn } from "@/lib/utils";

interface OrderItemsListHeaderProps {
  headingId: string;
  itemIdPrefix: string;
  title: string;
  count: number;
  onAdd: () => void;
}

/**
 * หัวรายการงานร่วมของหน้าเปิดงานและหน้าแก้ไข (ต้นแบบ .ihdr)
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
    <header className={c("ihdr")}>
      <h2 id={headingId}>{title}</h2>
      <span className={c("chip gray")} aria-label={`${count} รายการงาน`}>
        {count} รายการ
      </span>
      {/* จอแคบปุ่มเต็มแถว (ขึ้นบรรทัดใหม่เอง) กดง่ายด้วยนิ้ว · จอกว้างชิดขวาตามต้นแบบ */}
      <button type="button" onClick={handleAdd} className={cn(c("btn primary"), "w-full sm:w-auto")}>
        <Plus aria-hidden="true" />
        เพิ่มรายการ
      </button>
    </header>
  );
}
