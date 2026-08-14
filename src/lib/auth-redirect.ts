import { legacyV2PathToCanonical } from "@/lib/v2-navigation";

const APP_ORIGIN = "https://anajak.internal";
const DEFAULT_AFTER_LOGIN = "/home";

/**
 * รับเฉพาะ path ภายในเว็บและแปลง bookmark /v2 เก่าเป็น canonical path
 * ก่อนนำไปใช้หลัง login — กัน open redirect และกันวนกลับหน้า login เอง
 */
export function safeAfterLoginHref(
  value: string | null | undefined,
  fallback = DEFAULT_AFTER_LOGIN,
): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || url.pathname.startsWith("/login")) {
      return fallback;
    }

    const canonicalValue = `${legacyV2PathToCanonical(url.pathname)}${url.search}${url.hash}`;
    if (!canonicalValue.startsWith("/") || canonicalValue.startsWith("//")) {
      return fallback;
    }

    // ต้องตรวจซ้ำหลังตัด /v2: `/v2//evil.example` เริ่มต้นเป็น path ภายใน
    // แต่หลัง canonicalize จะกลายเป็น protocol-relative URL ได้
    const canonicalUrl = new URL(canonicalValue, APP_ORIGIN);
    if (
      canonicalUrl.origin !== APP_ORIGIN ||
      canonicalUrl.pathname.startsWith("/login")
    ) {
      return fallback;
    }

    return `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`;
  } catch {
    return fallback;
  }
}
