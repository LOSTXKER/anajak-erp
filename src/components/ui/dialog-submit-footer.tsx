import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { DialogFooter } from "./dialog";
import { Spinner } from "./spinner";

/* ท้าย dialog ที่เป็นฟอร์ม — ปุ่มยกเลิก/บันทึกชุดเดียวทั้งระบบ
   เดิมโครงนี้ถูกพิมพ์ซ้ำมือ ~30 dialog แล้วแตกเป็น 2 มาตรฐาน:
   สาย Loader2+spinner กับสาย text-swap "กำลังบันทึก..." ไม่มี spinner
   (บางจุดไม่ใช้ DialogFooter เลย) · มือถือปุ่มเต็มแถวมีแค่ confirm-dialog ทำ
   — ที่นี่คุมให้หมด: disabled ตอน pending · spinner แทนไอคอน · มือถือเต็มแถว

   ปุ่มยืนยันเป็น type="submit" เมื่อส่ง prop form หรือไม่ส่ง onSubmit
   (ใช้ในฟอร์ม <form onSubmit=...>) · ส่ง onSubmit เมื่อไม่มี <form> ครอบ */
export function DialogSubmitFooter({
  pending = false,
  disabled = false,
  submitLabel,
  submitIcon,
  destructive = false,
  cancelLabel = "ยกเลิก",
  onCancel,
  onSubmit,
  form,
  className,
}: {
  /** mutation.isPending — ปุ่มทั้งคู่ disabled + spinner ที่ปุ่มยืนยัน */
  pending?: boolean;
  /** เงื่อนไขห้ามกดเพิ่มเติม (ฟอร์มยังไม่ครบ ฯลฯ) */
  disabled?: boolean;
  submitLabel: ReactNode;
  /** ไอคอนหน้าปุ่มยืนยัน — จะถูกแทนด้วย spinner ตอน pending */
  submitIcon?: ReactNode;
  destructive?: boolean;
  cancelLabel?: ReactNode;
  onCancel: () => void;
  /** ใส่เมื่อไม่ได้อยู่ใน <form> — ปุ่มจะเป็น type="button" */
  onSubmit?: () => void;
  /** id ของ <form> ภายนอก (ปุ่มอยู่นอก form) */
  form?: string;
  /** ปรับ layout เฉพาะ dialog โดยยังคงชุดปุ่ม/สถานะกลาง */
  className?: string;
}) {
  return (
    <DialogFooter className={cn("flex-col gap-2 sm:flex-row", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={onCancel}
        disabled={pending}
      >
        {cancelLabel}
      </Button>
      <Button
        type={onSubmit ? "button" : "submit"}
        form={form}
        variant={destructive ? "destructive" : "default"}
        className="w-full gap-1.5 sm:w-auto"
        disabled={pending || disabled}
        onClick={onSubmit}
      >
        {pending ? <Spinner size="sm" /> : submitIcon}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
