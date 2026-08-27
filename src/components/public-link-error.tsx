"use client";

import { AlertCircle, Mail, Phone, RefreshCw, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PublicLinkErrorProps {
  message?: string;
  onRetry?: () => void;
  contactLabel?: string;
}

/**
 * ทางกู้คืนร่วมของหน้าลิงก์สาธารณะ — ไม่ปล่อยลูกค้าค้างที่ข้อความ error อย่างเดียว
 * อ่านเฉพาะเบอร์/อีเมลกิจการที่ตั้งใจเผยแพร่ ไม่เปิดข้อมูลภาษีหรือที่อยู่จาก Settings
 */
export function PublicLinkError({
  message = "ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว",
  onRetry,
  contactLabel = "ติดต่อทีมงาน",
}: PublicLinkErrorProps) {
  const contact = trpc.settings.publicContact.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const fallbackToSender = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    // พื้นหน้าเดียวกับหน้าลูกค้าอื่น (ตัวนี้ตกหล่นตอนเปลี่ยนพื้นเป็นขาว 2026-08-01)
    // · Card ให้พื้นกับขอบมาครบแล้ว เดิมเขียน bg-white/border ซ้ำ ซึ่งไม่มีผลด้วยซ้ำ
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-strong">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 shrink-0 text-red-600" aria-hidden="true">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-strong">เปิดลิงก์ไม่ได้</h1>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-divider pt-5">
            {contact.data?.phone ? (
              <Button asChild>
                <a href={`tel:${contact.data.phone}`}>
                  <Phone aria-hidden="true" />
                  {contactLabel} {contact.data.phone}
                </a>
              </Button>
            ) : contact.data?.email ? (
              <Button asChild>
                <a href={`mailto:${contact.data.email}?subject=${encodeURIComponent("ขอลิงก์ Anajak Print ใหม่")}`}>
                  <Mail aria-hidden="true" />
                  {contactLabel}
                </a>
              </Button>
            ) : (
              <Button onClick={fallbackToSender}>
                <Undo2 aria-hidden="true" />
                กลับไปติดต่อผู้ส่งลิงก์
              </Button>
            )}
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw aria-hidden="true" />
                ลองเปิดอีกครั้ง
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
