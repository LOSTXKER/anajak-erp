"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { isImageUrl } from "@/lib/utils";
import { artworkSpecGaps, ARTWORK_POSITION_LABELS } from "@/lib/artwork";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneMark } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { toast } from "sonner";
import { Copy, Film, ImageIcon, Loader2, Palette, Pencil, Plus } from "lucide-react";

// คลังลายต่อลูกค้า (ก้อน 4 ชิ้น 2) — ลายเข้าคลังเองตอน QC ผ่าน · การ์ดนี้ = ดู/แก้สเปก/
// เพิ่มมือ/สั่งซ้ำ 1 คลิก (duplicate ออเดอร์ล่าสุดที่ใช้ลาย — ราคาเดิมติดมา คนตรวจก่อนยืนยันเอง)

interface CustomerArtworksCardProps {
  customerId: string;
}

type ArtworkRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  printFileUrl: string | null;
  position: string | null;
  printType: string | null;
  printSize: string | null;
  widthCm: number | null;
  heightCm: number | null;
  colorCount: number | null;
  heatTempC: number | null;
  heatPressSec: number | null;
  heatPressure: string | null;
  specNotes: string | null;
  isActive: boolean;
  usedOrderCount: number;
  latestOrder: { id: string; orderNumber: string } | null;
  filmQty: number;
};

type EditForm = {
  name: string;
  widthCm: string;
  heightCm: string;
  heatTempC: string;
  heatPressSec: string;
  heatPressure: string;
  specNotes: string;
};

const EMPTY_EDIT: EditForm = {
  name: "",
  widthCm: "",
  heightCm: "",
  heatTempC: "",
  heatPressSec: "",
  heatPressure: "",
  specNotes: "",
};

// ช่องว่าง/ค่าไม่ valid/ศูนย์ → null = "เคลียร์ค่ากลับเป็นยังไม่รู้" (gap badge เตือนต่อ)
// — undefined แปลว่า "ไม่แตะ" ใน Prisma ทำให้ลบค่าที่เคยกรอกไม่ได้
function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function specChips(a: ArtworkRow): string[] {
  const chips: string[] = [];
  if (a.position) chips.push(ARTWORK_POSITION_LABELS[a.position] ?? a.position);
  if (a.printType) chips.push(a.printType);
  if (a.widthCm && a.heightCm) chips.push(`${a.widthCm}×${a.heightCm} ซม.`);
  if (a.heatTempC) chips.push(`${a.heatTempC}°C`);
  if (a.heatPressSec) chips.push(`${a.heatPressSec} วิ`);
  if (a.heatPressure) chips.push(`กด${a.heatPressure}`);
  return chips;
}

export function CustomerArtworksCard({ customerId }: CustomerArtworksCardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const { data: me } = trpc.user.me.useQuery();
  const artworks = trpc.artwork.listByCustomer.useQuery({ customerId });

  const [editing, setEditing] = React.useState<ArtworkRow | null>(null);
  const [editForm, setEditForm] = React.useState<EditForm>(EMPTY_EDIT);
  const [adding, setAdding] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [addImageUrl, setAddImageUrl] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);

  const canEdit = !me || permAllows(me.permissions, "manage_design_files");
  const canCreate = !me || permAllows(me.permissions, "create_design_assets");
  const canReorder = canCreateOrderWithPricing(me?.permissions);

  const updateArtwork = useMutationWithInvalidation(trpc.artwork.update, {
    invalidate: [utils.artwork.listByCustomer],
    onSuccess: () => setEditing(null),
    onError: (err: { message?: string }) => toast.error(err.message ?? "บันทึกไม่สำเร็จ"),
  });
  // toggle เปิด/ปิดใช้งานแยกจากปุ่มบันทึก — ห้ามปิด dialog (ค่าที่พิมพ์ค้างจะหายเงียบ)
  const toggleActive = useMutationWithInvalidation(trpc.artwork.update, {
    invalidate: [utils.artwork.listByCustomer],
    onSuccess: (updated: { isActive: boolean }) => {
      setEditing((prev) => (prev ? { ...prev, isActive: updated.isActive } : prev));
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "บันทึกไม่สำเร็จ"),
  });
  const createArtwork = useMutationWithInvalidation(trpc.artwork.create, {
    invalidate: [utils.artwork.listByCustomer],
    onSuccess: () => {
      setAdding(false);
      setAddName("");
      setAddImageUrl("");
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "เพิ่มลายไม่สำเร็จ"),
  });
  const duplicateOrder = useMutationWithInvalidation(trpc.order.duplicate, {
    invalidate: [utils.order.list, utils.artwork.listByCustomer],
    onSuccess: (data: { id: string; filmStockCount?: number }) => {
      if (data.filmStockCount && data.filmStockCount > 0) {
        toast.info(
          `ลูกค้ามีฟิล์มพร้อมรีดค้าง ${data.filmStockCount} รายการ — เช็คที่คลังฟิล์มก่อนเปิดรอบพิมพ์ใหม่`
        );
      }
      router.push(`/orders/${data.id}`);
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "สั่งซ้ำไม่สำเร็จ"),
  });

  function openEdit(a: ArtworkRow) {
    setEditing(a);
    setEditForm({
      name: a.name,
      widthCm: a.widthCm?.toString() ?? "",
      heightCm: a.heightCm?.toString() ?? "",
      heatTempC: a.heatTempC?.toString() ?? "",
      heatPressSec: a.heatPressSec?.toString() ?? "",
      heatPressure: a.heatPressure ?? "",
      specNotes: a.specNotes ?? "",
    });
  }

  function submitEdit() {
    if (!editing || !editForm.name.trim()) return;
    updateArtwork.mutate({
      id: editing.id,
      name: editForm.name.trim(),
      widthCm: numOrNull(editForm.widthCm),
      heightCm: numOrNull(editForm.heightCm),
      heatTempC: numOrNull(editForm.heatTempC),
      heatPressSec: numOrNull(editForm.heatPressSec),
      heatPressure: editForm.heatPressure.trim() || null,
      specNotes: editForm.specNotes.trim() || null,
    });
  }

  async function reorder(a: ArtworkRow) {
    if (!a.latestOrder) return;
    if (
      !(await confirm({
        title: `สั่งซ้ำลาย "${a.name}"?`,
        description: `สร้างออเดอร์ใหม่จากสำเนา ${a.latestOrder.orderNumber} (ลาย+สเปกตามมาครบ) — ราคาเป็นของใบเดิม ตรวจก่อนยืนยันเสมอ`,
        confirmText: "สั่งซ้ำ",
      }))
    )
      return;
    duplicateOrder.mutate({ id: a.latestOrder.id });
  }

  const rows = (artworks.data ?? []) as ArtworkRow[];
  const totalFilm = rows.reduce((s, a) => s + a.filmQty, 0);
  // คลังลายโตเองทุกงานที่ QC ผ่าน — จำกัดความสูงการ์ด ไม่ดันออเดอร์/ประวัติติดต่อจมหาย
  const VISIBLE_LIMIT = 6;
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE_LIMIT);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ToneMark icon={Palette} tone="production" />
            คลังลาย ({rows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalFilm > 0 && (
              <Badge variant="warning" className="gap-1.5">
                <Film className="h-3 w-3" />
                ฟิล์มค้าง {totalFilm} ชิ้น
              </Badge>
            )}
            {canCreate && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}
              >
                <Plus />
                เพิ่มลาย
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {artworks.isLoading ? (
          <p className="text-sm text-muted">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">
            ยังไม่มีลายในคลัง — ลายจะเข้าคลังเองเมื่องานพิมพ์ผ่าน QC หรือกด &quot;เพิ่มลาย&quot;
          </p>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((a) => {
              const gaps = artworkSpecGaps(a);
              return (
                <div
                  key={a.id}
                  className={`flex gap-3 rounded-lg border border-border p-3 ${
                    a.isActive ? "" : "opacity-50"
                  }`}
                >
                  {a.imageUrl && isImageUrl(a.imageUrl) ? (
                    <a href={a.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={a.imageUrl}
                        alt={a.name}
                        className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-slate-50 dark:bg-slate-800">
                      <ImageIcon className="h-6 w-6 text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-strong">
                        {a.name}
                      </p>
                      {!a.isActive && (
                        <Badge variant="secondary">
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {specChips(a).map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      ใช้ไป {a.usedOrderCount} ออเดอร์
                      {a.latestOrder ? ` · ล่าสุด ${a.latestOrder.orderNumber}` : ""}
                      {a.filmQty > 0 ? (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {" "}
                          · ฟิล์มค้าง {a.filmQty} ชิ้น
                        </span>
                      ) : null}
                    </p>
                    {gaps.length > 0 && (
                      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                        สเปกยังไม่ครบ: {gaps.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {canReorder && a.latestOrder && a.isActive && (
                      <Button size="sm" className="gap-1.5" onClick={() => reorder(a)}
                        disabled={duplicateOrder.isPending}
                      >
                        {duplicateOrder.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Copy />
                        )}
                        สั่งซ้ำ
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(a)}
                      >
                        <Pencil />
                        แก้ไข
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length > VISIBLE_LIMIT && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full text-muted"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "ย่อ" : `ดูทั้งหมด (${rows.length})`}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* dialog แก้สเปกลาย */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขลาย</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="ชื่อลาย" required>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="กว้าง (ซม.)">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.widthCm}
                  onChange={(e) => setEditForm((f) => ({ ...f, widthCm: e.target.value }))}
                />
              </Field>
              <Field label="สูง (ซม.)">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.heightCm}
                  onChange={(e) => setEditForm((f) => ({ ...f, heightCm: e.target.value }))}
                />
              </Field>
            </div>
            {/* สเปกรีด — หัวใจของ "สั่งซ้ำได้สเปกเดิมเป๊ะ" (กรอกครั้งเดียว ใช้ทุกรอบ) */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="อุณหภูมิ (°C)">
                <Input
                  type="number"
                  min="0"
                  value={editForm.heatTempC}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatTempC: e.target.value }))}
                />
              </Field>
              <Field label="เวลารีด (วิ)">
                <Input
                  type="number"
                  min="0"
                  value={editForm.heatPressSec}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatPressSec: e.target.value }))}
                />
              </Field>
              <Field label="แรงกด">
                <Input
                  placeholder="เบา/กลาง/หนัก"
                  value={editForm.heatPressure}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatPressure: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="โน้ตสเปก">
              <Textarea
                rows={2}
                value={editForm.specNotes}
                onChange={(e) => setEditForm((f) => ({ ...f, specNotes: e.target.value }))}
              />
            </Field>
            {editing && (
              <Button variant="ghost" size="sm" className="text-muted" onClick={() =>
                  toggleActive.mutate({ id: editing.id, isActive: !editing.isActive })
                }
                disabled={toggleActive.isPending}
              >
                {toggleActive.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : editing.isActive ? (
                  "ปิดใช้งานลายนี้ (เลิกใช้ — ไม่ลบ)"
                ) : (
                  "เปิดใช้งานลายนี้"
                )}
              </Button>
            )}
          </div>
          <DialogSubmitFooter
            pending={updateArtwork.isPending}
            disabled={!editForm.name.trim()}
            submitLabel="บันทึก"
            onCancel={() => setEditing(null)}
            onSubmit={submitEdit}
          />
        </DialogContent>
      </Dialog>

      {/* dialog เพิ่มลายมือ — ลายเก่าก่อนมีระบบ */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มลายเข้าคลัง</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="ชื่อลาย" required>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="เช่น โลโก้อกซ้าย ดำ"
              />
            </Field>
            <div>
              <p className="mb-1 block text-xs font-medium text-muted">รูปลาย</p>
              {addImageUrl ? (
                <div className="flex items-center gap-2">
                  <img
                    src={addImageUrl}
                    alt="ลายใหม่"
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setAddImageUrl("")}
                  >
                    เปลี่ยนรูป
                  </Button>
                </div>
              ) : (
                <FileUpload
                  bucket="designs"
                  pathPrefix={`artworks/${customerId}`}
                  accept="image/*"
                  onUploaded={(url) => setAddImageUrl(url)}
                  onError={(msg) => toast.error(msg)}
                />
              )}
            </div>
            <p className="text-xs text-muted">
              สเปก (ขนาด/อุณหภูมิ/แรงกด) เติมทีหลังได้จากปุ่มแก้ไข
            </p>
          </div>
          <DialogSubmitFooter
            pending={createArtwork.isPending}
            disabled={!addName.trim()}
            submitLabel="เพิ่มลาย"
            onCancel={() => setAdding(false)}
            onSubmit={() =>
              createArtwork.mutate({
                customerId,
                name: addName.trim(),
                imageUrl: addImageUrl || undefined,
              })
            }
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
