"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { SettingsPageHeader } from "@/components/settings-page-header";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Package,
  GripVertical,
  ShieldX,
} from "lucide-react";

export default function PackagingSettingsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");

  const { data: options, isLoading, isError, refetch } = trpc.packaging.list.useQuery(
    { includeInactive: true },
    { enabled: canManage },
  );

  const createMutation = trpc.packaging.create.useMutation({
    onSuccess: () => {
      utils.packaging.list.invalidate();
      setShowAddForm(false);
      setNewName("");
    },
  });

  const updateMutation = trpc.packaging.update.useMutation({
    onSuccess: () => {
      utils.packaging.list.invalidate();
      setEditingId(null);
      setEditName("");
    },
  });

  const deleteMutation = trpc.packaging.delete.useMutation({
    onSuccess: () => {
      utils.packaging.list.invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim() });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editName.trim() });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateMutation.mutate({ id, isActive: !currentActive });
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `ปิดการใช้งาน "${name}"?`,
      description: "รายการที่ปิดจะไม่ขึ้นให้เลือกตอนสร้างออเดอร์ — เปิดกลับได้ภายหลัง",
      confirmText: "ปิดการใช้งาน",
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id });
  };

  const header = (
    <SettingsPageHeader
      title="จัดการแพ็คเกจจัดส่ง"
      description="ตัวเลือกแพ็คเกจสำหรับจัดส่งสินค้า"
    />
  );

  if (meQuery.isError) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          message="ตรวจสอบสิทธิ์หน้าจัดการแพ็คเกจไม่ได้"
          onRetry={() => void meQuery.refetch()}
        />
      </div>
    );
  }

  if (meQuery.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <EmptyState
              icon={ShieldX}
              title="ไม่มีสิทธิ์จัดการแพ็คเกจ"
              description="หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // && !options: refetch เบื้องหลังล้มระหว่างกรอกฟอร์มสร้าง/แก้ ห้ามถอนหน้า
  if (isError && !options) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          message="โหลดรายการแพ็คเกจไม่สำเร็จ"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            แพ็คเกจทั้งหมด
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setNewName("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            เพิ่มแพ็คเกจ
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="card-surface mb-4 flex items-end gap-3 rounded-2xl p-4"
            >
              <div className="flex-1">
                <label htmlFor="new-packaging-name" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  ชื่อแพ็คเกจ *
                </label>
                <Input
                  id="new-packaging-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ถุง OPP, กล่อง, ซองไปรษณีย์"
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                ยกเลิก
              </Button>
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !options || options.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">ยังไม่มีแพ็คเกจ</p>
              <p className="mt-1 text-xs text-slate-400">
                เพิ่มตัวเลือกแพ็คเกจเพื่อใช้ในออเดอร์
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th scope="col" aria-label="ลำดับ" className="w-8 px-3 py-2.5" />
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      ชื่อแพ็คเกจ
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      ลำดับ
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      สถานะ
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {options.map((opt) => {
                    const isEditing = editingId === opt.id;
                    return (
                      <tr
                        key={opt.id}
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!opt.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <GripVertical aria-hidden="true" className="inline h-4 w-4 text-slate-300" />
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <Input
                              aria-label={`ชื่อแพ็คเกจ ${opt.name}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                              }}
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {opt.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-400">
                          {opt.sortOrder}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Switch
                            aria-label={`${opt.isActive ? "ปิด" : "เปิด"}การใช้งาน ${opt.name}`}
                            checked={opt.isActive}
                            onCheckedChange={() => handleToggleActive(opt.id, opt.isActive)}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`บันทึกการแก้ไข ${opt.name}`}
                                onClick={handleSaveEdit}
                                disabled={updateMutation.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`ยกเลิกการแก้ไข ${opt.name}`}
                                onClick={() => { setEditingId(null); setEditName(""); }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`แก้ไข ${opt.name}`}
                                onClick={() => { setEditingId(opt.id); setEditName(opt.name); }}
                                className="text-slate-500 hover:text-blue-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`ปิดการใช้งาน ${opt.name}`}
                                onClick={() => handleDelete(opt.id, opt.name)}
                                disabled={deleteMutation.isPending}
                                className="text-slate-500 hover:text-red-600"
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

          {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
            <div role="alert" aria-live="polite" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
