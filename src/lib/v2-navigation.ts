export type LegacySearchParams = Record<
  string,
  string | string[] | undefined
>;

const LEGACY_PREFIX = "/v2";

/** แปลงลิงก์ V2 ที่ถูกเลิกใช้แล้วกลับเป็น canonical URL โดยใช้ path boundary จริง */
export function legacyV2PathToCanonical(pathname: string): string {
  if (pathname === LEGACY_PREFIX || pathname === `${LEGACY_PREFIX}/`) return "/";
  if (pathname.startsWith(`${LEGACY_PREFIX}/`)) {
    return pathname.slice(LEGACY_PREFIX.length);
  }
  return pathname;
}

/** ต่อ query จาก App Router โดยรักษาคีย์ซ้ำ เช่น ?status=A&status=B */
export function appendSearchParams(
  pathname: string,
  searchParams: LegacySearchParams,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }

  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function legacyV2RedirectHref(
  pathname: string,
  searchParams: LegacySearchParams,
): string {
  return appendSearchParams(legacyV2PathToCanonical(pathname), searchParams);
}
