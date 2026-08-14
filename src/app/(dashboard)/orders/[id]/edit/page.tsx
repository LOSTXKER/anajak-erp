import { OrderEditRoute } from "@/components/orders/edit/order-edit-route";
import {
  ORDER_FORM_DEFAULT_TAB,
  normalizeOrderFormTab,
} from "@/lib/order-form-tabs";
import { ORDER_DEFAULT_TAB, normalizeOrderTab } from "@/lib/order-tabs";
import type { OrderEditFocus } from "@/lib/order-edit-navigation";

interface OrderEditPageSearchParams {
  tab?: string | string[];
  focus?: string | string[];
  returnTab?: string | string[];
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizeFocus(value: string | null): OrderEditFocus | undefined {
  return value === "info" || value === "shipping" ? value : undefined;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<OrderEditPageSearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const initialTab =
    normalizeOrderFormTab(firstQueryValue(query.tab)) ?? ORDER_FORM_DEFAULT_TAB;
  const initialFocus = normalizeFocus(firstQueryValue(query.focus));
  const returnTab = normalizeOrderTab(firstQueryValue(query.returnTab)) ?? ORDER_DEFAULT_TAB;

  return (
    <OrderEditRoute
      orderId={id}
      initialTab={initialTab}
      initialFocus={initialFocus}
      returnTab={returnTab}
    />
  );
}
