"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";
import {
  PERMISSIONS,
  PERMISSION_DEFS,
  NON_OVERRIDABLE_PERMISSIONS,
  defaultPermissionsOf,
  effectivePermissions,
  parsePermissionOverrides,
  countEffectiveOverrides,
  permAllows,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { ListCards, ListCardItem, ListCardMetaGrid, ListCardMeta } from "@/components/ui/list-card";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { PageShell } from "@/components/page-shell";
import { c } from "@/components/kit/kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { KeyRound, Plus, ShieldCheck, Users } from "lucide-react";
import type { Role } from "@prisma/client";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { Alert } from "@/components/ui/alert";

/* ผู้ใช้และสิทธิ์ — โครงตามต้นแบบทั้งเว็บที่เบสเคาะ 2026-09-16:
   หัวหน้า + ปุ่มหลักมุมขวา → การ์ดเดียวไม่มีหัวการ์ด (แถบเครื่องมือ = ค้นหา + ตัวนับ)
   → ตาราง ชื่อ · บทบาท · อีเมล · เห็นเงิน · สถานะ
   ต่างจากต้นแบบโดยตั้งใจ (ต้นแบบเป็นภาพนิ่ง ของจริงต้องทำงานได้):
     · บทบาท/สถานะเป็น control จริง (Select + Switch) ไม่ใช่ข้อความ/ชิปอ่านอย่างเดียว
     · คอลัมน์ท้ายมีปุ่ม "สิทธิ์" และ "รีเซ็ตรหัส" ซึ่งต้นแบบไม่มีเลย
     · คอลัมน์ "เข้าล่าสุด" ของต้นแบบทำไม่ได้: User ไม่มีฟิลด์เวลาเข้าระบบ (มีแค่ createdAt/updatedAt)
       จะมีได้ต้องแก้ schema + เก็บเวลาที่ชั้น auth ซึ่งเกินขอบเขตงานหน้าตา */

/** ตัวอักษรแรกของชื่อสำหรับวงกลมหน้าชื่อ (ต้นแบบ .who .av) */
function initialOf(name: string) {
  return name.trim().charAt(0) || "?";
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-module-brand-surface text-xs font-semibold text-module-brand-text"
    >
      {initialOf(name)}
    </span>
  );
}

/** เห็นตัวเลขเงินได้ไหม = ผลลัพธ์ของ role + สิทธิ์ที่ปรับเอง (อ่านอย่างเดียว · แก้ที่กล่องสิทธิ์) */
function seesMoney(role: Role, overrides: unknown) {
  return effectivePermissions(role, parsePermissionOverrides(overrides)).includes("see_order_money");
}

export default function UsersSettingsPage() {
  const utils = trpc.useUtils();

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const canManageUsers = permAllows(me?.permissions, "manage_users");
  const usersQuery = trpc.user.list.useQuery(undefined, {
    enabled: canManageUsers,
  });
  const { data: users, isLoading, error } = usersQuery;

  // user.list ไม่มี input search (และรายชื่อพนักงานสั้น) — กรองฝั่งจอ ไม่แตะ router
  const [search, setSearch] = useState("");
  const keyword = search.trim().toLowerCase();
  const visibleUsers = keyword
    ? users?.filter(
        (user) =>
          user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword),
      )
    : users;

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

  /* เหตุผลที่หน้านี้ไม่มีปุ่มลบ — วางไว้ใต้ตารางที่มีสวิตช์ ไม่ใช่คำโปรยบนหัวหน้า
     (ส่งผ่าน slot ท้ายการ์ดของ ResponsiveList เพื่อให้อยู่ในกรอบเดียวกับสวิตช์ที่มันอธิบาย
      — ขอ slot ชื่อตรงความหมายไว้แล้ว ดู sharedFileRequests) */
  const closeInsteadOfDeleteNote = (
    <p className="border-t border-divider/60 px-4.5 py-3 text-xs text-secondary">
      ปิดผู้ใช้แทนการลบ เพื่อให้ประวัติที่เขาทำไว้ยังอ่านได้
    </p>
  );

  return (
    <PageShell
      title="ผู้ใช้และสิทธิ์"
      description="ใครเข้าระบบได้ และใครเห็นตัวเลขเงิน"
      action={
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus />
          เพิ่มผู้ใช้
        </Button>
      }
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์จัดการผู้ใช้ไม่สำเร็จ",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      denied={
        !canManageUsers && {
          description: "หน้านี้ต้องมีสิทธิ์จัดการพนักงานและสิทธิ์ผู้ใช้",
        }
      }
    >
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="card-surface grid grid-cols-1 items-end gap-3 rounded-2xl p-4.5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label htmlFor="new-user-name" className="mb-1 block text-xs font-medium text-muted">
              ชื่อ *
            </label>
            <Input
              id="new-user-name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="ชื่อพนักงาน"
              required
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="new-user-email" className="mb-1 block text-xs font-medium text-muted">
              อีเมล *
            </label>
            <Input
              id="new-user-email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="email@anajak.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="new-user-role" className="mb-1 block text-xs font-medium text-muted">
              บทบาท *
            </label>
            <Select
              id="new-user-role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="new-user-password" className="mb-1 block text-xs font-medium text-muted">
              รหัสผ่านเริ่มต้น * (8+ ตัว)
            </label>
            <Input
              id="new-user-password"
              type="text"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="รหัสผ่านชั่วคราว"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending ? "กำลังสร้าง..." : "สร้าง"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      )}

      <ResponsiveList
        items={visibleUsers}
        isLoading={isLoading}
        isError={Boolean(error)}
        errorMessage={error?.message ?? "โหลดรายชื่อผู้ใช้ไม่สำเร็จ"}
        onRetry={() => usersQuery.refetch()}
        label="ผู้ใช้"
        toolbar={
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อหรืออีเมล"
              aria-label="ค้นหาผู้ใช้จากชื่อหรืออีเมล"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ToolbarGroup align="end">
              <span className="text-xs tabular-nums whitespace-nowrap text-muted">
                {(visibleUsers?.length ?? 0).toLocaleString("th-TH")} คน
              </span>
            </ToolbarGroup>
          </Toolbar>
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={keyword ? "ไม่พบผู้ใช้ที่ค้น" : "ยังไม่มีผู้ใช้"}
            description={keyword ? "ลองเปลี่ยนคำค้นหา" : undefined}
            action={
              keyword ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  ล้างคำค้น
                </Button>
              ) : undefined
            }
          />
        }
        pagination={closeInsteadOfDeleteNote}
        renderDesktop={(rows) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ชื่อ</DataTable.Th>
                <DataTable.Th>บทบาท</DataTable.Th>
                <DataTable.Th>อีเมล</DataTable.Th>
                <DataTable.Th>เห็นเงิน</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th align="right">
                  <span className="sr-only">จัดการผู้ใช้</span>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((user) => {
                const isSelf = user.id === me?.id;
                return (
                  <DataTable.Row
                    key={user.id}
                    className={!user.isActive ? "opacity-50" : undefined}
                  >
                    <DataTable.Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-strong">{user.name}</span>
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              คุณ
                            </span>
                          )}
                        </div>
                      </div>
                    </DataTable.Td>
                    <DataTable.Td>
                      {isSelf ? (
                        <span className="text-sm text-secondary">{ROLE_LABELS[user.role]}</span>
                      ) : (
                        <Select
                          size="sm"
                          value={user.role}
                          disabled={updateMutation.isPending}
                          aria-label={`บทบาทของ ${user.name}`}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: user.id,
                              role: e.target.value as Role,
                            })
                          }
                          className="w-36"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </DataTable.Td>
                    <DataTable.Td className="text-muted">{user.email}</DataTable.Td>
                    <DataTable.Td>
                      {seesMoney(user.role, user.permissionOverrides) ? (
                        <span className={c("chip good")}>เห็น</span>
                      ) : (
                        <span className={c("chip gray")}>ไม่เห็น</span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td>
                      <Switch
                        checked={user.isActive}
                        disabled={isSelf || setActiveMutation.isPending}
                        aria-label={`${user.isActive ? "ปิด" : "เปิด"}บัญชี ${user.name}`}
                        onCheckedChange={(checked) =>
                          setActiveMutation.mutate({
                            id: user.id,
                            isActive: checked,
                          })
                        }
                      />
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPermissions(user)}
                          className="px-2 text-muted"
                        >
                          <ShieldCheck className="mr-1" />
                          สิทธิ์
                          {(() => {
                            // นับเฉพาะที่ต่างจาก default ของ role ปัจจุบันจริง — ตรงกับป้าย "ปรับเอง" ใน dialog
                            const n = countEffectiveOverrides(user.role, user.permissionOverrides);
                            return n > 0 ? ` (${n})` : "";
                          })()}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetTarget({ id: user.id, name: user.name })}
                        className="px-2 text-muted"
                      >
                        <KeyRound className="mr-1" />
                        รีเซ็ตรหัส
                      </Button>
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(rows) => (
          <ListCards label="รายชื่อผู้ใช้">
            {rows.map((user) => {
              const isSelf = user.id === me?.id;
              return (
                <ListCardItem key={user.id} className={!user.isActive ? "opacity-60" : undefined}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-strong">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              คุณ
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-secondary">{user.email}</p>
                      </div>
                      <Switch
                        checked={user.isActive}
                        disabled={isSelf || setActiveMutation.isPending}
                        aria-label={`${user.isActive ? "ปิด" : "เปิด"}บัญชี ${user.name}`}
                        onCheckedChange={(checked) =>
                          setActiveMutation.mutate({ id: user.id, isActive: checked })
                        }
                      />
                    </div>
                    <ListCardMetaGrid>
                      <ListCardMeta label="บทบาท">{ROLE_LABELS[user.role]}</ListCardMeta>
                      <ListCardMeta label="เห็นเงิน" align="right">
                        {seesMoney(user.role, user.permissionOverrides) ? (
                          <span className={c("chip good")}>เห็น</span>
                        ) : (
                          <span className={c("chip gray")}>ไม่เห็น</span>
                        )}
                      </ListCardMeta>
                    </ListCardMetaGrid>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!isSelf && (
                        <Button variant="outline" size="sm" onClick={() => openPermissions(user)}>
                          <ShieldCheck />
                          สิทธิ์
                          {(() => {
                            const n = countEffectiveOverrides(user.role, user.permissionOverrides);
                            return n > 0 ? ` (${n})` : "";
                          })()}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetTarget({ id: user.id, name: user.name })}
                      >
                        <KeyRound />
                        รีเซ็ตรหัส
                      </Button>
                    </div>
                  </div>
                </ListCardItem>
              );
            })}
          </ListCards>
        )}
      />

      {mutationError && <Alert variant="error">{mutationError}</Alert>}

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
              <label htmlFor="reset-user-password" className="mb-1 block text-xs font-medium text-muted">
                รหัสผ่านใหม่ (8+ ตัว)
              </label>
              <Input
                id="reset-user-password"
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            {resetPasswordMutation.error && (
              <Alert variant="error">{resetPasswordMutation.error.message}</Alert>
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
              <Button type="submit" size="sm" disabled={resetPasswordMutation.isPending}>
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
                  <p className="mb-1.5 text-xs font-semibold text-muted">{group}</p>
                  <div className="space-y-1">
                    {PERMISSION_DEFS.filter((d) => d.group === group).map((def) => {
                      const locked = NON_OVERRIDABLE_PERMISSIONS.includes(def.key);
                      const isDefault = def.defaultRoles.includes(permTarget.role);
                      const checked = locked ? isDefault : (permDraft[def.key] ?? false);
                      const overridden = !locked && checked !== isDefault;
                      return (
                        <label
                          key={def.key}
                          className={`${CONTROL_MIN_H} flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${
                            locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              disabled={locked}
                              onChange={() => setPermDraft((d) => ({ ...d, [def.key]: !checked }))}
                            />
                            {def.label}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {overridden && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                ปรับเอง
                              </span>
                            )}
                            {locked && <span className="text-xs text-muted">เจ้าของเท่านั้น</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {setPermissionsMutation.error && (
                <Alert variant="error">{setPermissionsMutation.error.message}</Alert>
              )}
              {/* ใช้ DialogFooter เพื่อให้ปุ่มปักก้นกรอบเหมือน dialog อื่น — รายการสิทธิ์ 20 ข้อ
                  ยาวเกินกรอบเสมอ ปุ่มบันทึกเดิมจึงจมอยู่ล่างสุดของกล่องที่ต้องเลื่อนหา
                  (รูปทรง 2 ฝั่ง: รีเซ็ตซ้าย · ยกเลิก/บันทึกขวา — ต่างจากค่าเริ่มต้นที่ชิดขวาล้วน) */}
              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPermDraft(
                      Object.fromEntries(
                        PERMISSIONS.map((p) => [p, defaultPermissionsOf(permTarget.role).includes(p)])
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
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
