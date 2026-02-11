import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
} from "@/lib/order-status";
import type { CustomerStatus, InternalStatus } from "@prisma/client";

interface OrderStatusBadgeProps {
  customerStatus?: CustomerStatus;
  internalStatus?: InternalStatus;
}

/**
 * Displays dual-status badges for orders.
 * - Customer status: colored badge with dot indicator
 * - Internal status: smaller, simpler badge
 */
export function OrderStatusBadge({
  customerStatus,
  internalStatus,
}: OrderStatusBadgeProps) {
  return (
    <div className="flex flex-col gap-1">
      {customerStatus && <CustomerBadge status={customerStatus} />}
      {internalStatus && <InternalBadge status={internalStatus} />}
    </div>
  );
}

function CustomerBadge({ status }: { status: CustomerStatus }) {
  const label = CUSTOMER_STATUS_LABELS[status] ?? status;
  const colors = CUSTOMER_STATUS_COLORS[status] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

function InternalBadge({ status }: { status: InternalStatus }) {
  const label = INTERNAL_STATUS_LABELS[status] ?? status;
  const colors = INTERNAL_STATUS_COLORS[status] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}
