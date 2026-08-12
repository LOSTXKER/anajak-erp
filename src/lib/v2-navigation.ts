import {
  findActiveNavigationItem,
  type NavigationItem,
} from "@/lib/navigation";

const V2_PREFIX = "/v2";
const ORDERS_PATH = "/orders";

function splitInternalHref(href: string): { pathname: string; suffix: string } {
  const suffixIndex = href.search(/[?#]/);
  if (suffixIndex === -1) return { pathname: href, suffix: "" };
  return {
    pathname: href.slice(0, suffixIndex),
    suffix: href.slice(suffixIndex),
  };
}

function isOrdersPath(pathname: string): boolean {
  return pathname === ORDERS_PATH || pathname.startsWith(`${ORDERS_PATH}/`);
}

/**
 * พาเฉพาะ route ที่มีหน้า V2 จริงเข้า shell ใหม่ — route อื่นต้องคง URL เดิม
 * เพื่อไม่ให้เมนู/ผลค้นหาพาไป 404 ระหว่างทยอยย้ายทีละโมดูล
 */
export function resolveV2Href(href: string): string {
  const { pathname, suffix } = splitInternalHref(href);
  if (pathname === "/") return `${V2_PREFIX}${suffix}`;
  if (!isOrdersPath(pathname)) return href;
  return `${V2_PREFIX}${pathname}${suffix}`;
}

/** แปลง pathname ใน V2 กลับเป็นชื่อ route กลาง เพื่อใช้ registry active-state ชุดเดิม */
export function v2NavigationPathname(pathname: string): string {
  const { pathname: path } = splitInternalHref(pathname);
  if (path === V2_PREFIX || path === `${V2_PREFIX}/`) return "/";

  if (path.startsWith(`${V2_PREFIX}/`)) {
    const unprefixed = path.slice(V2_PREFIX.length);
    if (isOrdersPath(unprefixed)) return unprefixed;
  }

  return path;
}

export function findActiveV2NavigationItem(
  pathname: string,
  items?: readonly NavigationItem[],
): NavigationItem | undefined {
  return findActiveNavigationItem(v2NavigationPathname(pathname), items);
}
