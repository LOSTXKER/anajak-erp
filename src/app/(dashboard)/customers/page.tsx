"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { Badge } from "@/components/ui/badge";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ListCards, ListCardItem, ListCardMetaGrid, ListCardMeta } from "@/components/ui/list-card";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { formatCurrency } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { c } from "@/components/kit/kit";
import { CustomerCreateDialog } from "@/components/customers/customer-create-dialog";
import { ChatLink } from "@/components/customers/chat-link";
import {
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_SEGMENT_ORDER,
  customerInitial,
} from "@/components/customers/customer-segments";
import { CustomerTypeChip } from "@/components/customers/customer-type";
import { PageShell } from "@/components/page-shell";
import { SegmentedControl } from "@/components/ui/segmented";
import { KitDateRange } from "@/components/kit/date-range";
import { validDateParam } from "@/lib/order-list-contract";
import { formatDateShort } from "@/lib/utils";
import { Plus, Users, Phone, ChevronRight } from "lucide-react";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { VISUAL_TONE_CLASSES } from "@/lib/visual-tone";
import { cn } from "@/lib/utils";

/* กลุ่มลูกค้าไม่ใช่ "สถานะ" — ไม่มีอันไหนดีหรือร้าย (UI-2026 เฟส 3)
   ของเดิมยืมจานสีสถานะมาย้อมจนคอลัมน์เดียวมี 4 สี (VIP=เขียว ขาประจำ=น้ำเงิน
   ไม่เคลื่อนไหว=เหลือง) ทำให้สีที่ควรแปลว่า "ต้องทำอะไรสักอย่าง" หมดความหมาย
   ตอนนี้เป็น neutral ทั้งชุด — ความต่างอ่านจากคำ ไม่ใช่จากสี
   (ต้นแบบ 2026-09-16 ย้อม VIP น้ำเงิน/ไม่เคลื่อนไหวเทา — ยังไม่ทำ รอเบสเคาะ)
   คำและลำดับกลุ่มอยู่ที่ components/customers/customer-segments.ts ที่เดียว */
const SEGMENT_FILTERS = [
  { value: "", label: "ทั้งหมด" },
  ...CUSTOMER_SEGMENT_ORDER.map((value) => ({
    value: value as string,
    label: CUSTOMER_SEGMENT_LABELS[value],
  })),
];

/** ป้ายปุ่มกรองพร้อมจำนวน — รูปแบบเดียวกับแถบกรองหน้าออเดอร์ */
function pillLabel(label: string, count?: number) {
  return (
    <>
      {label}
      {typeof count === "number" && count > 0 ? <span className={c("n")}>{count.toLocaleString("th-TH")}</span> : null}
    </>
  );
}

/** ตราลูกค้า — อักษรแรกหลังตัดคำนำหน้า (ต้นแบบ .who .av)
 *  หน้ารายการชุดนี้ห้ามมีตราแบบกล่องไอคอน (ด่าน verify-ui-tokens) */
function CustomerMark({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
        VISUAL_TONE_CLASSES.brand.soft,
      )}
    >
      {customerInitial(label)}
    </span>
  );
}

/** สั่งล่าสุด: วันที่ + ผ่านมากี่วัน · หายไปเกิน 90 วันขึ้นป้ายตามต้นแบบ (.due n)
 *  ต้นแบบมีแต่ "N วันก่อน" — ของจริงคงวันที่ไว้ด้วย เพราะคนถามต่อเสมอว่าวันไหน */
function LastOrderCell({ at, now }: { at: Date | string | null; now: number }) {
  if (!at) return <span className="text-xs text-muted">ยังไม่เคยสั่ง</span>;
  const days = differenceInBangkokDays(at, now);
  const ago = days === null ? null : Math.abs(days);
  const agoText = ago === null ? null : ago === 0 ? "วันนี้" : `${ago.toLocaleString("th-TH")} วันก่อน`;
  return (
    <span className="text-xs text-secondary">
      {formatDateShort(at)}
      {agoText ? (
        ago !== null && ago > 90 ? (
          <span className={cn(c("due n"), "ml-1.5")}>{agoText}</span>
        ) : (
          <span className="ml-1.5 text-muted">{agoText}</span>
        )
      ) : null}
    </span>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef, clearSearch } =
    useListPageState();
  const rawSegment = searchParams.get("status") ?? "";
  const segment = Object.hasOwn(CUSTOMER_SEGMENT_LABELS, rawSegment) ? rawSegment : "";
  const dateFrom = validDateParam(searchParams.get("from"));
  const dateTo = validDateParam(searchParams.get("to"));
  const filtered = Boolean(search || segment || dateFrom || dateTo);
  const clearFilters = () => clearSearch({ status: null, from: null, to: null });
  // เพิ่มลูกค้า = กล่องเด้งตามต้นแบบ — รายการด้านหลังไม่ขยับตอนกดปุ่ม
  const [creating, setCreating] = useState(false);

  const { data: me } = trpc.user.me.useQuery();
  const canManageCustomers = permAllows(me?.permissions, "manage_customers");
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนคอลัมน์ยอดรวมทั้งแถบ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const statsQuery = trpc.customer.stats.useQuery();
  const PAGE_SIZE = 50;
  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt: listUpdatedAt } = trpc.customer.list.useQuery(
    {
      search: search.trim() || undefined,
      segment: segment || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      page,
      limit: PAGE_SIZE,
    },
    // เปลี่ยนหน้าแล้วค้างข้อมูลหน้าเดิมไว้ระหว่างโหลด — ไม่งั้นตาราง 50 แถวยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (review B7 จับ)
    { placeholderData: (prev) => prev }
  );
  // Router จงใจคืน null แทนตัวเลขเงินสำหรับ role หน้างาน — widen type ให้การ์ด/ตาราง
  // ใช้รายการเดียวกันได้โดยไม่ตีความ null เป็นศูนย์
  const customerItems = data?.customers.map((customer) => ({
    ...customer,
    totalSpent: customer.totalSpent as number | null,
    creditLimit: customer.creditLimit as number | null,
  }));

  usePageClamp(page, data?.pages, replaceListState);

  return (
    <PageShell
      title="ลูกค้า"
      meta={
        statsQuery.data
          ? `${statsQuery.data.total.toLocaleString("th-TH")} ราย · ใหม่เดือนนี้ ${statsQuery.data.newThisMonth.toLocaleString("th-TH")} ราย · ไม่เคลื่อนไหว ${statsQuery.data.inactive.toLocaleString("th-TH")} ราย`
          : undefined
      }
      action={
        canManageCustomers ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            เพิ่มลูกค้า
          </Button>
        ) : undefined
      }
    >
      {statsQuery.isError ? (
        <QueryError message="โหลดสถิติไม่สำเร็จ" onRetry={() => statsQuery.refetch()} />
      ) : null}

      <ResponsiveList
        items={customerItems}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายชื่อลูกค้าไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ลูกค้า"
        toolbar={
        <Toolbar>
          <SearchInput
            surface="raised"
            ref={searchInputRef}
            containerClassName="@2xl:max-w-sm @2xl:flex-1"
            placeholder="ค้นชื่อ บริษัท เบอร์โทร ไลน์ หรืออีเมล"
            aria-label="ค้นหาลูกค้าจากชื่อ บริษัท เบอร์โทร ไลน์ หรืออีเมล"
            defaultValue={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <KitDateRange
            label="ช่วงวันที่สั่งล่าสุด"
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => replaceListState({ from: from || null, to: to || null, page: null })}
          />

          <ToolbarGroup className="flex-wrap">
            <SegmentedControl
              value={segment}
              onChange={(value) => replaceListState({ status: value || null, page: null })}
              options={SEGMENT_FILTERS.map((option) => ({
                value: option.value,
                label: pillLabel(option.label, data?.counts?.[option.value]),
              }))}
              aria-label="กรองกลุ่มลูกค้า"
            />
            {/* ต้นแบบไม่มีปุ่มนี้ (ใช้ชิปตัวกรองแทน) — ของจริงกรองได้ 3 ทางพร้อมกัน
                (คำค้น + ช่วงวันที่ + กลุ่ม) ต้องมีทางล้างทีเดียว */}
            {filtered ? <Button variant="ghost" size="sm" onClick={clearFilters}>ล้างตัวกรอง</Button> : null}
          </ToolbarGroup>

          {/* ตัวนับท้ายแถบเครื่องมือตามต้นแบบ (.tools .cnt) — จำนวนที่ตรงกับตัวกรองตอนนี้
              ยังไม่มีข้อมูลก็ยังไม่ขึ้นตัวเลข (0 ราย ระหว่างโหลดอ่านเป็น "ไม่มีลูกค้า") */}
          {data ? (
            <ToolbarGroup align="end">
              <span className="text-xs text-muted tabular-nums" aria-live="polite">
                {data.total.toLocaleString("th-TH")} ราย
              </span>
            </ToolbarGroup>
          ) : null}
        </Toolbar>
        }
        renderDesktop={(customers) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th>ติดต่อ</DataTable.Th>
                <DataTable.Th>กลุ่ม</DataTable.Th>
                <DataTable.Th align="right">ออเดอร์</DataTable.Th>
                {canSeeMoney && <DataTable.Th align="right">ยอดสะสม</DataTable.Th>}
                <DataTable.Th>สั่งล่าสุด</DataTable.Th>
                <DataTable.Th align="right"><span className="sr-only">เปิดลูกค้า</span></DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {customers.map((customer) => {
                const title = customer.company || customer.name;
                const segmentLabel = CUSTOMER_SEGMENT_LABELS[customer.segment] ?? customer.segment;
                return (
                  <DataTable.Row key={customer.id} href={`/customers/${customer.id}`}>
                    <DataTable.Td>
                      {/* ตรา + ชื่อ + ผู้ติดต่อ — เรียงชุดเดียวกับการ์ดจอแคบด้านล่าง
                          (เดิมเดสก์ท็อปสลับบน/ล่างกับการ์ด เปิดสองมุมมองแล้วอ่านคนละเรื่อง) */}
                      <div className={c("who")}>
                        <CustomerMark label={title} />
                        <div className={c("t")}>
                          <div className={c("id")}>
                            <Link href={`/customers/${customer.id}`} className="font-medium text-strong">
                              {title}
                            </Link>
                          </div>
                          {/* ไม่มีชื่อบริษัท = ไม่มีผู้ติดต่อให้บอก บรรทัดรองจึงตกเป็นของประเภทลูกค้า
                              (ป้ายชุดเดียวกับการ์ดจอแคบด้านล่าง เดิมที่นั่นตัดคำเหลือ "บุคคล") */}
                          {customer.company ? (
                            <p className={c("cu")}>ผู้ติดต่อ {customer.name}</p>
                          ) : (
                            <CustomerTypeChip type={customer.customerType} />
                          )}
                        </div>
                      </div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div className={c("why-cell")}>
                        <span className={c("why")}>
                          <Phone aria-hidden="true" className="h-3.5 w-3.5" />
                          {customer.phone || customer.email || "—"}
                        </span>
                        {customer.lineId ? (
                          <span className={c("wholine")}>LINE {customer.lineId}</span>
                        ) : customer.chatName || customer.chatUrl ? (
                          <ChatLink name={customer.chatName} url={customer.chatUrl} stopPropagation />
                        ) : null}
                      </div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <Badge variant="default">{segmentLabel}</Badge>
                    </DataTable.Td>
                    <DataTable.Td align="right" className="font-medium tabular-nums text-strong">
                      {customer._count.orders}
                    </DataTable.Td>
                    {canSeeMoney && (
                      <DataTable.Td
                        align="right"
                        className="font-medium tabular-nums text-strong"
                      >
                        {formatCurrency(customer.totalSpent ?? 0)}
                      </DataTable.Td>
                    )}
                    <DataTable.Td className="whitespace-nowrap">
                      <LastOrderCell at={customer.lastOrderAt} now={listUpdatedAt} />
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden="true" />
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(customers) => (
          <ListCards label="รายชื่อลูกค้า">
            {customers.map((customer) => {
              const title = customer.company || customer.name;
              const segmentLabel = CUSTOMER_SEGMENT_LABELS[customer.segment] ?? customer.segment;
              return (
                <ListCardItem key={customer.id}>
                  <Link
                    href={`/customers/${customer.id}`}
                    className={cn("block min-h-11 rounded-lg p-4", FOCUS_BUTTON)}
                    aria-label={`เปิดข้อมูลลูกค้า ${customer.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <CustomerMark label={title} />
                        <div className="min-w-0">
                          <p className="font-semibold text-strong">{title}</p>
                          {customer.company && (
                            <p className="mt-0.5 text-xs text-muted">
                              ผู้ติดต่อ {customer.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-muted" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="default">{segmentLabel}</Badge>
                      <CustomerTypeChip type={customer.customerType} />
                      <span className="text-xs text-secondary tabular-nums">
                        {customer._count.orders.toLocaleString("th-TH")} ออเดอร์
                      </span>
                    </div>
                    <ListCardMetaGrid>
                      <ListCardMeta label="ติดต่อ">
                        {customer.phone || customer.email || "ยังไม่มีข้อมูล"}
                      </ListCardMeta>
                      {/* Policy ⑦: ไม่มีสิทธิ์เห็นเงิน = ไม่มีช่องนี้เลย — เดิมเหลือป้าย
                          "N ออเดอร์" ค้างไว้กับค่าว่างข้างใต้ อ่านเป็น "โหลดไม่ขึ้น"
                          จำนวนออเดอร์ย้ายไปอยู่แถวป้ายด้านบนแล้ว ไม่หายไปไหน */}
                      {canSeeMoney ? (
                        <ListCardMeta label="ยอดสะสม" align="right">
                          <span className="font-semibold tabular-nums text-strong">
                            {formatCurrency(customer.totalSpent ?? 0)}
                          </span>
                        </ListCardMeta>
                      ) : null}
                    </ListCardMetaGrid>
                  </Link>
                </ListCardItem>
              );
            })}
          </ListCards>
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title={filtered ? "ไม่พบลูกค้าในกลุ่มนี้" : "ไม่พบลูกค้า"}
            description={
              filtered
                ? "ลองเปลี่ยนคำค้นหาหรือกลุ่มลูกค้า"
                : "เพิ่มลูกค้าใหม่เพื่อเริ่มต้นการจัดการ CRM"
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>ล้างตัวกรองและคำค้น</Button>
              ) : canManageCustomers ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus />
                  เพิ่มลูกค้า
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          data && data.customers.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              limit={PAGE_SIZE}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
              label="รายการ"
            />
          ) : undefined
        }
      />

      {creating && canManageCustomers && (
        <CustomerCreateDialog onClose={() => setCreating(false)} />
      )}
    </PageShell>
  );
}
