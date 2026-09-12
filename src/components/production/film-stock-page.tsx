"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { QueryError } from "@/components/ui/query-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import {
  operationsBack,
  operationsHref,
  type OperationsOrigin,
} from "./operations-navigation";

type Film = RouterOutput["filmStock"]["list"][number];

export function FilmStockPage({ origin }: { origin?: OperationsOrigin }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Film | null>(null);
  const me = trpc.user.me.useQuery();
  const films = trpc.filmStock.list.useQuery(
    { search: search.trim() || undefined },
    { refetchOnWindowFocus: true },
  );
  const canConsume =
    permAllows(me.data?.permissions, "manage_production") &&
    !me.isError &&
    !films.isFetching &&
    !films.isError;
  return (
    <PageShell
      title="คลังฟิล์มพร้อมรีด"
      icon={Layers}
      back={operationsBack(origin)}
      action={
        <Button asChild variant="outline">
          <Link href={operationsHref("/production/print-runs", origin)}>
            รอบพิมพ์ DTF
          </Link>
        </Button>
      }
    >
      <Section
        surface="plain"
        description="ฟิล์มเผื่อจากรอบที่ตัดแยกเสร็จแล้ว ตรวจลายและลูกค้าก่อนหยิบ การลดคลังไม่ถือว่าผ่านขั้นผลิตของออเดอร์ใหม่"
      >
        <Field label="ค้นหาลาย ลูกค้า หรือเลขออเดอร์">
          <Input
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="เช่น โลโก้หน้าอก หรือ ORD-…"
            className="max-w-lg"
          />
        </Field>
        {films.isError && (
          <QueryError
            message="โหลดคลังฟิล์มไม่สำเร็จ"
            onRetry={() => void films.refetch()}
          />
        )}
        {me.isError && (
          <QueryError
            message="โหลดสิทธิ์ไม่สำเร็จ"
            onRetry={() => void me.refetch()}
          />
        )}
        {films.isPending ? (
          <p className="py-6" role="status">
            กำลังโหลดคลังฟิล์ม…
          </p>
        ) : films.data?.length === 0 ? (
          <p className="py-6 text-secondary">
            {search
              ? "ไม่พบฟิล์มตามคำค้น"
              : "ยังไม่มีฟิล์มเผื่อในคลัง ระบุฟิล์มเผื่อตอนตัดแยกรอบพิมพ์"}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-divider">
            {films.data?.map((film) => (
              <div
                key={film.id}
                className="flex flex-wrap items-center gap-4 py-4"
              >
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <h2 className="font-semibold text-strong">{film.label}</h2>
                  <p className="text-sm text-secondary">
                    {film.customer.name} ·{" "}
                    {film.order?.orderNumber || "ไม่ระบุออเดอร์ต้นทาง"} ·{" "}
                    {film.printRun?.runNumber || "ไม่มีรอบพิมพ์อ้างอิง"}
                  </p>
                </div>
                <p className="text-xl font-semibold tabular-nums text-strong">
                  {film.qty}
                  <span className="ml-1 text-sm font-normal text-muted">
                    ชิ้น
                  </span>
                </p>
                {permAllows(me.data?.permissions, "manage_production") && (
                  <Button
                    variant="outline"
                    disabled={!canConsume}
                    onClick={() => setSelected(film)}
                  >
                    หยิบใช้ / ตัดทิ้ง
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {films.data?.length === 100 && (
          <p className="mt-3 text-sm text-muted">
            แสดง 100 รายการล่าสุด ใช้คำค้นเพื่อหาลายที่ต้องการ
          </p>
        )}
      </Section>
      {selected && (
        <ConsumeFilmDialog
          key={selected.id}
          film={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </PageShell>
  );
}

function ConsumeFilmDialog({
  film,
  onClose,
}: {
  film: Film;
  onClose: () => void;
}) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const consume = trpc.filmStock.consume.useMutation({
    onSuccess: async () => {
      await utils.filmStock.list.invalidate();
      toast.success("บันทึกลดคลังฟิล์มแล้ว");
      onClose();
    },
  });
  const amount = Number(qty);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !consume.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>หยิบใช้ / ตัดทิ้งฟิล์ม</DialogTitle>
          <DialogDescription>
            {film.label} · คงเหลือที่เปิดใบ {film.qty} ชิ้น
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="จำนวนที่นำออก">
            <Input
              type="number"
              min={1}
              max={film.qty}
              step={1}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              disabled={consume.isPending}
            />
          </Field>
          <Field label="นำไปใช้กับงานใด หรือเหตุผลที่ทิ้ง">
            <Input
              value={note}
              maxLength={300}
              placeholder="เช่น ใช้กับ ORD-… หรือฟิล์มชำรุด"
              onChange={(event) => setNote(event.target.value)}
              disabled={consume.isPending}
            />
          </Field>
          {consume.isError && (
            <Alert variant="error">
              {consume.error.message} จำนวนและหมายเหตุที่กรอกยังอยู่
            </Alert>
          )}
        </div>
        <DialogSubmitFooter
          pending={consume.isPending}
          pendingLabel="กำลังบันทึก…"
          submitLabel="ยืนยันลดคลังฟิล์ม"
          disabled={
            !Number.isInteger(amount) ||
            amount < 1 ||
            amount > film.qty ||
            !note.trim()
          }
          onCancel={onClose}
          onSubmit={() =>
            consume.mutate({ id: film.id, qty: amount, note: note.trim() })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
