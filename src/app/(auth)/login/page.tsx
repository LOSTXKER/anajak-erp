"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { safeAfterLoginHref } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(
          error.message === "Invalid login credentials"
            ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            : `เข้าสู่ระบบไม่สำเร็จ: ${error.message}`
        );
        setLoading(false);
        return;
      }

      const nextHref = safeAfterLoginHref(
        new URL(window.location.href).searchParams.get("next"),
      );
      router.replace(nextHref);
      router.refresh();
    } catch {
      setErrorMessage("เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองเข้าสู่ระบบอีกครั้ง");
      setLoading(false);
    }
  };

  return (
    // ต้นแบบ .login = พื้นเต็มจอ จัดกึ่งกลาง ระยะขอบ 40px บน-ล่าง / 16px ซ้าย-ขวา
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      {/* ต้นแบบ .lcard: กว้างสุด 392px · ระยะใน 26/24/22 · ช่องไฟระหว่างบล็อก 14px */}
      <Card className="w-full max-w-[392px]">
        <CardHeader className="gap-3.5 space-y-0 px-6 pb-3.5 pt-6.5">
          {/* แบรนด์อยู่แถวเดียวกับชื่อ แล้วค่อยขึ้นหัวข้อของหน้า (ต้นแบบ 2026-09-16) */}
          <div className="flex items-center gap-2.5">
            <span className="grid size-8.5 place-items-center rounded-[11px] bg-blue-600 text-white">
              <Printer className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className={cn("block font-semibold text-strong", styles.brand)}>Anajak Print</span>
              <span className="block text-xs text-muted">ERP โรงงานสกรีนเสื้อ</span>
            </span>
          </div>
          <div>
            {/* หัวข้อจริงของหน้า — หน้าอื่นได้ h1 จาก PageHeader หน้านี้ไม่มีหัวหน้าชุดกลาง */}
            <h1 className={cn("font-semibold text-strong", styles.title)}>เข้าสู่ระบบ</h1>
            <CardDescription className="mt-1.5">ใช้บัญชีที่ร้านออกให้ · ถ้าเข้าไม่ได้ให้ทักหัวหน้า</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5.5">
          {/* ช่องไฟตามต้นแบบ: สองช่องกรอกห่างกัน 12px ส่วนฟอร์ม→ปุ่ม→คำช่วยห่าง 14px */}
          <form onSubmit={handleSubmit} className="space-y-3.5" aria-busy={loading}>
            <div className="space-y-3">
              <Field id="login-email" label="อีเมล">
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@anajak.co"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  required
                />
              </Field>
              <Field id="login-password" label="รหัสผ่าน">
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </Field>
            </div>
            {/* ต้นแบบไม่มีกล่องนี้เพราะกดไม่ได้จริง — ของจริงต้องบอกสาเหตุตรงจุดก่อนปุ่ม */}
            {errorMessage && (
              <Alert variant="error">
                {errorMessage}
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
            <p className="text-center text-xs text-muted">
              จอในโรงงานใช้ทางเข้าแยก ไม่ต้องใส่รหัสทุกครั้ง
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
