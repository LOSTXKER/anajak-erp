import type { ReactNode } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";

// เมนูข้างของหน้าตั้งค่าอยู่ที่ layout — ทุกหน้าย่อยจึงได้เมนูเดียวกันโดยไม่ต้องประกาศเอง
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1124px]">
      <SettingsShell>{children}</SettingsShell>
    </div>
  );
}
