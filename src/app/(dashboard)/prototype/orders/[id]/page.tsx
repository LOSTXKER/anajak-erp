import { OrderWorkbenchPrototype } from "@/components/orders/prototype/order-workbench-prototype";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <OrderWorkbenchPrototype {...props} />;
}
