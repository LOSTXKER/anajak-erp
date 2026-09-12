"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Star, Store } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { CatalogTools, CatalogFeedback } from "@/components/settings/catalog-tools";
import { useSettingsDraftGuard } from "@/components/settings/use-settings-draft-guard";

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
  const [search, setSearch] = useState("");
  const [initialForm, setInitialForm] = useState<VendorFormState>(EMPTY_FORM);
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
  const mayDiscard = useSettingsDraftGuard(dialogOpen && JSON.stringify(form) !== JSON.stringify(initialForm), busy);
  const visibleVendors = (vendorsQuery.data ?? []).filter((vendor) => [vendor.name, vendor.phone, ...vendor.capabilities].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    createVendor.reset(); updateVendor.reset();
    setDialogOpen(true);
  }

  function openEdit(vendor: {
    id: string;
    name: string;
    phone: string | null;
    capabilities: string[];
  }) {
    setEditingId(vendor.id);
    createVendor.reset(); updateVendor.reset();
    setInitialForm({ name: vendor.name, phone: vendor.phone ?? "", capabilities: vendor.capabilities.join(", ") });
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

  return (
    <PageShell
      back={{ href: "/settings", label: "ย้อนกลับ" }}
      title="ร้านรับจ้างภายนอก"
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์ไม่ได้ กรุณาลองใหม่",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      // ไม่ส่ง loading — ระหว่างรอ me ให้โชว์ skeleton grid ใน Section ตามเดิม (denied เช็คหลัง me มาแล้วเท่านั้น)
      denied={
        !meQuery.isLoading &&
        !canManage && {
          title: "ไม่มีสิทธิ์จัดการทะเบียนร้าน",
          description:
            "หน้านี้เปิดให้เจ้าของ ผู้จัดการ หรือผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
      <Section
        title="ทะเบียนร้านที่ใช้งาน"
        description="เลือกดูตามชื่อร้านหรือประเภทงาน แล้วแก้ข้อมูลติดต่อก่อนนำไปใช้ในใบส่งร้าน"
        action={
          <Button size="sm" onClick={openCreate} disabled={!canManage}>
            <Plus />
            เพิ่มร้าน
          </Button>
        }
      >
        <CatalogTools loading={meQuery.isLoading || vendorsQuery.isLoading} search={search} onSearch={setSearch} count={visibleVendors.length} total={vendorsQuery.data?.length ?? 0} label="ร้านหรือประเภทงาน" />
        {search && visibleVendors.length === 0 ? <p role="status" className="py-6 text-sm text-secondary">ไม่พบร้านที่ตรงคำค้น</p> : null}
        {meQuery.isLoading || vendorsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-lg" />
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
                <Plus />
                เพิ่มร้านแรก
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-divider">
            {visibleVendors.map((vendor) => (
              <li
                key={vendor.id}
                className="py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-medium text-strong">
                      {vendor.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {vendor.phone || "ยังไม่มีเบอร์โทร"} · {vendor._count.outsourceOrders} งาน
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`แก้ไขร้าน ${vendor.name}`}
                    onClick={() => openEdit(vendor)}
                  >
                    <Pencil />
                  </Button>
                </div>

                <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
                  {vendor.capabilities.length > 0 ? (
                    vendor.capabilities.map((capability) => (
                      <Badge key={capability} size="sm">
                        {STEP_TYPE_LABELS[capability]?.replace(" (ร้านนอก)", "") ?? capability}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted">
                      ยังไม่ระบุประเภทงาน
                    </span>
                  )}
                  {vendor.qualityRating !== null && (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
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
        onOpenChange={async (open) => {
          if (!open && await mayDiscard()) closeDialog();
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
            <fieldset disabled={busy} className="space-y-4">
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
              help="คั่นแต่ละประเภทด้วยจุลภาค เช่น สกรีน, ปัก, เย็บ"
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
            </fieldset>
            <CatalogFeedback pending={busy} error={createVendor.error?.message || updateVendor.error?.message} />
            <DialogSubmitFooter
              pending={busy}
              disabled={!form.name.trim()}
              submitLabel="บันทึก"
              onCancel={closeDialog}
            />
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
