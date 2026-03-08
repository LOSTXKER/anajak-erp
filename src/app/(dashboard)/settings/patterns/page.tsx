"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { PRODUCT_TYPES } from "@/types/order-form";
import { uploadFile } from "@/lib/supabase";

const COLLAR_TYPES: Record<string, string> = {
  CREW_NECK: "คอกลม",
  V_NECK: "คอวี",
  POLO: "คอโปโล",
  MANDARIN: "คอจีน",
  DRESS_SHIRT: "คอเชิ้ต",
  CREW_SPLICED: "คอกลมตัดต่อ",
  HENLEY: "คอเฮนลี่",
  HOOD: "ฮู้ด",
  OTHER: "อื่นๆ",
};

const SLEEVE_TYPES: Record<string, string> = {
  SHORT: "แขนสั้น",
  LONG: "แขนยาว",
  SLEEVELESS: "แขนกุด",
  THREE_QUARTER: "แขน 3/4",
  CUFF: "แขนจั๊ม",
  RAGLAN: "แขนราคลัน",
  OTHER: "อื่นๆ",
};

const BODY_FITS: Record<string, string> = {
  SLIM: "Slim Fit",
  REGULAR: "Regular",
  RELAXED: "Relaxed",
  OVERSIZE: "Oversize",
};

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

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

  const { data: patterns, isLoading } = trpc.pattern.list.useQuery({ isActive: true });

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
    if (!editingId) return;
    updatePattern.mutate({
      id: editingId,
      name: editData.name,
      collarType: editData.collarType,
      sleeveType: editData.sleeveType,
      bodyFit: editData.bodyFit,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`ลบแพทเทิร์น "${name}" หรือไม่?`)) {
      deletePattern.mutate({ id });
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "form" | "edit",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "file";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `patterns/${uniqueName}`;
      const url = await uploadFile("designs", path, file);
      if (target === "form") {
        setFormData((prev) => ({ ...prev, fileUrl: url }));
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            จัดการแพทเทิร์น
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            แพทเทิร์นสำเร็จรูปสำหรับงานตัดเย็บ
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4" />
            แพทเทิร์นทั้งหมด
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormData({ ...emptyForm });
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            เพิ่มแพทเทิร์น
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
            >
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                เพิ่มแพทเทิร์นใหม่
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelClass}>ชื่อแพทเทิร์น *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น เสื้อยืดคอกลม Regular V2"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>ประเภทสินค้า</label>
                  <select
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- ทุกประเภท --</option>
                    {Object.entries(PRODUCT_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ทรงคอ</label>
                  <select
                    value={formData.collarType}
                    onChange={(e) => setFormData({ ...formData, collarType: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- เลือก --</option>
                    {Object.entries(COLLAR_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>แขน</label>
                  <select
                    value={formData.sleeveType}
                    onChange={(e) => setFormData({ ...formData, sleeveType: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- เลือก --</option>
                    {Object.entries(SLEEVE_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>ฟิต</label>
                  <select
                    value={formData.bodyFit}
                    onChange={(e) => setFormData({ ...formData, bodyFit: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- เลือก --</option>
                    {Object.entries(BODY_FITS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ไฟล์แพทเทิร์น</label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 transition-colors hover:border-amber-400 hover:text-amber-600 dark:border-slate-600 dark:hover:border-amber-500">
                    <input
                      type="file"
                      accept=".pdf,.ai,.svg,image/*"
                      onChange={(e) => handleFileUpload(e, "form")}
                      className="hidden"
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
            <div className="flex flex-col items-center justify-center py-12">
              <Scissors className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">ยังไม่มีแพทเทิร์น</p>
              <p className="mt-1 text-xs text-slate-400">
                เพิ่มแพทเทิร์นสำเร็จรูปเพื่อใช้ซ้ำในออเดอร์ตัดเย็บ
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">ชื่อ</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">ประเภท</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">ทรงคอ</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">แขน</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">ฟิต</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">สถานะ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {patterns.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!p.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <Input
                              value={editData.name ?? p.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {p.name}
                              </span>
                              {p.fileUrl && (
                                <a
                                  href={p.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-[10px] text-blue-500 hover:underline"
                                >
                                  ดูไฟล์
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500">
                          {p.productType ? (PRODUCT_TYPES[p.productType] ?? p.productType) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <select
                              value={editData.collarType ?? p.collarType ?? ""}
                              onChange={(e) => setEditData({ ...editData, collarType: e.target.value })}
                              className={`${selectClass} h-7 text-xs`}
                            >
                              <option value="">-</option>
                              {Object.entries(COLLAR_TYPES).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">
                              {p.collarType ? (COLLAR_TYPES[p.collarType] ?? p.collarType) : "-"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <select
                              value={editData.sleeveType ?? p.sleeveType ?? ""}
                              onChange={(e) => setEditData({ ...editData, sleeveType: e.target.value })}
                              className={`${selectClass} h-7 text-xs`}
                            >
                              <option value="">-</option>
                              {Object.entries(SLEEVE_TYPES).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">
                              {p.sleeveType ? (SLEEVE_TYPES[p.sleeveType] ?? p.sleeveType) : "-"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <select
                              value={editData.bodyFit ?? p.bodyFit ?? ""}
                              onChange={(e) => setEditData({ ...editData, bodyFit: e.target.value })}
                              className={`${selectClass} h-7 text-xs`}
                            >
                              <option value="">-</option>
                              {Object.entries(BODY_FITS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs">
                              {p.bodyFit ? (BODY_FITS[p.bodyFit] ?? p.bodyFit) : "-"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate({ id: p.id, isActive: !p.isActive })}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                              p.isActive ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                p.isActive ? "translate-x-4" : "translate-x-0.5"
                              } mt-0.5`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={updatePattern.isPending}
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingId(null); setEditData({}); }}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingId(p.id); setEditData({}); }}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(p.id, p.name)}
                                disabled={deletePattern.isPending}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(createPattern.isError || updatePattern.isError || deletePattern.isError) && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {createPattern.error?.message || updatePattern.error?.message || deletePattern.error?.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
