import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Prompt เดิมจาก google/fonts@f7879ff04d7e2b3f3d4ad93ddffb20a35dff4271/ofl/prompt
// เก็บทุก glyph ใน WOFF2 พร้อม OFL.txt เพื่อไม่ให้การโหลด Google Fonts ล้มแล้วเปลี่ยนหน้าตา
const prompt = localFont({
  src: [
    { path: "./fonts/prompt/Prompt-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/prompt/Prompt-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/prompt/Prompt-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/prompt/Prompt-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Anajak Print - ERP โรงงานสกรีนเสื้อ",
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
