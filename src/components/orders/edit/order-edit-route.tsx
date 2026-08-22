"use client";

import type { InternalStatus } from "@prisma/client";
import { useState } from "react";
import OrderFormPage from "@/components/orders/new/order-create-page";
import { PageShell } from "@/components/page-shell";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { canEditOrderWithPricing } from "@/lib/order-access";
import {
  buildOrderEditFormSeed,
  type OrderEditFormSeed,
} from "@/lib/order-edit-form";
import {
  normalizeOrderFormTab,
  type OrderFormTabKey,
} from "@/lib/order-form-tabs";
import { resolvePinnedOrderEditSession } from "@/lib/order-edit-session";
import { trpc } from "@/lib/trpc";

interface OrderEditRouteProps {
  orderId: string;
  initialTab: string;
  initialFocus?: string;
  returnTab?: string;
}

interface OrderEditSession {
  orderId: string;
  orderNumber: string;
  internalStatus: InternalStatus;
  orderType: string;
  initialTab: OrderFormTabKey;
  initialFocus?: "info" | "shipping";
  returnTab?: string;
  seed: OrderEditFormSeed;
}

export function OrderEditRoute({
  orderId,
  ...props
}: OrderEditRouteProps) {
  // Next อาจรักษา client component เดิมเมื่อเปลี่ยน dynamic param — key นี้กัน
  // form state และ pinned baseline ของออเดอร์ก่อนหน้ารั่วเข้าออเดอร์ใหม่
  return <OrderEditRouteSession key={orderId} orderId={orderId} {...props} />;
}

function OrderEditRouteSession({
  orderId,
  initialTab,
  initialFocus,
  returnTab,
}: OrderEditRouteProps) {
  const meQuery = trpc.user.me.useQuery();
  const orderQuery = trpc.order.getById.useQuery({ id: orderId });
  const attachmentsQuery = trpc.attachment.listByEntity.useQuery({
    entityType: "ORDER",
    entityId: orderId,
  });
  const [session, setSession] = useState<OrderEditSession | null>(null);

  const canEdit = canEditOrderWithPricing(meQuery.data?.permissions);
  const orderNotFound =
    orderQuery.isError && orderQuery.error.data?.code === "NOT_FOUND";
  const loading =
    meQuery.isLoading ||
    orderQuery.isLoading ||
    attachmentsQuery.isLoading;
  const queryError =
    meQuery.isError ||
    (orderQuery.isError && !orderNotFound) ||
    attachmentsQuery.isError;

  // Query ยัง refetch ได้ตามปกติ แต่ form state ถูก initialize ครั้งเดียว จึงต้องตรึง
  // snapshot/token ชุดเดียวกันไว้ด้วย ไม่เช่นนั้นค่าบนจอเก่าจะถูกเทียบกับ baseline ใหม่
  // แล้ว optimistic concurrency ยอมให้ทับข้อมูลที่อีกหน้าจอเพิ่งบันทึก
  const sessionCandidate: OrderEditSession | null =
    !session &&
    canEdit &&
    meQuery.data &&
    orderQuery.data &&
    orderQuery.data.id === orderId &&
    attachmentsQuery.data
      ? {
          orderId,
          orderNumber: orderQuery.data.orderNumber,
          internalStatus: orderQuery.data.internalStatus,
          orderType: orderQuery.data.orderType,
          initialTab: normalizeOrderFormTab(initialTab) ?? "intake",
          initialFocus:
            initialFocus === "shipping"
              ? "shipping"
              : initialFocus === "info"
                ? "info"
                : undefined,
          returnTab,
          seed: buildOrderEditFormSeed(
            orderQuery.data,
            attachmentsQuery.data,
            meQuery.data,
          ),
        }
      : null;

  // Render-phase update แบบมี guard เป็น pattern ที่ React รองรับสำหรับการจำข้อมูล
  // จาก render แรก: pin ก่อน OrderFormPage mount จึงไม่มีช่องว่างให้ refetch B เลื่อน
  // baseline ระหว่าง candidate A กับ effect ภายหลัง
  if (!session && sessionCandidate) {
    setSession(
      resolvePinnedOrderEditSession(session, orderId, sessionCandidate),
    );
  }
  const displayedSession = session ?? sessionCandidate;

  // Background refetch/error ห้าม unmount ฟอร์มที่เปิดแล้ว แต่ permission response
  // ที่สำเร็จและถูกถอนยังต้อง fail closed เหมือนเดิม
  if (displayedSession && (canEdit || meQuery.isLoading || meQuery.isError)) {
    return (
      <OrderFormPage
        mode="edit"
        orderId={displayedSession.orderId}
        orderNumber={displayedSession.orderNumber}
        internalStatus={displayedSession.internalStatus}
        orderType={displayedSession.orderType}
        initialTab={displayedSession.initialTab}
        initialFocus={displayedSession.initialFocus}
        returnTab={displayedSession.returnTab}
        editSeed={displayedSession.seed}
      />
    );
  }

  return (
    <PageShell
      width="wide"
      breadcrumb={[
        { label: "ออเดอร์", href: "/orders" },
        { label: orderQuery.data?.orderNumber ?? "แก้ไขออเดอร์" },
      ]}
      title="แก้ไขออเดอร์"
      loading={loading}
      skeleton={
        <div role="status" aria-label="กำลังโหลดฟอร์มแก้ออเดอร์" className="space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      }
      error={
        queryError
          ? {
              message: "โหลดข้อมูลสำหรับแก้ไขออเดอร์ไม่สำเร็จ",
              onRetry: () => {
                if (meQuery.isError) void meQuery.refetch();
                if (orderQuery.isError) void orderQuery.refetch();
                if (attachmentsQuery.isError) void attachmentsQuery.refetch();
              },
            }
          : null
      }
      denied={
        !loading &&
        !queryError &&
        !canEdit && {
          title: "ไม่มีสิทธิ์แก้ไขออเดอร์",
          description:
            "หน้านี้มีข้อมูลราคา จึงต้องมีทั้งสิทธิ์สร้างเอกสารขายและสิทธิ์เห็นเงิน",
        }
      }
    >
      {!loading && !queryError && canEdit && !orderQuery.data ? (
        <RecordNotFound
          what="ออเดอร์ใบนี้"
          backHref="/orders"
          backLabel="กลับไปรายการออเดอร์"
        />
      ) : (
        <div />
      )}
    </PageShell>
  );
}
