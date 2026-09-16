"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { c } from "@/components/kit/kit";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Package,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { PageShell } from "@/components/page-shell";

/* แพ็คเกจจัดส่ง — โครงตามต้นแบบที่เบสเคาะ 2026-09-16 (setpackaging):
   ปุ่มเพิ่มมุมขวาบนของหน้า · การ์ดเดียวมีแถบเครื่องมือ (ค้นหา + ตัวนับ) อยู่ข้างใน
   ต้นแบบมีคอลัมน์ หน่วย/ต้นทุน/ใช้กับ ซึ่ง PackagingOption ไม่มีข้อมูลรองรับ
   (มีแค่ name/isActive/sortOrder) — คงคอลัมน์ของจริงไว้ ไม่เติมค่าปลอม */

export default function PackagingSettingsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");

  const { data: options, isLoading, isError, refetch } = trpc.packaging.list.useQuery(
    { includeInactive: true },
    { enabled: canManage },
  );

  const keyword = search.trim().toLowerCase();
  const visibleOptions = keyword
    ? (options ?? []).filter((opt) => opt.name.toLowerCase().includes(keyword))
    : options;

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

  const openAddForm = () => {
    setShowAddForm(true);
    setNewName("");
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
      title="แพ็คเกจจัดส่ง"
      description="ตัวเลือกแพ็คเกจที่ขึ้นให้เลือกตอนเพิ่มสินค้าในออเดอร์ — ปิดรายการที่เลิกใช้ได้โดยไม่ลบ"
      action={
        <Button
          size="sm"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setNewName("");
          }}
          disabled={!canManage}
        >
          <Plus />
          เพิ่มแพ็คเกจ
        </Button>
      }
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
      <Card className="overflow-hidden">
        <div className="px-4.5 pb-2.5 pt-3.5">
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อแพ็คเกจ"
              aria-label="ค้นหาแพ็คเกจจากชื่อ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ToolbarGroup align="end">
              <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                {(visibleOptions?.length ?? 0).toLocaleString("th-TH")} แบบ
              </span>
            </ToolbarGroup>
          </Toolbar>
        </div>

        <div className="border-t border-divider/60">
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-3 border-b border-divider px-4.5 py-4 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="new-packaging-name" className="mb-1 block text-xs font-medium text-muted">
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
            <div className="space-y-3 px-4.5 py-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !visibleOptions || visibleOptions.length === 0 ? (
            keyword ? (
              <EmptyState
                icon={Package}
                title="ไม่พบแพ็คเกจที่ค้น"
                description="ลองเปลี่ยนคำค้นหา"
                action={
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    ล้างคำค้น
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Package}
                title="ยังไม่มีแพ็คเกจ"
                description="เพิ่มตัวเลือกแพ็คเกจเพื่อใช้ในออเดอร์"
                action={
                  <Button size="sm" onClick={openAddForm} disabled={!canManage}>
                    <Plus />
                    เพิ่มแพ็คเกจแรก
                  </Button>
                }
              />
            )
          ) : (
            <DataTable.Root bordered={false}>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>แพ็คเกจ</DataTable.Th>
                  <DataTable.Th align="center">ลำดับ</DataTable.Th>
                  <DataTable.Th align="center">สถานะ</DataTable.Th>
                  <DataTable.Th align="right">
                    <span className="sr-only">แก้ไขแพ็คเกจ</span>
                  </DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {visibleOptions.map((opt) => {
                  const isEditing = editingId === opt.id;
                  return (
                    <DataTable.Row
                      key={opt.id}
                      className={!opt.isActive ? "opacity-50" : undefined}
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
                          <div className={c("who")}>
                            <span className={c("thumb")} aria-hidden="true">
                              <Package />
                            </span>
                            <span className="min-w-0 text-sm font-medium text-strong">
                              {opt.name}
                            </span>
                          </div>
                        )}
                      </DataTable.Td>
                      <DataTable.Td align="center" className="text-xs text-muted">
                        {opt.sortOrder}
                      </DataTable.Td>
                      <DataTable.Td align="center">
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
                              className="text-green-600 dark:text-green-400"
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
                              onClick={() => { setEditingId(opt.id); setEditName(opt.name); }}
                              disabled={updateMutation.isPending}
                              className="text-muted"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`ปิดการใช้งาน ${opt.name}`}
                              onClick={() => handleDelete(opt.id, opt.name)}
                              disabled={deleteMutation.isPending}
                              className="text-muted"
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
            <Alert variant="error" className="mx-4.5 mb-4" aria-live="polite">
              {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
            </Alert>
          )}
        </div>

        <div className={c("tfoot")}>
          รายการที่ปิดจะไม่ขึ้นให้เลือกตอนสร้างออเดอร์ แต่ออเดอร์เก่ายังอ้างถึงได้
        </div>
      </Card>
    </PageShell>
  );
}
