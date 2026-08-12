import OrdersPage from "@/components/orders/orders-page";

export default function Page() {
  return <OrdersPage ordersBasePath="/v2/orders" variant="v2" />;
}
