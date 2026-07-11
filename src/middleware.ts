import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ห้ามมี logic ระหว่าง createServerClient กับ getUser — กัน session หลุด sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  // /api/* : middleware รันเพื่อ "รีเฟรช session cookie" (getUser ด้านบนทำแล้ว) แต่ห้าม
  // redirect — เพราะ (1) มี route ที่ลูกค้าถือ token ไม่มี session: /api/files, public tRPC
  // (2) คำขอ data ที่ session หมดอายุต้องได้ cookie ใหม่กลับไป ไม่ใช่โดนเด้งไป HTML /login
  // เดิมยกเว้น /api/* ทั้งก้อนจาก matcher → คำขอ tRPC ไม่เคยถูกรีเฟรช → token หมดอายุแล้ว
  // route handler เขียน cookie ใหม่กลับไม่ได้ → 401 ค้างถาวรจนกว่าจะ hard reload (บั๊กโครงสร้าง)
  const isApi = pathname.startsWith("/api");

  // redirect ต้อง copy cookies ที่ getUser() เพิ่ง refresh มาด้วย
  // ไม่งั้น browser ถือ refresh token เก่าที่ถูก rotate แล้ว → โดน sign out ก่อนเวลา
  const redirectWithCookies = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  // คำขอ API: รีเฟรชแล้วปล่อยผ่าน (supabaseResponse ถือ cookie ใหม่ + request.cookies อัปเดต
  // ให้ route handler อ่าน token สดต่อ) — ไม่เด้ง /login
  if (!isApi) {
    if (!user && !isLoginPage) {
      return redirectWithCookies("/login");
    }
    if (user && isLoginPage) {
      return redirectWithCookies("/home");
    }
  }

  return supabaseResponse;
}

export const config = {
  // รันเกือบทุก route เพื่อรีเฟรช session — รวม /api/* (จำเป็น! tRPC ต้องได้ cookie สดทุกคำขอ
  // ไม่งั้น token หมดอายุแล้ว 401 ค้าง) · ยกเว้นเฉพาะ static assets + หน้า public token
  // (/approve, /upload, /status, /quote, /job — ลูกค้า/ร้านนอกไม่มี session ไม่ต้องรีเฟรช) · body guard ไม่ redirect /api/*
  // ยกเว้น /api/mcp ด้วย — auth ด้วย API key (ไม่มี cookie) ไม่ต้องรีเฟรช session (ลด getUser เปล่า)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|approve/|upload/|status/|quote/|job/|api/mcp/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
