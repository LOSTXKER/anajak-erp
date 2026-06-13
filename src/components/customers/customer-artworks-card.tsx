"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { isImageUrl } from "@/lib/utils";
import { artworkSpecGaps, ARTWORK_POSITION_LABELS } from "@/lib/artwork";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

  const canEdit = !me || ["OWNER", "MANAGER", "DESIGNER"].includes(me.role);
  const canCreate = !me || ["OWNER", "MANAGER", "DESIGNER", "SALES"].includes(me.role);
  const canReorder = !me || ["OWNER", "MANAGER", "SALES"].includes(me.role);

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
            <Palette className="h-4 w-4" />
            คลังลาย ({rows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalFilm > 0 && (
              <Badge variant="warning" className="gap-1">
                <Film className="h-3 w-3" />
                ฟิล์มค้าง {totalFilm} ชิ้น
              </Badge>
            )}
            {canCreate && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3 w-3" />
                เพิ่มลาย
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {artworks.isLoading ? (
          <p className="text-sm text-slate-400">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">
            ยังไม่มีลายในคลัง — ลายจะเข้าคลังเองเมื่องานพิมพ์ผ่าน QC หรือกด &quot;เพิ่มลาย&quot;
          </p>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((a) => {
              const gaps = artworkSpecGaps(a);
              return (
                <div
                  key={a.id}
                  className={`flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${
                    a.isActive ? "" : "opacity-50"
                  }`}
                >
                  {a.imageUrl && isImageUrl(a.imageUrl) ? (
                    <a href={a.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={a.imageUrl}
                        alt={a.name}
                        className="h-16 w-16 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700"
                      />
                    </a>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      <ImageIcon className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {a.name}
                      </p>
                      {!a.isActive && (
                        <Badge variant="secondary" className="text-[10px]">
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {specChips(a).map((c) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      ใช้ไป {a.usedOrderCount} ออเดอร์
                      {a.latestOrder ? ` · ล่าสุด ${a.latestOrder.orderNumber}` : ""}
                      {a.filmQty > 0 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {" "}
                          · ฟิล์มค้าง {a.filmQty} ชิ้น
                        </span>
                      ) : null}
                    </p>
                    {gaps.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                        สเปกยังไม่ครบ: {gaps.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {canReorder && a.latestOrder && a.isActive && (
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => reorder(a)}
                        disabled={duplicateOrder.isPending}
                      >
                        {duplicateOrder.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        สั่งซ้ำ
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3 w-3" />
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
                className="h-7 w-full text-xs text-slate-500"
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">ชื่อลาย *</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">กว้าง (ซม.)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.widthCm}
                  onChange={(e) => setEditForm((f) => ({ ...f, widthCm: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">สูง (ซม.)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.heightCm}
                  onChange={(e) => setEditForm((f) => ({ ...f, heightCm: e.target.value }))}
                />
              </div>
            </div>
            {/* สเปกรีด — หัวใจของ "สั่งซ้ำได้สเปกเดิมเป๊ะ" (กรอกครั้งเดียว ใช้ทุกรอบ) */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">อุณหภูมิ (°C)</label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.heatTempC}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatTempC: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">เวลารีด (วิ)</label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.heatPressSec}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatPressSec: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">แรงกด</label>
                <Input
                  placeholder="เบา/กลาง/หนัก"
                  value={editForm.heatPressure}
                  onChange={(e) => setEditForm((f) => ({ ...f, heatPressure: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">โน้ตสเปก</label>
              <Textarea
                rows={2}
                value={editForm.specNotes}
                onChange={(e) => setEditForm((f) => ({ ...f, specNotes: e.target.value }))}
              />
            </div>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-500"
                onClick={() =>
                  toggleActive.mutate({ id: editing.id, isActive: !editing.isActive })
                }
                disabled={toggleActive.isPending}
              >
                {toggleActive.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : editing.isActive ? (
                  "ปิดใช้งานลายนี้ (เลิกใช้ — ไม่ลบ)"
                ) : (
                  "เปิดใช้งานลายนี้"
                )}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button onClick={submitEdit} disabled={updateArtwork.isPending || !editForm.name.trim()}>
              {updateArtwork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog เพิ่มลายมือ — ลายเก่าก่อนมีระบบ */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มลายเข้าคลัง</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">ชื่อลาย *</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="เช่น โลโก้อกซ้าย ดำ"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">รูปลาย</label>
              {addImageUrl ? (
                <div className="flex items-center gap-2">
                  <img
                    src={addImageUrl}
                    alt="ลายใหม่"
                    className="h-16 w-16 rounded-md border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAddImageUrl("")}
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
            <p className="text-[11px] text-slate-400">
              สเปก (ขนาด/อุณหภูมิ/แรงกด) เติมทีหลังได้จากปุ่มแก้ไข
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() =>
                createArtwork.mutate({
                  customerId,
                  name: addName.trim(),
                  imageUrl: addImageUrl || undefined,
                })
              }
              disabled={createArtwork.isPending || !addName.trim()}
            >
              {createArtwork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "เพิ่มลาย"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
