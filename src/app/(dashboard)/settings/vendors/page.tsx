"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, ShieldX, Star, Store } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

interface VendorFormState {
  name: string;
  phone: string;
  capabilities: string;
}

const EMPTY_FORM: VendorFormState = {
  name: "",
  phone: "",
  capabilities: "",
};

function capabilityList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export default function VendorsSettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");
  const vendorsQuery = trpc.outsource.listVendors.useQuery(
    {},
    { enabled: canManage }
  );

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const createVendor = useMutationWithInvalidation(trpc.outsource.createVendor, {
    invalidate: [utils.outsource.listVendors],
    onSuccess: () => {
      toast.success("เพิ่มร้านแล้ว");
      closeDialog();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "เพิ่มร้านไม่สำเร็จ"),
  });
  const updateVendor = useMutationWithInvalidation(trpc.outsource.updateVendor, {
    invalidate: [utils.outsource.listVendors],
    onSuccess: () => {
      toast.success("บันทึกข้อมูลร้านแล้ว");
      closeDialog();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "บันทึกข้อมูลร้านไม่สำเร็จ"),
  });

  const busy = createVendor.isPending || updateVendor.isPending;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(vendor: {
    id: string;
    name: string;
    phone: string | null;
    capabilities: string[];
  }) {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      phone: vendor.phone ?? "",
      capabilities: vendor.capabilities.join(", "),
    });
    setDialogOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("กรอกชื่อร้านก่อนบันทึก");
      return;
    }

    const capabilities = capabilityList(form.capabilities);
    if (editingId) {
      updateVendor.mutate({
        id: editingId,
        name,
        phone: form.phone.trim() || null,
        capabilities,
      });
      return;
    }

    createVendor.mutate({
      name,
      phone: form.phone.trim() || undefined,
      capabilities,
    });
  }

  const header = (
    <SettingsPageHeader
      title="ร้านรับจ้างภายนอก"
      description="ทะเบียนร้านสำหรับงาน DTG, สกรีน, ปัก, ตัดเย็บ และป้ายคอ"
    />
  );

  if (meQuery.isError) {
    return (
      <div className="space-y-5">
        {header}
        <QueryError
          message="ตรวจสอบสิทธิ์ไม่ได้ กรุณาลองใหม่"
          onRetry={() => meQuery.refetch()}
        />
      </div>
    );
  }

  if (!meQuery.isLoading && !canManage) {
    return (
      <div className="space-y-5">
        {header}
        <Section>
          <EmptyState
            icon={ShieldX}
            title="ไม่มีสิทธิ์จัดการทะเบียนร้าน"
            description="หน้านี้เปิดให้เจ้าของ ผู้จัดการ หรือผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น"
          />
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Section
        title={`ร้านที่ใช้งานอยู่ (${vendorsQuery.data?.length ?? 0})`}
        description="เพิ่มหรือแก้ข้อมูลร้านที่เลือกใช้ตอนสร้างใบงานร้านนอก"
        action={
          <Button size="sm" onClick={openCreate} disabled={!canManage}>
            <Plus className="h-4 w-4" />
            เพิ่มร้าน
          </Button>
        }
      >
        {meQuery.isLoading || vendorsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : vendorsQuery.isError && !vendorsQuery.data ? (
          <QueryError
            message="โหลดทะเบียนร้านไม่สำเร็จ"
            onRetry={() => vendorsQuery.refetch()}
          />
        ) : !vendorsQuery.data || vendorsQuery.data.length === 0 ? (
          <EmptyState
            icon={Store}
            title="ยังไม่มีร้านรับจ้าง"
            description="เพิ่มร้านแรก แล้วร้านจะปรากฏให้เลือกตอนส่งขั้นผลิตออกไปทำภายนอก"
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                เพิ่มร้านแรก
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vendorsQuery.data.map((vendor) => (
              <li
                key={vendor.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-medium text-slate-900 dark:text-white">
                      {vendor.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {vendor.phone || "ยังไม่มีเบอร์โทร"} · {vendor._count.outsourceOrders} งาน
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`แก้ไขร้าน ${vendor.name}`}
                    onClick={() => openEdit(vendor)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
                  {vendor.capabilities.length > 0 ? (
                    vendor.capabilities.map((capability) => (
                      <Badge key={capability} size="sm">
                        {capability}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ยังไม่ระบุประเภทงาน
                    </span>
                  )}
                  {vendor.qualityRating !== null && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {vendor.qualityRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขร้าน" : "เพิ่มร้าน"}</DialogTitle>
            <DialogDescription>
              ข้อมูลนี้ใช้ในช่องเลือกร้านตอนเปิดใบงานภายนอก
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="ชื่อร้าน" required>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                autoComplete="organization"
                required
                placeholder="ชื่อร้านหรือโรงงาน"
              />
            </Field>
            <Field label="โทรศัพท์">
              <Input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                autoComplete="tel"
                placeholder="08x-xxx-xxxx"
              />
            </Field>
            <Field
              label="ประเภทงานที่รับ"
              description="คั่นแต่ละประเภทด้วยเครื่องหมายจุลภาค เช่น สกรีน, ปัก, เย็บ"
            >
              <Input
                value={form.capabilities}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capabilities: event.target.value,
                  }))
                }
                placeholder="สกรีน, ปัก, เย็บ"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={busy}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={busy || !form.name.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
