import { findActiveNavigationItem, type NavigationItem } from "@/lib/navigation";

const REDESIGN_NAVIGATION_PATHS: Readonly<Record<string, string>> = {
  dashboard: "/redesign",
  orders: "/redesign/orders",
  production: "/redesign/production",
};

export function redesignNavigationHref(
  item: Pick<NavigationItem, "id" | "href">,
): string {
  return REDESIGN_NAVIGATION_PATHS[item.id] ?? item.href;
}

export function redesignOrderHref(orderId: string): string {
  return `/redesign/orders/${encodeURIComponent(orderId)}`;
}

/** Keep dashboard/order attention drill-downs inside the prototype world. */
export function redesignOrderListHref(href: string): string {
  if (href === "/orders") return "/redesign/orders";
  if (href.startsWith("/orders?")) {
    return `/redesign/orders?${href.slice("/orders?".length)}`;
  }
  return href;
}

export function redesignActiveNavigationId(pathname: string): string | undefined {
  if (pathname === "/redesign") return "dashboard";
  if (
    pathname === "/redesign/orders" ||
    pathname.startsWith("/redesign/orders/")
  ) {
    return "orders";
  }
  if (
    pathname === "/redesign/production" ||
    pathname.startsWith("/redesign/production/")
  ) {
    return "production";
  }
  return findActiveNavigationItem(pathname)?.id;
}
