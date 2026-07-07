"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";
import {
  PERMISSIONS,
  PERMISSION_DEFS,
  NON_OVERRIDABLE_PERMISSIONS,
  defaultPermissionsOf,
  effectivePermissions,
  parsePermissionOverrides,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, KeyRound, Plus, ShieldCheck, Users } from "lucide-react";
import type { Role } from "@prisma/client";

export default function UsersSettingsPage() {
  const utils = trpc.useUtils();

  const { data: me } = trpc.user.me.useQuery();
  const { data: users, isLoading, error } = trpc.user.list.useQuery();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "SALES" as Role,
    password: "",
  });
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  // PERM2: dialog ติ๊กสิทธิ์รายคน — draft เก็บ "สถานะติ๊กจริง" ทุกสิทธิ์ระหว่างแก้
  const [permTarget, setPermTarget] = useState<{ id: string; name: string; role: Role } | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, boolean>>({});

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setShowAddForm(false);
      setNewUser({ name: "", email: "", role: "SALES", password: "" });
    },
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  const setActiveMutation = trpc.user.setActive.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  const resetPasswordMutation = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      setResetTarget(null);
      setResetPassword("");
    },
  });

  const setPermissionsMutation = trpc.user.setPermissions.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setPermTarget(null);
    },
  });

  const openPermissions = (user: { id: string; name: string; role: Role; permissionOverrides: unknown }) => {
    const eff = effectivePermissions(user.role, parsePermissionOverrides(user.permissionOverrides));
    setPermTarget({ id: user.id, name: user.name, role: user.role });
    setPermDraft(Object.fromEntries(PERMISSIONS.map((p) => [p, eff.includes(p)])));
    setPermissionsMutation.reset();
  };

  const handleSavePermissions = () => {
    if (!permTarget) return;
    // ส่งเฉพาะคู่ที่ต่างจาก default ของ role — server กรองซ้ำอีกชั้น
    const defaults = defaultPermissionsOf(permTarget.role);
    const overrides: Record<string, boolean> = {};
    for (const p of PERMISSIONS) {
      if (NON_OVERRIDABLE_PERMISSIONS.includes(p)) continue;
      if (permDraft[p] !== defaults.includes(p)) overrides[p] = permDraft[p];
    }
    setPermissionsMutation.mutate({ id: permTarget.id, overrides });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newUser);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    resetPasswordMutation.mutate({ id: resetTarget.id, password: resetPassword });
  };

  const mutationError =
    createMutation.error?.message ||
    updateMutation.error?.message ||
    setActiveMutation.error?.message;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            จัดการผู้ใช้
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            บัญชีพนักงาน สิทธิ์การใช้งาน และรหัสผ่าน
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            ผู้ใช้ทั้งหมด
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="mr-1 h-4 w-4" />
            เพิ่มผู้ใช้
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="card-surface mb-4 grid grid-cols-1 items-end gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  ชื่อ *
                </label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="ชื่อพนักงาน"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  อีเมล *
                </label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@anajak.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  บทบาท *
                </label>
                <NativeSelect
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value as Role })
                  }
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  รหัสผ่านเริ่มต้น * (8+ ตัว)
                </label>
                <Input
                  type="text"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  placeholder="รหัสผ่านชั่วคราว"
                  minLength={8}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "กำลังสร้าง..." : "สร้าง"}
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
            </form>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error.message}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">ยังไม่มีผู้ใช้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      ชื่อ
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      อีเมล
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      บทบาท
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      ใช้งาน
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((user) => {
                    const isSelf = user.id === me?.id;
                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!user.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {user.name}
                          </span>
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              คุณ
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                          {user.email}
                        </td>
                        <td className="px-3 py-2.5">
                          {isSelf ? (
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {ROLE_LABELS[user.role]}
                            </span>
                          ) : (
                            <NativeSelect
                              value={user.role}
                              disabled={updateMutation.isPending}
                              onChange={(e) =>
                                updateMutation.mutate({
                                  id: user.id,
                                  role: e.target.value as Role,
                                })
                              }
                              className="h-8 w-36"
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Switch
                            checked={user.isActive}
                            disabled={isSelf || setActiveMutation.isPending}
                            onCheckedChange={(checked) =>
                              setActiveMutation.mutate({
                                id: user.id,
                                isActive: checked,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPermissions(user)}
                              className="h-7 px-2 text-slate-500 hover:text-blue-600"
                            >
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                              สิทธิ์
                              {(() => {
                                const n = Object.keys(
                                  parsePermissionOverrides(user.permissionOverrides)
                                ).length;
                                return n > 0 ? ` (${n})` : "";
                              })()}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setResetTarget({ id: user.id, name: user.name })
                            }
                            className="h-7 px-2 text-slate-500 hover:text-blue-600"
                          >
                            <KeyRound className="mr-1 h-3.5 w-3.5" />
                            รีเซ็ตรหัส
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {mutationError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {mutationError}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetPassword("");
            resetPasswordMutation.reset();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
            <DialogDescription>
              ตั้งรหัสผ่านใหม่ให้ {resetTarget?.name} — แจ้งรหัสใหม่ให้พนักงานโดยตรง
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                รหัสผ่านใหม่ (8+ ตัว)
              </label>
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </div>
            {resetPasswordMutation.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {resetPasswordMutation.error.message}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetTarget(null)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PERM2: ติ๊กสิทธิ์รายคน — ค่าเริ่มต้นตาม role · ติ๊กต่าง = override เฉพาะคนนี้ */}
      <Dialog
        open={permTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPermTarget(null);
            setPermissionsMutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สิทธิ์ของ {permTarget?.name}</DialogTitle>
            <DialogDescription>
              ค่าเริ่มต้นตามตำแหน่ง {permTarget ? ROLE_LABELS[permTarget.role] : ""} — ติ๊กต่างจาก
              ค่าเริ่มต้นได้เฉพาะคนนี้ (มีป้าย &quot;ปรับเอง&quot; กำกับ)
            </DialogDescription>
          </DialogHeader>
          {permTarget && (
            <div className="space-y-4">
              {[...new Set(PERMISSION_DEFS.map((d) => d.group))].map((group) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {PERMISSION_DEFS.filter((d) => d.group === group).map((def) => {
                      const locked = NON_OVERRIDABLE_PERMISSIONS.includes(def.key);
                      const isDefault = def.defaultRoles.includes(permTarget.role);
                      const checked = locked ? isDefault : (permDraft[def.key] ?? false);
                      const overridden = !locked && checked !== isDefault;
                      return (
                        <label
                          key={def.key}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                            locked
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() =>
                                setPermDraft((d) => ({ ...d, [def.key]: !checked }))
                              }
                              className="h-4 w-4 accent-blue-600"
                            />
                            {def.label}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {overridden && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                ปรับเอง
                              </span>
                            )}
                            {locked && (
                              <span className="text-[10px] text-slate-400">เจ้าของเท่านั้น</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {setPermissionsMutation.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {setPermissionsMutation.error.message}
                </div>
              )}
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPermDraft(
                      Object.fromEntries(
                        PERMISSIONS.map((p) => [
                          p,
                          defaultPermissionsOf(permTarget.role).includes(p),
                        ])
                      )
                    )
                  }
                >
                  รีเซ็ตเป็นค่าเริ่มต้น
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPermTarget(null)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePermissions}
                    disabled={setPermissionsMutation.isPending}
                  >
                    {setPermissionsMutation.isPending ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
