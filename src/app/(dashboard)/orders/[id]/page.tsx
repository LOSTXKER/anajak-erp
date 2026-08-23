import OrderDetailPage from "@/components/orders/detail/order-detail-page";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <OrderDetailPage
      {...props}
      productionV2Enabled={productionV2Enabled()}
    />
  );
}
