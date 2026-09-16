"use client";

import { useId, useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Pencil, X, Check, Settings } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented";
import { ADDON_TYPES, PRICING_TYPE_LABELS } from "@/types/order-form";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { ListCards, ListCardItem, ListCardMetaGrid, ListCardMeta } from "@/components/ui/list-card";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

/* บริการและราคา — โครงตามต้นแบบทั้งเว็บที่เบสเคาะ 2026-09-16:
   หัวหน้า + ปุ่มหลักมุมขวา → การ์ดเดียวไม่มีหัวการ์ด (แท็บหมวด + ค้นหา + ตัวนับอยู่ในแถบเครื่องมือ)
   → ตาราง บริการ · ประเภท · คิดราคา · ราคา · สถานะ
   ต่างจากต้นแบบโดยตั้งใจ: ต้นแบบมีตารางเดียวและเป็นภาพนิ่ง ของจริงมี 3 หมวด (ADDON/PRINT/FEE),
   แก้ไขในแถวได้, สวิตช์เปิด-ปิดจริง และปุ่มลบเฉพาะเจ้าของ — คงไว้ทั้งหมด */

type TabKey = "ADDON" | "PRINT" | "FEE";

const tabs: { key: TabKey; label: string }[] = [
  { key: "ADDON", label: "Add-ons" },
  { key: "PRINT", label: "การสกรีน" },
  { key: "FEE", label: "ค่าบริการ" },
];

type NewItemForm = {
  type: string;
  name: string;
  description: string;
  defaultPrice: number | "";
  pricingType: "PER_PIECE" | "PER_ORDER";
};

type EditingItem = {
  id: string;
  name: string;
  defaultPrice: number | "";
  pricingType: "PER_PIECE" | "PER_ORDER";
};

const emptyForm: NewItemForm = {
  type: "",
  name: "",
  description: "",
  defaultPrice: 0,
  pricingType: "PER_PIECE",
};

const pricingLabel = (pricingType: string) =>
  PRICING_TYPE_LABELS[pricingType as keyof typeof PRICING_TYPE_LABELS] ?? pricingType;

// ============================================================
// COMPONENT
// ============================================================

export default function ServicesPage() {
  const formId = useId();
  const [activeTab, setActiveTab] = useState<TabKey>("ADDON");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<NewItemForm>({ ...emptyForm });
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  // รายการบริการต่อหมวดสั้น จึงกรองฝั่งจอ (ครอบทั้งชื่อและชื่อประเภทที่คนอ่านเห็น) ไม่แตะ router
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");
  // serviceCatalog.delete ยังเป็น OWNER-only ฝั่ง server; manage_users เป็นสิทธิ์ OWNER ที่ override ไม่ได้
  const canDelete = permAllows(meQuery.data?.permissions, "manage_users");

  const { data: items, isLoading, isError, refetch } = trpc.serviceCatalog.list.useQuery({
    category: activeTab,
  }, { enabled: canManage });

  const keyword = search.trim().toLowerCase();
  const visibleItems = keyword
    ? items?.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          (ADDON_TYPES[item.type] ?? item.type).toLowerCase().includes(keyword)
      )
    : items;

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
    if (formData.defaultPrice === "" || formData.defaultPrice < 0) return;
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
    if (!editingItem || editingItem.defaultPrice === "" || editingItem.defaultPrice < 0) return;
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

  /* ผลของการแก้ราคา — วางไว้ท้ายการ์ดที่มีราคาและปุ่มแก้ไข ไม่ใช่คำโปรยบนหัวหน้า
     (ตรงกับของจริง: OrderItemAddon เก็บ unitPrice ของตัวเองตอนเปิดออเดอร์ ไม่อ้างอิงราคาปัจจุบัน)
     ส่งผ่าน slot ท้ายการ์ดของ ResponsiveList — ขอ slot ชื่อตรงความหมายไว้แล้ว ดู sharedFileRequests */
  const priceNote = (
    <p className="border-t border-divider/60 px-4.5 py-3 text-xs text-secondary">
      ราคานี้ใช้คิดเงินอัตโนมัติตอนเปิดออเดอร์ · ออเดอร์เก่าคงราคาเดิม
    </p>
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <PageShell
      title="บริการและราคา"
      description="ราคาต่อหน่วยที่ระบบใช้คิดเงินให้อัตโนมัติ"
      action={
        <Button
          size="sm"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setFormData({ ...emptyForm });
          }}
        >
          <Plus />
          เพิ่มบริการ
        </Button>
      }
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์หน้าจัดการบริการไม่ได้",
              onRetry: () => void meQuery.refetch(),
            }
          : // && !items: refetch เบื้องหลังล้มระหว่างกรอกฟอร์มสร้าง/แก้ ห้ามถอนหน้า
            isError && !items
            ? { message: "โหลดรายการบริการไม่สำเร็จ", onRetry: () => void refetch() }
            : null
      }
      denied={
        !canManage && {
          title: "ไม่มีสิทธิ์จัดการบริการ",
          description: "หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="card-surface space-y-3 rounded-2xl p-4.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor={`${formId}-type`} className="mb-1 block text-xs font-medium text-muted">
                ประเภท *
              </label>
              {activeTab === "ADDON" ? (
                // ส่วนเสริม: เลือกจากรายการไทย รหัสเก็บเงียบๆ (ป้ายเย็บติดทำให้ใบผลิตเสนอขั้น "เย็บป้าย")
                <Select
                  id={`${formId}-type`}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="">เลือกประเภท...</option>
                  {Object.entries(ADDON_TYPES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`${formId}-type`}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="เช่น ปักโลโก้"
                  required
                />
              )}
            </div>
            <div>
              <label htmlFor={`${formId}-name`} className="mb-1 block text-xs font-medium text-muted">
                ชื่อ *
              </label>
              <Input
                id={`${formId}-name`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อบริการ"
                required
              />
            </div>
            <div>
              <label htmlFor={`${formId}-price`} className="mb-1 block text-xs font-medium text-muted">
                ราคา (บาท) *
              </label>
              <Input
                id={`${formId}-price`}
                type="number"
                min={0}
                step={0.01}
                value={formData.defaultPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultPrice: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : "",
                  })
                }
                placeholder="0.00"
                aria-describedby={`${formId}-price-help`}
                required
              />
              <p id={`${formId}-price-help`} className="mt-1 text-xs text-secondary">กรอก 0 ได้หากบริการนี้ไม่คิดเงิน</p>
            </div>
            <div>
              <label htmlFor={`${formId}-pricing-type`} className="mb-1 block text-xs font-medium text-muted">
                คิดราคา
              </label>
              <Select
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
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={createItem.isPending}>
                {createItem.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </form>
      )}

      <ResponsiveList
        items={visibleItems}
        isLoading={isLoading}
        isError={isError}
        errorMessage="โหลดรายการบริการไม่สำเร็จ"
        onRetry={() => refetch()}
        label="บริการ"
        toolbar={
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อบริการ"
              aria-label="ค้นหาบริการจากชื่อหรือประเภท"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SegmentedControl
              value={activeTab}
              onChange={(value) => {
                setActiveTab(value);
                setShowAddForm(false);
                setEditingItem(null);
              }}
              options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
              aria-label="หมวดของบริการ"
            />
            <ToolbarGroup align="end">
              <span className="text-xs tabular-nums whitespace-nowrap text-muted">
                {(visibleItems?.length ?? 0).toLocaleString("th-TH")} บริการ
              </span>
            </ToolbarGroup>
          </Toolbar>
        }
        emptyState={
          <EmptyState
            icon={Settings}
            title={keyword ? "ไม่พบบริการที่ค้น" : "ยังไม่มีรายการ"}
            description={keyword ? "ลองเปลี่ยนคำค้นหาหรือสลับหมวด" : undefined}
            action={
              keyword ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  ล้างคำค้น
                </Button>
              ) : undefined
            }
          />
        }
        pagination={priceNote}
        renderDesktop={(rows) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>บริการ</DataTable.Th>
                <DataTable.Th>ประเภท</DataTable.Th>
                <DataTable.Th>คิดราคา</DataTable.Th>
                <DataTable.Th align="right">ราคา</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th align="right">
                  <span className="sr-only">แก้ไขหรือลบบริการ</span>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((item) => {
                const isEditing = editingItem?.id === item.id;

                return (
                  <DataTable.Row
                    key={item.id}
                    className={!item.isActive ? "opacity-50" : undefined}
                  >
                    <DataTable.Td>
                      {isEditing ? (
                        <Input size="sm"
                          disabled={updateItem.isPending}
                          aria-label={`ชื่อบริการ ${item.name}`}
                          value={editingItem.name}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, name: e.target.value })
                          }
                        />
                      ) : (
                        <span className="text-sm font-medium text-strong">{item.name}</span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td className="text-muted">
                      {ADDON_TYPES[item.type] ?? item.type}
                    </DataTable.Td>
                    <DataTable.Td className="text-secondary">
                      {isEditing ? (
                        <Select size="sm"
                          disabled={updateItem.isPending}
                          aria-label={`วิธีคิดราคาของ ${item.name}`}
                          value={editingItem.pricingType}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              pricingType: e.target.value as "PER_PIECE" | "PER_ORDER",
                            })
                          }
                        >
                          <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                          <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                        </Select>
                      ) : (
                        pricingLabel(item.pricingType)
                      )}
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {isEditing ? (
                        <Input
                          aria-label={`ราคาบริการ ${item.name}`}
                          disabled={updateItem.isPending}
                          size="dense"
                          type="number"
                          min={0}
                          step={0.01}
                          value={editingItem.defaultPrice}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              defaultPrice: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : "",
                            })
                          }
                          className="ml-auto w-28 text-right"
                        />
                      ) : (
                        <span className="text-sm tabular-nums font-medium text-strong">
                          {formatCurrency(item.defaultPrice)}
                        </span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td>
                      <Switch
                        aria-label={`${item.isActive ? "ปิด" : "เปิด"}การใช้งาน ${item.name}`}
                        checked={item.isActive}
                        disabled={toggleActive.isPending}
                        onCheckedChange={() => handleToggleActive(item.id, item.isActive)}
                      />
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`บันทึกการแก้ไข ${item.name}`}
                            onClick={handleSaveEdit}
                            disabled={updateItem.isPending || editingItem.defaultPrice === "" || editingItem.defaultPrice < 0}
                            className="text-green-600 dark:text-green-400"
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`ยกเลิกการแก้ไข ${item.name}`}
                            onClick={() => setEditingItem(null)}
                            disabled={updateItem.isPending}
                          >
                            <X />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`แก้ไข ${item.name}`}
                            onClick={() => startEdit(item)}
                            disabled={updateItem.isPending}
                            className="text-muted"
                          >
                            <Pencil />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`ลบ ${item.name}`}
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={deleteItem.isPending}
                              className="text-muted"
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      )}
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(rows) => (
          <ListCards label="รายการบริการ">
            {rows.map((item) => {
              const isEditing = editingItem?.id === item.id;
              return (
                <ListCardItem key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <Input
                            size="sm"
                            disabled={updateItem.isPending}
                            aria-label={`ชื่อบริการ ${item.name}`}
                            value={editingItem.name}
                            onChange={(e) =>
                              setEditingItem({ ...editingItem, name: e.target.value })
                            }
                          />
                        ) : (
                          <p className="break-words font-semibold text-strong">{item.name}</p>
                        )}
                        <p className="mt-0.5 text-xs text-secondary">
                          {ADDON_TYPES[item.type] ?? item.type}
                        </p>
                      </div>
                      <Switch
                        aria-label={`${item.isActive ? "ปิด" : "เปิด"}การใช้งาน ${item.name}`}
                        checked={item.isActive}
                        disabled={toggleActive.isPending}
                        onCheckedChange={() => handleToggleActive(item.id, item.isActive)}
                      />
                    </div>
                    <ListCardMetaGrid>
                      <ListCardMeta label="คิดราคา">
                        {isEditing ? (
                          <Select
                            size="sm"
                            disabled={updateItem.isPending}
                            aria-label={`วิธีคิดราคาของ ${item.name}`}
                            value={editingItem.pricingType}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                pricingType: e.target.value as "PER_PIECE" | "PER_ORDER",
                              })
                            }
                          >
                            <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                            <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                          </Select>
                        ) : (
                          pricingLabel(item.pricingType)
                        )}
                      </ListCardMeta>
                      <ListCardMeta label="ราคา" align="right">
                        {isEditing ? (
                          <Input
                            aria-label={`ราคาบริการ ${item.name}`}
                            disabled={updateItem.isPending}
                            size="dense"
                            type="number"
                            min={0}
                            step={0.01}
                            value={editingItem.defaultPrice}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                defaultPrice: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : "",
                              })
                            }
                            className="ml-auto w-28 text-right"
                          />
                        ) : (
                          <span className="font-semibold tabular-nums text-strong">
                            {formatCurrency(item.defaultPrice)}
                          </span>
                        )}
                      </ListCardMeta>
                    </ListCardMetaGrid>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItem(null)}
                            disabled={updateItem.isPending}
                          >
                            <X />
                            ยกเลิก
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={updateItem.isPending || editingItem.defaultPrice === "" || editingItem.defaultPrice < 0}
                          >
                            <Check />
                            บันทึก
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(item)}
                            disabled={updateItem.isPending}
                          >
                            <Pencil />
                            แก้ไข
                          </Button>
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`ลบ ${item.name}`}
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={deleteItem.isPending}
                            >
                              <Trash2 />
                              ลบ
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </ListCardItem>
              );
            })}
          </ListCards>
        )}
      />

      {/* Error display */}
      {(createItem.isError || updateItem.isError || deleteItem.isError || toggleActive.isError) && (
        <Alert variant="error">
          {createItem.error?.message ||
            updateItem.error?.message ||
            deleteItem.error?.message ||
            toggleActive.error?.message}
        </Alert>
      )}
    </PageShell>
  );
}
