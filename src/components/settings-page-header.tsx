import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SettingsPageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
}

export function SettingsPageHeader({
  title,
  description,
  backHref = "/settings",
}: SettingsPageHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Button asChild variant="ghost" size="icon">
        <Link href={backHref} aria-label="ย้อนกลับ">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div>
        {/* ขนาดหัวเรื่องต้องตรงกับ PageHeader (page-header.tsx) — มาตรฐานเดียวทั้งระบบ */}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
    </div>
  );
}
