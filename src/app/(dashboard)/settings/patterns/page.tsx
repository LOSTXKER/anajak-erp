"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Scissors,
  Upload,
} from "lucide-react";
import { PRODUCT_TYPES, COLLAR_TYPES, SLEEVE_TYPES, BODY_FITS } from "@/types/order-form";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
import { permAllows } from "@/lib/permissions";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { DASHED_INTERACTIVE } from "@/components/ui/tokens";
import { PageShell } from "@/components/page-shell";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { SegmentedControl } from "@/components/ui/segmented";
import { c } from "@/components/kit/kit";

const labelClass = "mb-1 block text-xs font-medium text-muted";

/** ตัวกรองสถานะ — เดิม query ล็อก isActive:true ทำให้กดปิดแล้วแถวหายถาวร เปิดกลับไม่ได้ */
type ActiveFilter = "active" | "inactive" | "all";

const ACTIVE_FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: "active", label: "ใช้งาน" },
  { value: "inactive", label: "ปิด" },
  { value: "all", label: "ทั้งหมด" },
];

type NewPatternForm = {
  name: string;
  productType: string;
  collarType: string;
  sleeveType: string;
  bodyFit: string;
  description: string;
  fileUrl: string;
};

const emptyForm: NewPatternForm = {
  name: "",
  productType: "",
  collarType: "",
  sleeveType: "",
  bodyFit: "",
  description: "",
  fileUrl: "",
};

export default function PatternsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<NewPatternForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<NewPatternForm>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();

  const meQuery = trpc.user.me.useQuery();
  const canCreate = permAllows(meQuery.data?.permissions, "create_design_assets");
  const canEdit = permAllows(meQuery.data?.permissions, "manage_design_files");
  const canDelete = permAllows(meQuery.data?.permissions, "manage_settings");
  const { data, isLoading, isError, refetch } = trpc.pattern.list.useQuery({
    isActive: activeFilter === "all" ? undefined : activeFilter === "active",
    search: search.trim() || undefined,
  });
  const patterns = data?.patterns;
  const filtered = search.trim().length > 0 || activeFilter !== "active";

  const createPattern = trpc.pattern.create.useMutation({
    onSuccess: () => {
      utils.pattern.list.invalidate();
      setShowAddForm(false);
      setFormData({ ...emptyForm });
    },
  });

  const updatePattern = trpc.pattern.update.useMutation({
    onSuccess: () => {
      utils.pattern.list.invalidate();
      setEditingId(null);
      setEditData({});
    },
  });

  const deletePattern = useMutationWithInvalidation(trpc.pattern.delete, {
    invalidate: [utils.pattern.list],
  });

  const toggleActive = useMutationWithInvalidation(trpc.pattern.update, {
    invalidate: [utils.pattern.list],
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    createPattern.mutate({
      name: formData.name,
      productType: formData.productType || undefined,
      collarType: formData.collarType || undefined,
      sleeveType: formData.sleeveType || undefined,
      bodyFit: formData.bodyFit || undefined,
      fileUrl: formData.fileUrl || undefined,
      description: formData.description || undefined,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId || !canEdit) return;
    updatePattern.mutate({
      id: editingId,
      name: editData.name,
      collarType: editData.collarType,
      sleeveType: editData.sleeveType,
      bodyFit: editData.bodyFit,
      description: editData.description,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete) return;
    const ok = await confirmDialog({
      title: `ลบแพทเทิร์น "${name}"?`,
      confirmText: "ลบแพทเทิร์น",
      destructive: true,
    });
    if (ok) deletePattern.mutate({ id });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "form" | "edit",
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
      const path = `patterns/${uniqueName}`;
      const url = await uploadFile("designs", path, file);
      if (target === "form") {
        setFormData((prev) => ({ ...prev, fileUrl: url }));
      }
    } catch {
      setUploadError("อัปโหลดไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์เพื่อลองอีกครั้ง");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  return (
    <PageShell
      title="แพทเทิร์น"
      description="แบบตัดเย็บสำเร็จรูปที่หยิบมาใช้ซ้ำในออเดอร์ตัดเย็บ"
      /* ปุ่มเพิ่มอยู่มุมขวาบนของหน้าตามต้นแบบ (2026-09-16) — เดิมซ่อนอยู่ในหัวการ์ด */
      action={
        canCreate ? (
          <Button
            disabled={createPattern.isPending || uploading}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormData({ ...emptyForm });
              setUploadError(null);
            }}
          >
            <Plus />
            เพิ่มแพทเทิร์น
          </Button>
        ) : undefined
      }
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์จัดการแพทเทิร์นไม่สำเร็จ",
              onRetry: () => void meQuery.refetch(),
            }
          : // && !data: refetch เบื้องหลังล้มระหว่างกรอกฟอร์มสร้าง/แก้ ห้ามถอนหน้า
            isError && !data
            ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => void refetch() }
            : null
      }
    >
      {/* การ์ดรายการตามต้นแบบ (.card.lst): แถบเครื่องมือบนสุด → ตาราง → แถบสรุปท้ายการ์ด */}
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="px-4.5 pt-3.5 pb-2.5">
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อแพทเทิร์น"
              aria-label="ค้นชื่อแพทเทิร์นหรือข้อควรรู้"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ToolbarGroup className="flex-wrap">
              <SegmentedControl
                value={activeFilter}
                onChange={(value) => setActiveFilter(value)}
                options={ACTIVE_FILTERS}
                aria-label="กรองสถานะแพทเทิร์น"
              />
              {filtered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("active");
                  }}
                >
                  ล้างตัวกรอง
                </Button>
              ) : null}
            </ToolbarGroup>
            {/* ตัวนับท้ายแถบเครื่องมือตามต้นแบบ (.tools .cnt) — นับตามตัวกรองที่เลือกอยู่ */}
            {data ? (
              <ToolbarGroup align="end">
                <span className="tabular-nums text-xs text-muted" aria-live="polite">
                  {data.total.toLocaleString("th-TH")} แบบ
                </span>
              </ToolbarGroup>
            ) : null}
          </Toolbar>
        </div>

        <div className="border-t border-divider/60">
          {showAddForm && canCreate && (
            <form onSubmit={handleCreate} className="space-y-3 border-b border-divider/60 px-4.5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="pattern-name" className={labelClass}>ชื่อแพทเทิร์น *</label>
                  <Input
                    id="pattern-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น เสื้อยืดคอกลม Regular V2"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pattern-product-type" className={labelClass}>ประเภทสินค้า</label>
                  <Select
                    id="pattern-product-type"
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  >
                    <option value="">ทุกประเภท</option>
                    {Object.entries(PRODUCT_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="pattern-collar-type" className={labelClass}>ทรงคอ</label>
                  <Select
                    id="pattern-collar-type"
                    value={formData.collarType}
                    onChange={(e) => setFormData({ ...formData, collarType: e.target.value })}
                  >
                    <option value="">เลือก</option>
                    {Object.entries(COLLAR_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="pattern-sleeve-type" className={labelClass}>แขน</label>
                  <Select
                    id="pattern-sleeve-type"
                    value={formData.sleeveType}
                    onChange={(e) => setFormData({ ...formData, sleeveType: e.target.value })}
                  >
                    <option value="">เลือก</option>
                    {Object.entries(SLEEVE_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="pattern-body-fit" className={labelClass}>ฟิต</label>
                  <Select
                    id="pattern-body-fit"
                    value={formData.bodyFit}
                    onChange={(e) => setFormData({ ...formData, bodyFit: e.target.value })}
                  >
                    <option value="">เลือก</option>
                    {Object.entries(BODY_FITS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </div>
                {/* ข้อควรรู้ = Pattern.description ที่ router รับอยู่แล้ว แต่เดิมไม่มีช่องให้กรอก */}
                <div>
                  <label htmlFor="pattern-description" className={labelClass}>ข้อควรรู้</label>
                  <Input
                    id="pattern-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="เช่น อกแคบกว่าปกติ 2 ซม."
                  />
                </div>
                <div>
                  <label htmlFor="pattern-file" className={labelClass}>ไฟล์แพทเทิร์น</label>
                  <label className={cn(CONTROL_MIN_H, DASHED_INTERACTIVE, "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400")}>
                    <input
                      id="pattern-file"
                      type="file"
                      accept=".pdf,.ai,.svg,image/*"
                      onChange={(e) => handleFileUpload(e, "form")}
                      className="sr-only"
                      disabled={uploading || createPattern.isPending}
                      aria-describedby={uploadError ? "pattern-upload-error" : undefined}
                    />
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "กำลังอัพโหลด..." : formData.fileUrl ? "อัพโหลดแล้ว" : "อัพโหลดไฟล์"}
                  </label>
                  {uploadError ? <Alert id="pattern-upload-error" variant="error" className="mt-2">{uploadError}</Alert> : null}
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1"
                    disabled={createPattern.isPending || uploading}
                  >
                    {createPattern.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                    disabled={createPattern.isPending || uploading}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3 px-4.5 py-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !patterns || patterns.length === 0 ? (
            <EmptyState
              icon={Scissors}
              title={filtered ? "ไม่พบแพทเทิร์นตามตัวกรอง" : "ยังไม่มีแพทเทิร์น"}
              description={
                filtered
                  ? "ลองเปลี่ยนคำค้นหรือเลือกสถานะ “ทั้งหมด”"
                  : "เพิ่มแพทเทิร์นสำเร็จรูปเพื่อใช้ซ้ำในออเดอร์ตัดเย็บ"
              }
            />
          ) : (
            <DataTable.Root bordered={false}>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>แพทเทิร์น</DataTable.Th>
                  <DataTable.Th>ประเภท</DataTable.Th>
                  <DataTable.Th align="center">ทรงคอ</DataTable.Th>
                  <DataTable.Th align="center">แขน</DataTable.Th>
                  <DataTable.Th align="center">ฟิต</DataTable.Th>
                  <DataTable.Th>ข้อควรรู้</DataTable.Th>
                  <DataTable.Th align="center">สถานะ</DataTable.Th>
                  {(canEdit || canDelete) && (
                    <DataTable.Th align="right">จัดการ</DataTable.Th>
                  )}
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {patterns.map((p) => {
                  const isEditing = canEdit && editingId === p.id;
                  return (
                    <DataTable.Row
                      key={p.id}
                      className={!p.isActive ? "opacity-50" : undefined}
                    >
                      <DataTable.Td>
                        {isEditing ? (
                          <Input size="sm"
                            disabled={updatePattern.isPending}
                            aria-label={`ชื่อแพทเทิร์น ${p.name}`}
                            value={editData.name ?? p.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        ) : (
                          /* ชื่อมีกล่องไอคอนกรรไกรนำตามต้นแบบ (.who + .thumb) */
                          <div className={c("who")}>
                            <span className={c("thumb")} aria-hidden="true">
                              <Scissors />
                            </span>
                            <div className={c("t")}>
                              <div className={c("id")}>
                                <span className="font-medium text-strong">{p.name}</span>
                                {p.fileUrl && (
                                  <a
                                    href={p.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(CONTROL_MIN_H, "inline-flex items-center text-xs text-blue-600 dark:text-blue-400")}
                                  >
                                    ดูไฟล์
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </DataTable.Td>
                      <DataTable.Td className="text-muted">
                        {p.productType ? (PRODUCT_TYPES[p.productType] ?? p.productType) : "-"}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        {isEditing ? (
                          <Select size="sm"
                            disabled={updatePattern.isPending}
                            aria-label={`ทรงคอของ ${p.name}`}
                            value={editData.collarType ?? p.collarType ?? ""}
                            onChange={(e) => setEditData({ ...editData, collarType: e.target.value })}
                          >
                            <option value="">-</option>
                            {Object.entries(COLLAR_TYPES).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs">
                            {p.collarType ? (COLLAR_TYPES[p.collarType] ?? p.collarType) : "-"}
                          </span>
                        )}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        {isEditing ? (
                          <Select size="sm"
                            disabled={updatePattern.isPending}
                            aria-label={`แขนของ ${p.name}`}
                            value={editData.sleeveType ?? p.sleeveType ?? ""}
                            onChange={(e) => setEditData({ ...editData, sleeveType: e.target.value })}
                          >
                            <option value="">-</option>
                            {Object.entries(SLEEVE_TYPES).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs">
                            {p.sleeveType ? (SLEEVE_TYPES[p.sleeveType] ?? p.sleeveType) : "-"}
                          </span>
                        )}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        {isEditing ? (
                          <Select size="sm"
                            disabled={updatePattern.isPending}
                            aria-label={`ฟิตของ ${p.name}`}
                            value={editData.bodyFit ?? p.bodyFit ?? ""}
                            onChange={(e) => setEditData({ ...editData, bodyFit: e.target.value })}
                          >
                            <option value="">-</option>
                            {Object.entries(BODY_FITS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs">
                            {p.bodyFit ? (BODY_FITS[p.bodyFit] ?? p.bodyFit) : "-"}
                          </span>
                        )}
                      </DataTable.Td>
                      <DataTable.Td className="text-muted">
                        {isEditing ? (
                          <Input size="sm"
                            disabled={updatePattern.isPending}
                            aria-label={`ข้อควรรู้ของ ${p.name}`}
                            value={editData.description ?? p.description ?? ""}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            placeholder="เช่น อกแคบกว่าปกติ 2 ซม."
                          />
                        ) : (
                          <span className="text-xs">{p.description || "-"}</span>
                        )}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        {canEdit ? (
                          <Switch
                            checked={p.isActive}
                            aria-label={`${p.isActive ? "ปิด" : "เปิด"}ใช้งานแพทเทิร์น ${p.name}`}
                            onCheckedChange={() => toggleActive.mutate({ id: p.id, isActive: !p.isActive })}
                          />
                        ) : (
                          <Badge variant={p.isActive ? "success" : "default"} size="sm">
                            {p.isActive ? "ใช้งาน" : "ปิด"}
                          </Badge>
                        )}
                      </DataTable.Td>
                      {(canEdit || canDelete) && (
                      <DataTable.Td align="right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={handleSaveEdit}
                              disabled={updatePattern.isPending}
                              className="text-green-600 dark:text-green-400"
                              aria-label={`บันทึกการแก้ไข ${p.name}`}
                            >
                              <Check />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => { setEditingId(null); setEditData({}); }}
                              disabled={updatePattern.isPending}
                              aria-label={`ยกเลิกการแก้ไข ${p.name}`}
                            >
                              <X />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => { setEditingId(p.id); setEditData({}); }}
                                className="text-muted"
                                disabled={updatePattern.isPending}
                                aria-label={`แก้ไขแพทเทิร์น ${p.name}`}
                              >
                                <Pencil />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDelete(p.id, p.name)}
                                disabled={deletePattern.isPending}
                                className="text-muted"
                                aria-label={`ลบแพทเทิร์น ${p.name}`}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        )}
                      </DataTable.Td>
                      )}
                    </DataTable.Row>
                  );
                })}
              </DataTable.Body>
            </DataTable.Root>
          )}

          {(createPattern.isError || updatePattern.isError || deletePattern.isError) && (
            <Alert variant="error" className="mx-4.5 mb-4">
              {createPattern.error?.message || updatePattern.error?.message || deletePattern.error?.message}
            </Alert>
          )}
        </div>

        {/* แถบสรุปเกณฑ์ท้ายการ์ดตามต้นแบบ (.tfoot) — ข้อเท็จจริงของระบบจริง ไม่ใช่คำโปรย */}
        <div className={c("tfoot")}>
          แพทเทิร์นที่ <b>ปิดใช้งาน</b> จะไม่ขึ้นให้เลือกในออเดอร์ตัดเย็บ · แก้แล้วมีผลกับงานที่เปิดหลังจากนี้
        </div>
      </section>
    </PageShell>
  );
}
