"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { safeAfterLoginHref } from "@/lib/auth-redirect";

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
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-4">
          {/* แบรนด์อยู่แถวเดียวกับชื่อ แล้วค่อยขึ้นหัวข้อของหน้า (ต้นแบบ 2026-09-16) */}
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[11px] bg-blue-600 text-white">
              <Printer className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-strong">Anajak Print</span>
              <span className="block text-xs text-muted">ERP โรงงานสกรีนเสื้อ</span>
            </span>
          </div>
          <div>
            <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
            <CardDescription className="mt-1">ใช้บัญชีที่ร้านออกให้ · เข้าไม่ได้ให้ทักหัวหน้า</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <Field id="login-email" label="อีเมล">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
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
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </Field>
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
