"use client";

import { useId, useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Pencil, X, Check, Settings, ShieldX } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { PRICING_TYPE_LABELS } from "@/types/order-form";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type TabKey = "ADDON" | "PRINT" | "FEE";

const tabs: { key: TabKey; label: string }[] = [
  { key: "ADDON", label: "Add-ons" },
  { key: "PRINT", label: "การสกรีน" },
  { key: "FEE", label: "ค่าบริการ" },
];

const pricingTypeConfig: Record<string, { label: string; variant: "default" | "secondary" }> = {
  PER_PIECE: { label: PRICING_TYPE_LABELS.PER_PIECE, variant: "default" },
  PER_ORDER: { label: PRICING_TYPE_LABELS.PER_ORDER, variant: "secondary" },
};

type NewItemForm = {
  type: string;
  name: string;
  description: string;
  defaultPrice: number;
  pricingType: "PER_PIECE" | "PER_ORDER";
};

type EditingItem = {
  id: string;
  name: string;
  defaultPrice: number;
  pricingType: "PER_PIECE" | "PER_ORDER";
};

const emptyForm: NewItemForm = {
  type: "",
  name: "",
  description: "",
  defaultPrice: 0,
  pricingType: "PER_PIECE",
};

// ============================================================
// COMPONENT
// ============================================================

export default function ServicesPage() {
  const formId = useId();
  const [activeTab, setActiveTab] = useState<TabKey>("ADDON");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<NewItemForm>({ ...emptyForm });
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");
  // serviceCatalog.delete ยังเป็น OWNER-only ฝั่ง server; manage_users เป็นสิทธิ์ OWNER ที่ override ไม่ได้
  const canDelete = permAllows(meQuery.data?.permissions, "manage_users");

  const { data: items, isLoading, isError, refetch } = trpc.serviceCatalog.list.useQuery({
    category: activeTab,
  }, { enabled: canManage });

  const createItem = trpc.serviceCatalog.create.useMutation({
    onSuccess: () => {
      utils.serviceCatalog.list.invalidate();
      setShowAddForm(false);
      setFormData({ ...emptyForm });
    },
  });

  const updateItem = trpc.serviceCatalog.update.useMutation({
    onSuccess: () => {
      utils.serviceCatalog.list.invalidate();
      setEditingItem(null);
    },
  });

  const deleteItem = useMutationWithInvalidation(trpc.serviceCatalog.delete, {
    invalidate: [utils.serviceCatalog.list],
  });

  const toggleActive = useMutationWithInvalidation(trpc.serviceCatalog.update, {
    invalidate: [utils.serviceCatalog.list],
  });

  // ---- handlers ----
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createItem.mutate({
      category: activeTab,
      type: formData.type,
      name: formData.name,
      description: formData.description || undefined,
      defaultPrice: formData.defaultPrice,
      pricingType: formData.pricingType,
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateItem.mutate({
      id: editingItem.id,
      name: editingItem.name,
      defaultPrice: editingItem.defaultPrice,
      pricingType: editingItem.pricingType,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `ลบ "${name}"?`,
      confirmText: "ลบรายการ",
      destructive: true,
    });
    if (ok) deleteItem.mutate({ id });
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActive.mutate({ id, isActive: !isActive });
  };

  const startEdit = (item: { id: string; name: string; defaultPrice: number; pricingType: string }) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      defaultPrice: item.defaultPrice,
      pricingType: item.pricingType as "PER_PIECE" | "PER_ORDER",
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  const header = (
    <SettingsPageHeader
      title="จัดการบริการ"
      description="ตั้งค่ารายการบริการเสริม, การสกรีน, และค่าบริการ"
    />
  );

  if (meQuery.isError) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          message="ตรวจสอบสิทธิ์หน้าจัดการบริการไม่ได้"
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
              title="ไม่มีสิทธิ์จัดการบริการ"
              description="หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // && !items: refetch เบื้องหลังล้มระหว่างกรอกฟอร์มสร้าง/แก้ ห้ามถอนหน้า
  if (isError && !items) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          message="โหลดรายการบริการไม่สำเร็จ"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {header}

      {/* Tabs */}
      <SegmentedControl
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value);
          setShowAddForm(false);
          setEditingItem(null);
        }}
        options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
      />

      {/* Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            {tabs.find((t) => t.key === activeTab)?.label}
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
            เพิ่มรายการ
          </Button>
        </CardHeader>
        <CardContent>
          {/* Add form */}
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="card-surface mb-4 space-y-3 rounded-2xl p-4"
            >
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                เพิ่มรายการใหม่
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label htmlFor={`${formId}-type`} className="mb-1 block text-xs font-medium text-slate-500">
                    ประเภท *
                  </label>
                  <Input
                    id={`${formId}-type`}
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    placeholder="เช่น ปักโลโก้"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-name`} className="mb-1 block text-xs font-medium text-slate-500">
                    ชื่อ *
                  </label>
                  <Input
                    id={`${formId}-name`}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="ชื่อบริการ"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-price`} className="mb-1 block text-xs font-medium text-slate-500">
                    ราคา (บาท) *
                  </label>
                  <Input
                    id={`${formId}-price`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.defaultPrice || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-pricing-type`} className="mb-1 block text-xs font-medium text-slate-500">
                    คิดราคา
                  </label>
                  <NativeSelect
                    id={`${formId}-pricing-type`}
                    value={formData.pricingType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricingType: e.target.value as "PER_PIECE" | "PER_ORDER",
                      })
                    }
                  >
                    <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                    <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                  </NativeSelect>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1"
                    disabled={createItem.isPending}
                  >
                    {createItem.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
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

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <EmptyState icon={Settings} title="ยังไม่มีรายการ" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      ชื่อ
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                      ประเภท
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                      ราคา
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                      คิดราคา
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
                  {items.map((item) => {
                    const isEditing = editingItem?.id === item.id;
                    const ptConfig = pricingTypeConfig[item.pricingType] ?? {
                      label: item.pricingType,
                      variant: "secondary" as const,
                    };

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          !item.isActive ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <Input
                              aria-label={`ชื่อบริการ ${item.name}`}
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  name: e.target.value,
                                })
                              }
                              className="h-7 text-sm"
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500">
                          {item.type}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isEditing ? (
                            <Input
                              aria-label={`ราคาบริการ ${item.name}`}
                              type="number"
                              min={0}
                              step={0.01}
                              value={editingItem.defaultPrice || ""}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  defaultPrice:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="ml-auto h-7 w-28 text-right text-sm"
                            />
                          ) : (
                            <span className="text-sm tabular-nums font-medium text-slate-900 dark:text-white">
                              {formatCurrency(item.defaultPrice)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <NativeSelect
                              aria-label={`วิธีคิดราคาของ ${item.name}`}
                              className="h-7 text-xs"
                              value={editingItem.pricingType}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  pricingType: e.target.value as
                                    | "PER_PIECE"
                                    | "PER_ORDER",
                                })
                              }
                            >
                              <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                              <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                            </NativeSelect>
                          ) : (
                            <Badge variant={ptConfig.variant}>
                              {ptConfig.label}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Switch
                            aria-label={`${item.isActive ? "ปิด" : "เปิด"}การใช้งาน ${item.name}`}
                            checked={item.isActive}
                            onCheckedChange={() => handleToggleActive(item.id, item.isActive)}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`บันทึกการแก้ไข ${item.name}`}
                                onClick={handleSaveEdit}
                                disabled={updateItem.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`ยกเลิกการแก้ไข ${item.name}`}
                                onClick={() => setEditingItem(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`แก้ไข ${item.name}`}
                                onClick={() => startEdit(item)}
                                className="text-slate-500 hover:text-blue-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`ลบ ${item.name}`}
                                  onClick={() => handleDelete(item.id, item.name)}
                                  disabled={deleteItem.isPending}
                                  className="text-slate-500 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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

          {/* Error display */}
          {(createItem.isError || updateItem.isError || deleteItem.isError || toggleActive.isError) && (
            <Alert variant="error" className="mt-3">
              {createItem.error?.message ||
                updateItem.error?.message ||
                deleteItem.error?.message ||
                toggleActive.error?.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
