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

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  // redirect ต้อง copy cookies ที่ getUser() เพิ่ง refresh มาด้วย
  // ไม่งั้น browser ถือ refresh token เก่าที่ถูก rotate แล้ว → โดน sign out ก่อนเวลา
  const redirectWithCookies = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (!user && !isLoginPage) {
    return redirectWithCookies("/login");
  }

  if (user && isLoginPage) {
    return redirectWithCookies("/");
  }

  return supabaseResponse;
}

export const config = {
  // กันทุก route ยกเว้น: static assets · /api/* (tRPC เช็ค auth ต่อ procedure เอง —
  // มี public token procedures) · /approve/* + /upload/* (ลูกค้าเปิดผ่านลิงก์ token ไม่มี account)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|approve/|upload/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
