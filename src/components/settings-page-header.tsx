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
      <Link href={backHref}>
        <Button variant="ghost" size="icon" aria-label="ย้อนกลับ">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
    </div>
  );
}
