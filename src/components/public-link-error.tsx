"use client";

import { AlertCircle, Mail, Phone, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isPublicLinkUnavailable } from "@/lib/public-link-state";

interface PublicLinkErrorProps {
  message?: string;
  onRetry?: () => void;
  contactLabel?: string;
  error?: { data?: { code?: string } | null } | null;
}

/**
 * ทางกู้คืนร่วมของหน้าลิงก์สาธารณะ — ไม่ปล่อยลูกค้าค้างที่ข้อความ error อย่างเดียว
 * อ่านเฉพาะเบอร์/อีเมลกิจการที่ตั้งใจเผยแพร่ ไม่เปิดข้อมูลภาษีหรือที่อยู่จาก Settings
 */
export function PublicLinkError({
  message = "ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว",
  onRetry,
  contactLabel = "ติดต่อทีมงาน",
  error,
}: PublicLinkErrorProps) {
  const contact = trpc.settings.publicContact.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const linkUnavailable = isPublicLinkUnavailable(error);
  const explanation = linkUnavailable
    ? message
    : "โหลดข้อมูลไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองเปิดอีกครั้ง หากยังไม่ได้ ให้ติดต่อผู้ส่งลิงก์";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-strong">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 shrink-0 text-red-600" aria-hidden="true">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-strong">เปิดลิงก์ไม่ได้</h1>
              <p className="mt-1 text-sm leading-relaxed text-secondary" role="alert">{explanation}</p>
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
              <p className="text-sm leading-relaxed text-secondary">
                {contact.isLoading ? "กำลังโหลดช่องทางติดต่อ…" : "กลับไปที่แชตหรืออีเมลที่ได้รับลิงก์นี้ แล้วแจ้งผู้ส่งให้ช่วยตรวจสอบลิงก์"}
              </p>
            )}
            {onRetry && (
              <Button variant="outline" onClick={() => { void contact.refetch(); onRetry(); }}>
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
