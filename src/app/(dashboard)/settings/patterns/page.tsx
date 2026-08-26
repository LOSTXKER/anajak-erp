"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const labelClass = "mb-1 block text-xs font-medium text-muted";

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

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();

  const meQuery = trpc.user.me.useQuery();
  const canCreate = permAllows(meQuery.data?.permissions, "create_design_assets");
  const canEdit = permAllows(meQuery.data?.permissions, "manage_design_files");
  const canDelete = permAllows(meQuery.data?.permissions, "manage_settings");
  const { data, isLoading, isError, refetch } = trpc.pattern.list.useQuery({ isActive: true });
  const patterns = data?.patterns;

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
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
      const path = `patterns/${uniqueName}`;
      const url = await uploadFile("designs", path, file);
      if (target === "form") {
        setFormData((prev) => ({ ...prev, fileUrl: url }));
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageShell
      // เข้าหน้านี้จาก sidebar กลุ่ม "สินค้า" — ปุ่มย้อนต้องพากลับที่ที่เคยผ่าน ไม่ใช่ตั้งค่า
      back={{ href: "/products", label: "กลับไปหน้าสินค้า" }}
      title="จัดการแพทเทิร์น"
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4" />
            แพทเทิร์นทั้งหมด
          </CardTitle>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormData({ ...emptyForm });
              }}
            >
              <Plus className="mr-1" />
              เพิ่มแพทเทิร์น
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddForm && canCreate && (
            <form
              onSubmit={handleCreate}
              className="card-surface mb-4 space-y-3 rounded-2xl p-4"
            >
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <div>
                  <label htmlFor="pattern-file" className={labelClass}>ไฟล์แพทเทิร์น</label>
                  <label className={cn(CONTROL_MIN_H, DASHED_INTERACTIVE, "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:border-amber-600 hover:text-amber-700 focus-within:ring-2 focus-within:ring-blue-500 dark:hover:border-amber-400 dark:hover:text-amber-300 dark:focus-within:ring-blue-400")}>
                    <input
                      id="pattern-file"
                      type="file"
                      accept=".pdf,.ai,.svg,image/*"
                      onChange={(e) => handleFileUpload(e, "form")}
                      className="sr-only"
                      disabled={uploading}
                    />
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "กำลังอัพโหลด..." : formData.fileUrl ? "อัพโหลดแล้ว" : "อัพโหลดไฟล์"}
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1"
                    disabled={createPattern.isPending}
                  >
                    {createPattern.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !patterns || patterns.length === 0 ? (
            <EmptyState icon={Scissors} title="ยังไม่มีแพทเทิร์น" description="เพิ่มแพทเทิร์นสำเร็จรูปเพื่อใช้ซ้ำในออเดอร์ตัดเย็บ" />
          ) : (
            <DataTable.Root bordered={false}>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>ชื่อ</DataTable.Th>
                  <DataTable.Th>ประเภท</DataTable.Th>
                  <DataTable.Th align="center">ทรงคอ</DataTable.Th>
                  <DataTable.Th align="center">แขน</DataTable.Th>
                  <DataTable.Th align="center">ฟิต</DataTable.Th>
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
                            aria-label={`ชื่อแพทเทิร์น ${p.name}`}
                            value={editData.name ?? p.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        ) : (
                          <div>
                            <span className="text-sm font-medium text-strong">
                              {p.name}
                            </span>
                            {p.fileUrl && (
                              <a
                                href={p.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(CONTROL_MIN_H, "ml-2 inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400")}
                              >
                                ดูไฟล์
                              </a>
                            )}
                          </div>
                        )}
                      </DataTable.Td>
                      <DataTable.Td className="text-muted">
                        {p.productType ? (PRODUCT_TYPES[p.productType] ?? p.productType) : "-"}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        {isEditing ? (
                          <Select size="sm"
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
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={updatePattern.isPending}
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              aria-label={`บันทึกการแก้ไข ${p.name}`}
                            >
                              <Check />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingId(null); setEditData({}); }}
                              className="h-7 w-7 p-0"
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
                                size="sm"
                                onClick={() => { setEditingId(p.id); setEditData({}); }}
                                className="h-8 w-8 p-0 text-muted hover:text-strong dark:hover:text-strong"
                                aria-label={`แก้ไขแพทเทิร์น ${p.name}`}
                              >
                                <Pencil />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(p.id, p.name)}
                                disabled={deletePattern.isPending}
                                className="h-8 w-8 p-0 text-muted hover:text-red-600 dark:hover:text-red-400"
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
            <Alert variant="error" className="mt-3">
              {createPattern.error?.message || updatePattern.error?.message || deletePattern.error?.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
