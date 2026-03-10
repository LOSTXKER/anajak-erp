"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Package,
  ArrowLeft,
  GripVertical,
} from "lucide-react";
import Link from "next/link";

export default function PackagingSettingsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const utils = trpc.useUtils();

  const { data: options, isLoading } = trpc.packaging.list.useQuery(
    { includeInactive: true },
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

  const handleDelete = (id: string, name: string) => {
    if (confirm(`ปิดการใช้งาน "${name}" หรือไม่?`)) {
      deleteMutation.mutate({ id });
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
            จัดการแพ็คเกจจัดส่ง
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ตัวเลือกแพ็คเกจสำหรับจัดส่งสินค้า
          </p>
        </div>
      </div>

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
              className="mb-4 flex items-end gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30"
            >
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  ชื่อแพ็คเกจ *
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ถุง OPP, กล่อง, ซองไปรษณีย์"
                  required
                  autoFocus
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
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      ชื่อแพ็คเกจ
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      ลำดับ
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      สถานะ
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
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
                          <GripVertical className="inline h-4 w-4 text-slate-300" />
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
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
                          <button
                            type="button"
                            onClick={() => handleToggleActive(opt.id, opt.isActive)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                              opt.isActive
                                ? "bg-blue-600"
                                : "bg-slate-300 dark:bg-slate-600"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                opt.isActive ? "translate-x-4" : "translate-x-0.5"
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
                                disabled={updateMutation.isPending}
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingId(null); setEditName(""); }}
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
                                onClick={() => { setEditingId(opt.id); setEditName(opt.name); }}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(opt.id, opt.name)}
                                disabled={deleteMutation.isPending}
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

          {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
