"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

/** คุ้มครอง draft ทั้งตอนออกหน้า และตอนเปลี่ยนหมวด/แถวภายในทะเบียน */
export function useSettingsDraftGuard(dirty: boolean, pending = false) {
  const confirm = useConfirm();
  useUnsavedChanges(dirty || pending, pending ? { title: "กำลังบันทึก ออกจากหน้านี้หรือไม่?", description: "การออกจากหน้านี้ไม่ยกเลิกคำสั่งที่ส่งแล้ว กลับมาตรวจผลก่อนส่งซ้ำ", confirmText: "ออกจากหน้านี้" } : undefined);
  return async () => {
    if (pending) return false;
    if (!dirty) return true;
    return confirm({ title: "ทิ้งข้อมูลที่ยังไม่บันทึก?", description: "ข้อมูลในฟอร์มนี้จะหายเมื่อเปลี่ยนรายการ", confirmText: "ทิ้งการแก้ไข", cancelText: "กลับไปแก้ต่อ", destructive: true });
  };
}
