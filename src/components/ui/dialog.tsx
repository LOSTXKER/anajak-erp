"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTROL_H } from "./control-size";
import { FOCUS_BUTTON, OVERLAY_PANEL } from "./tokens";

/* ============================================================
   กติกาการเปิด-ปิด dialog (มาตรฐานเดียวทั้งระบบ): **conditional mount**

     const [target, setTarget] = useState<Invoice | null>(null);
     {target && <XDialog data={target} onClose={() => setTarget(null)} />}

   ให้ dialog mount ใหม่ทุกครั้งที่เปิด — state ฟอร์ม seed จาก props ใน
   useState initializer ได้ค่าสดเสมอ และ React ล้าง state ให้ฟรีตอนปิด
   (ตัวอย่างที่ทำถูก: step-update-dialog · customer-edit-dialog · goods-receipt-dialog)

   ❌ หลีกเลี่ยง "controlled open" ที่ dialog ค้าง mount ตลอด — ต้อง useEffect
   seed ฟอร์มตอน open หรือเขียนฟังก์ชัน reset มือให้ครบทุก field ทุกทางออก
   ลืม field เดียว = ค่าเก่าค้างโผล่รอบถัดไป (บั๊กเงียบ เคยเกิดกับ dialog เงิน)
   · ฟอร์มใน dialog ใช้ <DialogSubmitFooter> เป็นปุ่มท้ายมาตรฐาน
   ============================================================ */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/30 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // dialog ที่ไม่มีคำอธิบาย (ชื่อ dialog บอกครบแล้ว) ต้องประกาศว่า "ตั้งใจไม่มี"
      // ไม่งั้น Radix ขึ้น warning ใน console ทุกครั้งที่เปิด — ส่งเป็นค่าเริ่มต้น
      // ที่นี่จุดเดียว · dialog ที่มี DialogDescription จะ override ทับเองผ่าน {...props}
      aria-describedby={undefined}
      className={cn(
        OVERLAY_PANEL,
        "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain p-5 pr-14 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-6 sm:pr-14",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className={cn(CONTROL_H, "absolute right-2 top-2 inline-flex w-11 touch-manipulation items-center justify-center rounded-full opacity-70 ring-offset-white transition-opacity hover:opacity-100", FOCUS_BUTTON, "sm:right-3 sm:top-3 sm:w-9 disabled:pointer-events-none data-[state=open]:bg-slate-100 dark:ring-offset-slate-900 dark:data-[state=open]:bg-slate-800")}>
        <X className="h-4 w-4" />
        <span className="sr-only">ปิดหน้าต่าง</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight text-slate-900 dark:text-white", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
