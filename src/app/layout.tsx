import type { Metadata, Viewport } from "next";
import { Prompt, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

/* ชื่อบนแท็บเบราว์เซอร์ (ต้นแบบ PTITLE) — เปิดหลายแท็บแล้วต้องแยกออกว่าแท็บไหนคือหน้าอะไร
   template ทำให้หน้าที่ประกาศ metadata.title ของตัวเองได้ "<ชื่อหน้า> · Anajak Print"
   ทันทีโดยไม่ต้องเขียนชื่อระบบซ้ำ · หน้าที่ยังไม่ประกาศใช้ default เหมือนเดิม
   (หน้าหลังบ้านเกือบทั้งหมดเป็น "use client" จึงต้องประกาศผ่าน layout.tsx ของ route นั้น) */
export const metadata: Metadata = {
  title: {
    default: "Anajak Print - ERP โรงงานสกรีนเสื้อ",
    template: "%s · Anajak Print",
  },
  description: "ระบบจัดการโรงงานสกรีนเสื้อครบวงจร",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${prompt.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Toaster มีตัวเดียวที่ Providers (ThemedToaster) — สองตัวทำป้ายเด้งซ้ำบน-ล่าง */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
