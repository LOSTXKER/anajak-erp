"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Package,
  GripVertical,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { PageShell } from "@/components/page-shell";

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

  return (
    <PageShell
      back={{ href: "/settings", label: "ย้อนกลับ" }}
      title="จัดการแพ็คเกจจัดส่ง"
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์หน้าจัดการแพ็คเกจไม่ได้",
              onRetry: () => void meQuery.refetch(),
            }
          : // && !options: refetch เบื้องหลังล้มระหว่างกรอกฟอร์มสร้าง/แก้ ห้ามถอนหน้า
            isError && !options
            ? { message: "โหลดรายการแพ็คเกจไม่สำเร็จ", onRetry: () => void refetch() }
            : null
      }
      denied={
        !canManage && {
          title: "ไม่มีสิทธิ์จัดการแพ็คเกจ",
          description: "หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
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
            <Plus className="mr-1" />
            เพิ่มแพ็คเกจ
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="card-surface mb-4 flex items-end gap-3 rounded-xl p-4"
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
            <DataTable.Root bordered={false}>
              <DataTable.Head>
                <tr>
                  <DataTable.Th aria-label="ลำดับ" className="w-8" />
                  <DataTable.Th>ชื่อแพ็คเกจ</DataTable.Th>
                  <DataTable.Th align="center">ลำดับ</DataTable.Th>
                  <DataTable.Th align="center">สถานะ</DataTable.Th>
                  <DataTable.Th align="right">จัดการ</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {options.map((opt) => {
                  const isEditing = editingId === opt.id;
                  return (
                    <DataTable.Row
                      key={opt.id}
                      className={!opt.isActive ? "opacity-50" : undefined}
                    >
                      <DataTable.Td align="center">
                        <GripVertical aria-hidden="true" className="inline h-4 w-4 text-slate-300" />
                      </DataTable.Td>
                      <DataTable.Td>
                        {isEditing ? (
                          <Input size="sm"
                            aria-label={`ชื่อแพ็คเกจ ${opt.name}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
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
                      </DataTable.Td>
                      <DataTable.Td align="center" className="text-xs text-slate-400">
                        {opt.sortOrder}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        <Switch
                          aria-label={`${opt.isActive ? "ปิด" : "เปิด"}การใช้งาน ${opt.name}`}
                          checked={opt.isActive}
                          onCheckedChange={() => handleToggleActive(opt.id, opt.isActive)}
                        />
                      </DataTable.Td>
                      <DataTable.Td align="right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`บันทึกการแก้ไข ${opt.name}`}
                              onClick={handleSaveEdit}
                              disabled={updateMutation.isPending}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            >
                              <Check />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`ยกเลิกการแก้ไข ${opt.name}`}
                              onClick={() => { setEditingId(null); setEditName(""); }}
                            >
                              <X />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`แก้ไข ${opt.name}`}
                              onClick={() => { setEditingId(opt.id); setEditName(opt.name); }}
                              className="text-muted hover:text-strong dark:hover:text-strong"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`ปิดการใช้งาน ${opt.name}`}
                              onClick={() => handleDelete(opt.id, opt.name)}
                              disabled={deleteMutation.isPending}
                              className="text-muted hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </DataTable.Td>
                    </DataTable.Row>
                  );
                })}
              </DataTable.Body>
            </DataTable.Root>
          )}

          {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
            <Alert variant="error" className="mt-3" aria-live="polite">
              {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
