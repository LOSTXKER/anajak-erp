import OrderDetailPage from "@/components/orders/detail/order-detail-page";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <OrderDetailPage
      {...props}
      ordersBasePath="/v2/orders"
      stickyActionsOffset="v2"
      tabAppearance="underline"
    />
  );
}
