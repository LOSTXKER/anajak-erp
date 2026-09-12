"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneMark } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Package,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { PageShell } from "@/components/page-shell";
import { CatalogTools, CatalogFeedback } from "@/components/settings/catalog-tools";
import { useSettingsDraftGuard } from "@/components/settings/use-settings-draft-guard";

export default function PackagingSettingsPage() {
  const [search, setSearch] = useState("");
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
    onSuccess: (_result, variables) => {
      utils.packaging.list.invalidate();
      if (variables.id === editingId && variables.name === editName.trim()) {
        setEditingId(null);
        setEditName("");
      }
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

  const dirty = (showAddForm && !!newName.trim()) || !!(editingId && editName !== options?.find((item) => item.id === editingId)?.name);
  const mayDiscard = useSettingsDraftGuard(dirty, createMutation.isPending || updateMutation.isPending);
  const visibleOptions = (options ?? []).filter((item) => [item.name].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return (
    <PageShell
      back={{ href: "/settings", label: "ย้อนกลับ" }}
      title="แพ็คเกจจัดส่ง"
      description="ตัวเลือกที่ใช้ในออเดอร์ ปิดรายการที่เลิกใช้ได้โดยยังเก็บประวัติเดิม"
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ToneMark icon={Package} tone="product" />
            แพ็คเกจทั้งหมด
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!(await mayDiscard())) return;
              createMutation.reset();
              setShowAddForm(!showAddForm);
              setNewName("");
            }}
          >
            <Plus className="mr-1" />
            เพิ่มแพ็คเกจ
          </Button>
        </CardHeader>
        <CardContent>
          <CatalogTools tableScrollHint loading={isLoading} search={search} onSearch={setSearch} count={visibleOptions.length} total={options?.length ?? 0} label="แพ็คเกจ" />
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="mb-4 flex flex-col gap-3 border-b border-divider pb-4 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="new-packaging-name" className="mb-1 block text-xs font-medium text-muted">
                  ชื่อแพ็คเกจ *
                </label>
                <Input
                  id="new-packaging-name"
                  disabled={createMutation.isPending}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ถุง OPP, กล่อง, ซองไปรษณีย์"
                  required
                />
                <CatalogFeedback pending={createMutation.isPending} error={createMutation.error?.message} />
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
                disabled={createMutation.isPending}
                onClick={() => { setShowAddForm(false); setNewName(""); }}
              >
                ยกเลิก
              </Button>
            </form>
          )}

          {search && visibleOptions.length === 0 && !isLoading ? <p role="status" className="py-8 text-center text-sm text-secondary">ไม่พบแพ็คเกจที่ตรงคำค้น</p> : null}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !options || options.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-10 w-10 text-muted" />
              <p className="mt-3 text-sm text-muted">ยังไม่มีแพ็คเกจ</p>
              <p className="mt-1 text-xs text-muted">
                เพิ่มตัวเลือกแพ็คเกจเพื่อใช้ในออเดอร์
              </p>
            </div>
          ) : (
            <DataTable.Root bordered={false}>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>ชื่อแพ็คเกจ</DataTable.Th>
                  <DataTable.Th align="center">ลำดับ</DataTable.Th>
                  <DataTable.Th align="center">สถานะ</DataTable.Th>
                  <DataTable.Th align="right">จัดการ</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {visibleOptions.map((opt) => {
                  const isEditing = editingId === opt.id;
                  return (
                    <DataTable.Row
                      key={opt.id}
                      className={isEditing ? "bg-surface-muted" : undefined}
                    >
                      <DataTable.Td>
                        {isEditing ? (
                          <Input size="sm"
                            disabled={updateMutation.isPending}
                            aria-label={`ชื่อแพ็คเกจ ${opt.name}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit();
                              if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                            }}
                          />
                        ) : (
                          <span className="text-sm font-medium text-strong">
                            {opt.name}
                          </span>
                        )}
                        <CatalogFeedback pending={(updateMutation.isPending && updateMutation.variables?.id === opt.id) || (deleteMutation.isPending && deleteMutation.variables?.id === opt.id)} error={(updateMutation.variables?.id === opt.id ? updateMutation.error?.message : null) || (deleteMutation.variables?.id === opt.id ? deleteMutation.error?.message : null)} />
                      </DataTable.Td>
                      <DataTable.Td align="center" className="text-xs text-muted">
                        {opt.sortOrder}
                      </DataTable.Td>
                      <DataTable.Td align="center">
                        <p className="mb-2 whitespace-nowrap text-xs text-secondary">{opt.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</p>
                        <Switch
                          aria-label={`${opt.isActive ? "ปิด" : "เปิด"}การใช้งาน ${opt.name}`}
                          checked={opt.isActive}
                          disabled={updateMutation.isPending}
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
                              disabled={updateMutation.isPending}
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
                              onClick={async () => { if (!(await mayDiscard())) return; updateMutation.reset(); setEditingId(opt.id); setEditName(opt.name); }}
                              disabled={updateMutation.isPending}
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

        </CardContent>
      </Card>
    </PageShell>
  );
}
