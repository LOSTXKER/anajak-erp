"use client";

import { useState } from "react";
import { Factory } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function CreateWorkOrderDialog({
  orderId,
  onClose,
  onCreated,
}: {
  orderId: string;
  onClose: () => void;
  onCreated: (workOrder: { id: string }) => void;
}) {
  const context = trpc.manufacturing.creationContext.useQuery(
    { orderId },
    { gcTime: 0, staleTime: 0 },
  );
  const [routingVersionId, setRoutingVersionId] = useState("");
  const [commandId] = useState(() => crypto.randomUUID());
  const utils = trpc.useUtils();
  const create = trpc.manufacturing.createWorkOrder.useMutation({
    onSuccess: async (workOrder) => {
      await Promise.all([
        utils.manufacturing.controlList.invalidate(),
        utils.manufacturing.workCenterLoad.invalidate(),
        utils.order.getById.invalidate({ id: orderId }),
        utils.task.myToday.invalidate(),
      ]);
      toast.success(`เปิด ${workOrder.workOrderNumber} แล้ว`, {
        description: "ตรวจเส้นทางและข้อมูลอ้างอิงก่อนกดปล่อยผลิต",
      });
      onCreated(workOrder);
    },
    onError: (error) => toast.error(error.message),
  });
  const selectedId =
    routingVersionId || context.data?.routingVersions[0]?.id || "";
  const selected = context.data?.routingVersions.find(
    (routing) => routing.id === selectedId,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>เปิดใบสั่งผลิต</DialogTitle>
          <DialogDescription>
            {context.data
              ? `${context.data.order.orderNumber} · ${context.data.order.title}`
              : "เลือกเส้นทางมาตรฐานที่ใช้กับงานนี้"}
          </DialogDescription>
        </DialogHeader>

        {context.isError ? (
          <QueryError
            message="โหลดข้อมูลสำหรับเปิดใบสั่งผลิตไม่สำเร็จ"
            onRetry={() => void context.refetch()}
          />
        ) : context.isLoading || !context.data ? (
          <div className="space-y-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : context.data.routingVersions.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="ยังไม่มีเส้นทางผลิตที่พร้อมใช้"
            description="ให้หัวหน้าตั้งและอนุมัติเส้นทางผลิตก่อนเปิดใบสั่งผลิต ระบบจะไม่เดาขั้นงานแทน"
          />
        ) : (
          <>
            {context.data.existingWorkOrders.length > 0 ? (
              <Alert variant="error" title="ออเดอร์นี้มีใบผลิตอยู่แล้ว">
                ระบบจะไม่เปิดใบผลิตอีกชุดซ้อนกัน ให้หัวหน้าตรวจใบผลิตเดิมก่อน
              </Alert>
            ) : null}
            <label className="space-y-1.5 text-sm font-medium text-strong">
              <span>เส้นทางผลิต</span>
              <Select
                value={selectedId}
                onChange={(event) => setRoutingVersionId(event.target.value)}
              >
                {context.data.routingVersions.map((routing) => (
                  <option key={routing.id} value={routing.id}>
                    {routing.routing.name} · ฉบับ {routing.versionNumber}
                  </option>
                ))}
              </Select>
            </label>
            {selected ? (
              <section className="rounded-lg bg-surface-muted p-4">
                <h3 className="font-semibold text-strong">ลำดับงานที่จะสร้าง</h3>
                <ol className="mt-3 space-y-2">
                  {selected.operations.map((operation, index) => (
                    <li key={operation.id} className="flex items-start gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span>
                        <span className="font-medium text-strong">{operation.name}</span>
                        <span className="block text-xs text-muted">
                          {operation.workCenter?.name ?? "ยังไม่ระบุจุดทำงาน"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <p className="text-xs text-muted">
              ใบนี้จะเริ่มเป็นร่าง พร้อมสำเนาเส้นทาง คำสั่ง และแบบที่อนุมัติ จากนั้นหัวหน้าตรวจแล้วจึงปล่อยเข้าคิวค่ะ
            </p>
            <DialogSubmitFooter
              pending={create.isPending}
              disabled={
                !selectedId || context.data.existingWorkOrders.length > 0
              }
              submitLabel="สร้างใบสั่งผลิตฉบับร่าง"
              pendingLabel="กำลังสร้าง..."
              submitIcon={<Factory />}
              onCancel={onClose}
              onSubmit={() =>
                create.mutate({
                  orderId,
                  routingVersionId: selectedId,
                  commandId,
                  expectedRevision: 0,
                })
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
