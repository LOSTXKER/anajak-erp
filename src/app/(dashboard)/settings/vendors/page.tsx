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
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ListCards, ListCardItem, ListCardMetaGrid, ListCardMeta } from "@/components/ui/list-card";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { PageShell } from "@/components/page-shell";
import { c } from "@/components/kit/kit";

/* ร้านรับจ้างภายนอก — โครงตามต้นแบบทั้งเว็บที่เบสเคาะ 2026-09-16:
   หัวหน้า + ปุ่มหลักมุมขวา → การ์ดเดียวไม่มีหัวการ์ด (ค้นหา + ตัวนับ) → ตารางเทียบร้านกันได้
   ต่างจากต้นแบบโดยตั้งใจ:
     · ต้นแบบมีคอลัมน์ "งานที่อยู่ที่ร้าน" (ยอดค้าง) กับ "ตรงเวลา/เลยนัด N ใบ" — ของจริงยังไม่มี
       ตัวเลขนั้น (listVendors คืนแค่ _count.outsourceOrders = ใบสะสมทั้งหมด) การเพิ่มยอดค้าง
       ต้องแก้ router ซึ่งใบงานนี้ห้าม จึงใช้ตัวเลขที่มีจริงและตั้งชื่อคอลัมน์ตามความหมายของมัน
     · คะแนนคุณภาพร้านและป้ายประเภทงานหลายอัน เป็นของจริงที่ต้นแบบไม่มี — เก็บไว้ครบ */

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

/** ป้ายประเภทงานที่คนอ่านเข้าใจ (ใช้ทั้งในตารางและในการค้นหา) */
function capabilityLabel(capability: string) {
  return STEP_TYPE_LABELS[capability]?.replace(" (ร้านนอก)", "") ?? capability;
}

export default function VendorsSettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);
  // listVendors ค้นได้เฉพาะชื่อร้าน/ชื่อผู้ติดต่อ แต่ต้นแบบให้ค้นประเภทงานด้วย
  // ทะเบียนร้านเป็นตารางตั้งค่าสั้น จึงกรองฝั่งจอให้ครอบคลุมทั้งสองอย่าง ไม่แตะ router
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");
  const vendorsQuery = trpc.outsource.listVendors.useQuery(
    {},
    { enabled: canManage }
  );

  const keyword = search.trim().toLowerCase();
  const vendors = keyword
    ? vendorsQuery.data?.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(keyword) ||
          vendor.capabilities.some((capability) =>
            capabilityLabel(capability).toLowerCase().includes(keyword)
          )
      )
    : vendorsQuery.data;

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

  return (
    <PageShell
      title="ร้านรับจ้างภายนอก"
      description="ร้านที่เราส่งงานออกไปทำ"
      action={
        <Button size="sm" onClick={openCreate} disabled={!canManage}>
          <Plus />
          เพิ่มร้าน
        </Button>
      }
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์ไม่ได้ กรุณาลองใหม่",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      // ไม่ส่ง loading — ระหว่างรอ me ให้โชว์โครงร่างในการ์ดรายการตามเดิม (denied เช็คหลัง me มาแล้วเท่านั้น)
      denied={
        !meQuery.isLoading &&
        !canManage && {
          title: "ไม่มีสิทธิ์จัดการทะเบียนร้าน",
          description:
            "หน้านี้เปิดให้เจ้าของ ผู้จัดการ หรือผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
      <ResponsiveList
        items={vendors}
        isLoading={meQuery.isLoading || vendorsQuery.isLoading}
        isError={vendorsQuery.isError}
        errorMessage="โหลดทะเบียนร้านไม่สำเร็จ"
        onRetry={() => vendorsQuery.refetch()}
        label="ร้าน"
        toolbar={
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อร้านหรือประเภทงาน"
              aria-label="ค้นหาร้านจากชื่อร้านหรือประเภทงาน"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ToolbarGroup align="end">
              <span className="text-xs tabular-nums whitespace-nowrap text-muted">
                {(vendors?.length ?? 0).toLocaleString("th-TH")} ร้าน
              </span>
            </ToolbarGroup>
          </Toolbar>
        }
        emptyState={
          keyword ? (
            <EmptyState
              icon={Store}
              title="ไม่พบร้านที่ค้น"
              description="ลองเปลี่ยนคำค้นหา"
              action={
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  ล้างคำค้น
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Store}
              title="ยังไม่มีร้านรับจ้าง"
              description="เพิ่มร้านแรก แล้วร้านจะปรากฏให้เลือกตอนส่งขั้นผลิตออกไปทำภายนอก"
              action={
                <Button size="sm" onClick={openCreate} disabled={!canManage}>
                  <Plus />
                  เพิ่มร้านแรก
                </Button>
              }
            />
          )
        }
        renderDesktop={(rows) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ร้าน</DataTable.Th>
                <DataTable.Th>ประเภทงาน</DataTable.Th>
                <DataTable.Th>ติดต่อ</DataTable.Th>
                <DataTable.Th align="right">งานที่ส่งไปแล้ว</DataTable.Th>
                <DataTable.Th align="right">คะแนน</DataTable.Th>
                <DataTable.Th align="right">
                  <span className="sr-only">แก้ไขร้าน</span>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((vendor) => (
                <DataTable.Row key={vendor.id}>
                  <DataTable.Td>
                    <div className={c("who")}>
                      <span className={c("thumb")} aria-hidden="true">
                        <Store />
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-strong">{vendor.name}</span>
                      </div>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td>
                    {vendor.capabilities.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {vendor.capabilities.map((capability) => (
                          <Badge key={capability} size="sm">
                            {capabilityLabel(capability)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">ยังไม่ระบุประเภทงาน</span>
                    )}
                  </DataTable.Td>
                  <DataTable.Td className="text-muted">
                    {vendor.phone || "ยังไม่มีเบอร์โทร"}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums text-strong">
                    <span className="font-medium">{vendor._count.outsourceOrders}</span> ใบ
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    {vendor.qualityRating !== null ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-amber-700 dark:text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        {vendor.qualityRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`แก้ไขร้าน ${vendor.name}`}
                      onClick={() => openEdit(vendor)}
                      disabled={!canManage}
                    >
                      <Pencil />
                    </Button>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(rows) => (
          <ListCards label="ทะเบียนร้านรับจ้าง">
            {rows.map((vendor) => (
              <ListCardItem key={vendor.id}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={c("thumb")} aria-hidden="true">
                      <Store />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-strong">{vendor.name}</p>
                      <p className="mt-0.5 text-xs text-secondary">
                        {vendor.phone || "ยังไม่มีเบอร์โทร"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`แก้ไขร้าน ${vendor.name}`}
                      onClick={() => openEdit(vendor)}
                      disabled={!canManage}
                    >
                      <Pencil />
                    </Button>
                  </div>
                  <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
                    {vendor.capabilities.length > 0 ? (
                      vendor.capabilities.map((capability) => (
                        <Badge key={capability} size="sm">
                          {capabilityLabel(capability)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-secondary">ยังไม่ระบุประเภทงาน</span>
                    )}
                  </div>
                  <ListCardMetaGrid>
                    <ListCardMeta label="งานที่ส่งไปแล้ว">
                      <span className="font-semibold tabular-nums text-strong">
                        {vendor._count.outsourceOrders}
                      </span>{" "}
                      ใบ
                    </ListCardMeta>
                    <ListCardMeta label="คะแนน" align="right">
                      {vendor.qualityRating !== null ? (
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-amber-700 dark:text-amber-300">
                          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          {vendor.qualityRating.toFixed(1)}
                        </span>
                      ) : (
                        "ยังไม่มีคะแนน"
                      )}
                    </ListCardMeta>
                  </ListCardMetaGrid>
                </div>
              </ListCardItem>
            ))}
          </ListCards>
        )}
      />

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
              ข้อมูลนี้ใช้ในช่องเลือกร้านตอนเปิดใบงานภายนอก · ร้านจะได้ลิงก์ใบงานของตัวเอง
              เห็นเฉพาะงานที่ส่งให้ ไม่เห็นราคา
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
