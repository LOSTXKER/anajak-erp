"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Fact, FactList } from "@/components/ui/fact";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { BANGKOK_TZ, formatBaht, formatBahtRounded, formatDate, formatDateShort, formatDateTime } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { CustomerArtworksCard } from "@/components/customers/customer-artworks-card";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
import { CustomerCommLogDialog } from "@/components/customers/customer-comm-log-dialog";
import { ChatLink } from "@/components/customers/chat-link";
import { customerSegmentLabel } from "@/components/customers/customer-segments";
import { CustomerTypeChip } from "@/components/customers/customer-type";
import { commChannelLabel } from "@/lib/comm-channels";
import { PageShell } from "@/components/page-shell";
import { CardHead, Prop, c } from "@/components/kit/kit";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  Tag,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { cn } from "@/lib/utils";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";
import { customerContactName } from "@/lib/customer-name";

/** ไอคอนนำหน้าแถวในการ์ด "สรุป" — ไอคอนสีตามหมวด ไม่มีพื้นกล่อง
 *  (พื้นกล่องถูกถอดออกทั้งเว็บ 2026-08-31 เบสเคาะแบบ B จากหน้าลอง /proto/quiet) */
function SummaryIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: VisualTone }) {
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", VISUAL_TONE_CLASSES[tone].mark)}
      aria-hidden="true"
    />
  );
}

/** ปีที่เริ่มเป็นลูกค้า (พ.ศ.) ตามเวลาไทย — ต้นแบบ "ลูกค้าตั้งแต่ ปี 2567" */
function buddhistYear(date: Date | string): string {
  const gregorian = Number(
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: BANGKOK_TZ }).format(new Date(date)),
  );
  return Number.isFinite(gregorian) ? String(gregorian + 543) : "";
}

// แก้ข้อมูล/จดบันทึกการคุย = ทีมขาย-บัญชี-บริหาร (ตรง customerEditors ฝั่ง server)

// วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES แก้ไม่ได้ (ตรง server guard)

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const [loggingComm, setLoggingComm] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const canEdit = !!me && permAllows(me.permissions, "manage_customers");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนยอดสั่งรวม/ยอดออเดอร์ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const { data: customer, isLoading, isError, refetch } = trpc.customer.getById.useQuery({ id });
  // ภาระหนี้ + ยอดค้างชำระ — เปิดเสมอเมื่อเห็นเงิน (ลูกค้าไม่ตั้งวงเงินก็ต้องเห็นยอดค้าง
  // ในการ์ดสรุป — ธุรกิจเครดิตเทอมถามก่อนว่า "ค้างเท่าไร") · non-money role ยิงไปก็โดน FORBIDDEN
  const creditQuery = trpc.customer.creditStatus.useQuery(
    { customerId: id },
    { enabled: canSeeMoney }
  );
  const credit = creditQuery.data;
  const creditLoading =
    canSeeMoney &&
    !credit &&
    (creditQuery.isLoading || creditQuery.isFetching);
  const creditError = canSeeMoney && !credit && creditQuery.isError;

  if (!isLoading && !isError && !customer)
    return <RecordNotFound what="ลูกค้ารายนี้" backHref="/customers" backLabel="กลับไปรายการลูกค้า" />;

  const gaps = customer ? customerProfileGaps(customer) : [];
  // บรรทัดรองตามต้นแบบ: กลุ่มลูกค้า · ปีที่เริ่มเป็นลูกค้า · ชื่อผู้ติดต่อ
  const metaParts = customer
    ? [
        customerSegmentLabel(customer.segment),
        `ลูกค้าตั้งแต่ ปี ${buddhistYear(customer.createdAt)}`,
        customerContactName(customer) ? `ผู้ติดต่อ ${customerContactName(customer)}` : null,
      ].filter(Boolean)
    : [];
  const paymentTermsLabel = customer?.defaultPaymentTerms
    ? PAYMENT_TERMS_LABELS[customer.defaultPaymentTerms] ?? customer.defaultPaymentTerms
    : null;
  const hasContactChannel = Boolean(
    customer &&
      (customer.phone || customer.email || customer.lineId || customer.address || customer.chatName || customer.chatUrl),
  );

  return (
    <PageShell
      title={customer ? customer.company || customer.name : "ลูกค้า"}
      meta={metaParts.length > 0 ? metaParts.join(" · ") : undefined}
      back={{ href: "/customers", label: "ลูกค้าทั้งหมด" }}
      /* เดิมสองประเภทตั้งใจให้สีต่างกัน (default vs secondary) แต่ทั้งคู่ map ลงเทา
         จึงออกมาหน้าตาเดียวกัน — ป้ายกลางแยกนิติบุคคล (ฟ้า) กับบุคคลธรรมดา (เทา) จริง */
      titleBadge={customer ? <CustomerTypeChip type={customer.customerType} size="lg" /> : undefined}
      action={
        <>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil /> แก้ข้อมูล
            </Button>
          )}
          {canCreateOrder && (
            <Button asChild size="sm" className="w-full sm:w-auto">
              <Link href={`/orders/new?customerId=${id}`}>
                <Plus /> เปิดออเดอร์
              </Link>
            </Button>
          )}
        </>
      }
      headerChildren={
        gaps.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            โปรไฟล์ยังไม่ครบ: {gaps.map((g) => g.label).join(" · ")}
          </p>
        ) : undefined
      }
      loading={isLoading}
      skeleton={
        <div className="space-y-4.5">
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <div className={c("two")}>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      }
      error={isError ? { message: "โหลดข้อมูลลูกค้าไม่สำเร็จ", onRetry: () => refetch() } : null}
    >
      {customer ? (
        <>
          {/* ต้นแบบ .metrics.three — สามช่องบนจอกว้าง ระยะ 14px ชุดเดียวกับ .two/.stack ของ kit */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            <StatCard
              moduleTone="brand"
              title="ออเดอร์ทั้งหมด"
              value={customer._count.orders}
              icon={ShoppingCart}
              caption="ใบ"
            />
            {canSeeMoney ? (
              <StatCard
                moduleTone="finance"
                title="ยอดซื้อสะสม"
                value={formatBahtRounded(customer.totalSpent ?? 0)}
                icon={DollarSign}
              />
            ) : null}
            {canSeeMoney ? (
              /* ต้นแบบ: ใช้เครดิตอยู่ / จากวงเงิน X · ไม่มีวงเงิน = "—" และบรรทัดล่างเป็นเงื่อนไขชำระ
                 ยอดค้างชำระย้ายไปการ์ดเครดิตด้านล่างซึ่งมีตัวเลขครบชุดอยู่แล้ว */
              <StatCard
                loading={creditLoading}
                moduleTone="finance"
                title="ใช้เครดิตอยู่"
                value={customer.creditLimit != null ? formatBahtRounded(credit?.exposure ?? 0) : "—"}
                icon={Wallet}
                tone={
                  customer.creditLimit != null && (credit?.exposure ?? 0) > 0 ? "warning" : "muted"
                }
                caption={
                  customer.creditLimit != null
                    ? `จากวงเงิน ${formatBaht(customer.creditLimit)}`
                    : paymentTermsLabel ?? "ยังไม่ตั้งวงเงิน"
                }
              />
            ) : null}
          </div>

          {/* ต้นแบบ .split2 — ฝั่งกว้าง (7) เริ่มที่ออเดอร์ล่าสุด · ฝั่งแคบ (5) ข้อมูลติดต่อ/เครดิต */}
          <div className={c("two")}>
            <div className={c("stack")}>
              <Card>
                <CardHead
                  icon={ShoppingCart}
                  tone="blue"
                  title="ออเดอร์ล่าสุด"
                  right={
                    <Link
                      href={`/orders?q=${encodeURIComponent(customer.name)}`}
                      className="inline-flex items-center gap-1 text-xs text-secondary"
                    >
                      ดูทั้งหมด
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
                {customer.orders.length === 0 ? (
                  <CardContent>
                    <p className="text-sm text-muted">ยังไม่มีออเดอร์</p>
                  </CardContent>
                ) : (
                  <DataTable.Root bordered={false} cellPadding="compact">
                    <DataTable.Head>
                      <tr>
                        <DataTable.Th>ออเดอร์</DataTable.Th>
                        <DataTable.Th>สถานะ</DataTable.Th>
                        {canSeeMoney && <DataTable.Th align="right">ยอด</DataTable.Th>}
                        <DataTable.Th>กำหนดส่ง</DataTable.Th>
                      </tr>
                    </DataTable.Head>
                    <DataTable.Body>
                      {customer.orders.map((order) => (
                        <DataTable.Row key={order.id} href={`/orders/${order.id}`}>
                          <DataTable.Td>
                            <Link href={`/orders/${order.id}`} className="font-medium text-strong">
                              {order.orderNumber}
                            </Link>
                            {/* ไม่มีชื่องานแล้ว (เบสสั่ง 2026-08-30) — บรรทัดรองใช้วันที่เปิดงาน
                                ซึ่งเป็นสิ่งที่ช่วยแยกใบของลูกค้ารายเดียวกันได้จริง */}
                            <p className="text-xs text-muted">เปิด {formatDate(order.createdAt)}</p>
                          </DataTable.Td>
                          <DataTable.Td>
                            <OrderStatusBadge
                              customerStatus={order.customerStatus}
                              internalStatus={order.internalStatus}
                            />
                          </DataTable.Td>
                          {canSeeMoney && (
                            <DataTable.Td align="right" className="font-medium tabular-nums text-strong">
                              {formatBaht(order.totalAmount ?? 0)}
                            </DataTable.Td>
                          )}
                          <DataTable.Td className="whitespace-nowrap text-secondary">
                            {order.deadline ? (
                              formatDateShort(order.deadline)
                            ) : (
                              <span className="text-muted">ยังไม่กำหนด</span>
                            )}
                          </DataTable.Td>
                        </DataTable.Row>
                      ))}
                    </DataTable.Body>
                  </DataTable.Root>
                )}
              </Card>

              <Card>
                <CardHead
                  icon={MessageCircle}
                  title="บันทึกการสื่อสาร"
                  right={
                    canEdit ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLoggingComm(true)}
                        className="gap-1.5"
                      >
                        <MessageSquarePlus />
                        บันทึกการคุย
                      </Button>
                    ) : undefined
                  }
                />
                <CardContent>
                  {customer.communicationLogs.length === 0 ? (
                    <p className="text-sm text-muted">ยังไม่มีบันทึก — คุยอะไรกับลูกค้าจดไว้ ทีมอื่นเห็นด้วย</p>
                  ) : (
                    <div className="space-y-3">
                      {customer.communicationLogs.map((log) => (
                        <div key={log.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{commChannelLabel(log.channel)}</Badge>
                            <span className="text-xs text-muted">{formatDateTime(log.createdAt)}</span>
                            <span className="text-xs text-muted">- {log.user.name}</span>
                          </div>
                          {log.subject && <p className="text-sm font-medium mt-1">{log.subject}</p>}
                          <p className="text-sm text-secondary mt-0.5">{log.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className={c("stack")}>
              {/* ต้นแบบรวมช่องทางติดต่อ + ข้อมูลออกบิลไว้ใบเดียว (props one)
                  ของจริงมีมากกว่าต้นแบบ: อีเมล ห้องแชท ที่อยู่ออกใบกำกับภาษี ป้ายกำกับ
                  และคำเตือนบุคคลธรรมดาที่ยังมีข้อมูลภาษี/วงเงินค้าง — คงไว้ทั้งหมด */}
              <Card>
                <CardHead icon={Building2} title="ข้อมูลติดต่อและบิล" />
                <CardContent className="space-y-3">
                  {/* review B7: วงเงิน/เลขภาษีค้างหลังสลับประเภทยังบังคับใช้จริง — ห้ามหายจากจอ */}
                  {customer.customerType !== "CORPORATE" &&
                    (customer.taxId || customer.creditLimit != null || customer.billingAddress) && (
                      <Alert variant="warning" className="text-xs">
                        ลูกค้าเป็นบุคคลธรรมดาแต่มีข้อมูลภาษี/วงเงินค้าง — ยังถูกใช้จริง ถ้าไม่ใช้แล้วกด
                        &quot;แก้ข้อมูล&quot; แล้วลบออก
                      </Alert>
                    )}

                  <dl className={c("props one")}>
                    {customer.phone && (
                      <Prop icon={Phone} label="โทรศัพท์">
                        <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                      </Prop>
                    )}
                    {customer.email && (
                      <Prop icon={Mail} label="อีเมล">
                        <a href={`mailto:${customer.email}`}>{customer.email}</a>
                      </Prop>
                    )}
                    {customer.lineId && (
                      <Prop icon={MessageCircle} label="LINE">
                        <a
                          href={`https://line.me/R/ti/p/~${encodeURIComponent(customer.lineId)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {customer.lineId}
                        </a>
                      </Prop>
                    )}
                    {(customer.chatName || customer.chatUrl) && (
                      <Prop icon={MessageCircle} label="ห้องแชท">
                        <ChatLink name={customer.chatName} url={customer.chatUrl} wrap />
                      </Prop>
                    )}
                    {/* เดิมมีแต่ไอคอนหมุด ไม่มีป้าย — คนอ่านเดาไม่ออกว่านี่ที่อยู่อะไร (ส่งของ? ออกบิล?)
                        ต้องเรียกชื่อเดียวกับฟอร์มที่กรอกค่านี้ = "ที่อยู่ผู้ติดต่อ" (เบสสั่ง 2026-08-12)
                        ต้นแบบเรียก "ที่อยู่ส่งของ" ซึ่งผิด — ที่อยู่ส่งของอยู่บนออเดอร์ */}
                    {customer.address && (
                      <Prop icon={MapPin} label="ที่อยู่ผู้ติดต่อ">
                        {customer.address}
                      </Prop>
                    )}
                    {paymentTermsLabel && (
                      <Prop icon={Wallet} label="เงื่อนไขชำระ">
                        {paymentTermsLabel}
                      </Prop>
                    )}
                    {customer.taxId && (
                      <Prop icon={FileText} label="เลขผู้เสียภาษี">
                        {customer.taxId}
                        {customer.branchNumber && (
                          <small>
                            สาขา {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber}
                          </small>
                        )}
                      </Prop>
                    )}
                    {customer.billingAddress && (
                      <Prop icon={FileText} label="ที่อยู่ออกใบกำกับภาษี">
                        {customer.billingAddress}
                        {customer.billingSubDistrict && ` ${customer.billingSubDistrict}`}
                        {customer.billingDistrict && ` ${customer.billingDistrict}`}
                        {customer.billingProvince && ` ${customer.billingProvince}`}
                        {customer.billingPostalCode && ` ${customer.billingPostalCode}`}
                      </Prop>
                    )}
                    {customer.tags.length > 0 && (
                      <Prop icon={Tag} label="ป้ายกำกับ">
                        <span className="flex flex-wrap gap-1.5">
                          {customer.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </span>
                      </Prop>
                    )}
                    {/* ข้อควรรู้ = ช่องเดียวกับ "ข้อควรรู้" ในฟอร์มแก้ข้อมูล
                        เดิมกรอกได้แต่ไม่มีที่แสดง — พิมพ์ไปแล้วอ่านกลับไม่ได้ */}
                    {customer.notes && (
                      <Prop icon={AlertTriangle} label="ข้อควรรู้">
                        {customer.notes}
                      </Prop>
                    )}
                  </dl>

                  {/* ลูกค้าที่ยังไม่กรอกช่องทางติดต่อเลย — เดิมการ์ดนี้เหลือแต่หัวข้อ ข้างในโล่ง
                      คนอ่านแยกไม่ออกว่า "ยังไม่ได้กรอก" กับ "หน้าโหลดไม่ครบ" */}
                  {!hasContactChannel && (
                    <p className="text-sm text-muted">ยังไม่ได้กรอกช่องทางติดต่อ</p>
                  )}
                </CardContent>
              </Card>

              {/* คลังลายต่อลูกค้า (ก้อน 4 ชิ้น 2) — ลาย + สเปกรีด + สั่งซ้ำ 1 คลิก + ฟิล์มค้าง
                  ต้นแบบวาง "ไฟล์งานของลูกค้า" ไว้ตรงนี้ (คอลัมน์แคบ ถัดจากข้อมูลติดต่อ)
                  ระบบจริงไม่มีคลังไฟล์ต่อลูกค้า — คลังลายทำหน้าที่เดียวกัน จึงยกมาไว้ตำแหน่งนี้ */}
              <CustomerArtworksCard customerId={id} />

              <Card>
                <CardHead icon={CreditCard} title="เครดิตและการสั่งซื้อ" />
                <CardContent className="space-y-3">
                  {creditLoading && (
                    <div
                      role="status"
                      aria-label="กำลังโหลดสถานะเครดิต"
                      className="space-y-3"
                    >
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-4/5" />
                    </div>
                  )}
                  {creditError && (
                    <Alert
                      variant="error"
                      action={
                        <Button type="button" variant="outline" size="sm" onClick={() => void creditQuery.refetch()}>
                          ลองใหม่
                        </Button>
                      }
                    >
                      โหลดสถานะเครดิตไม่สำเร็จ
                    </Alert>
                  )}
                  {canSeeMoney && !creditLoading && !creditError && !credit && (
                    <p className="text-sm text-muted">
                      ยังไม่มีข้อมูลสถานะเครดิต
                    </p>
                  )}
                  {canSeeMoney && credit && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted"><SummaryIcon icon={FileText} tone="finance" /> ค้างชำระ</span>
                      <span
                        className={`text-base font-semibold tabular-nums ${
                          credit.invoiceOutstanding > 0 ? "text-red-600 dark:text-red-400" : ""
                        }`}
                      >
                        {formatBaht(credit.invoiceOutstanding)}
                      </span>
                    </div>
                  )}
                  {canSeeMoney && credit && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted"><SummaryIcon icon={ShoppingCart} tone="production" /> งานยังไม่ปิด</span>
                      <span className="font-semibold tabular-nums">
                        {credit.openOrders > 0 ? `${credit.openOrders} งาน` : "—"}
                      </span>
                    </div>
                  )}
                  {customer.lastOrderAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">สั่งล่าสุด</span>
                      <span className="text-sm">{formatDate(customer.lastOrderAt)}</span>
                    </div>
                  )}
                  {customer.creditLimit != null && (
                    <div className="space-y-1 border-t border-divider pt-3">
                      <div className="flex items-center gap-2 text-sm text-secondary">
                        <SummaryIcon icon={CreditCard} tone="finance" /> วงเงินเครดิต: {formatBaht(customer.creditLimit)}
                      </div>
                      {creditLoading && (
                        <div role="status" aria-label="กำลังโหลดภาระหนี้" className="pl-6 pt-1">
                          <Skeleton className="h-3.5 w-full" />
                        </div>
                      )}
                      {creditError && (
                        <p className="pl-6 text-xs text-red-700 dark:text-red-300">
                          โหลดภาระหนี้ไม่สำเร็จ — ลองใหม่ได้จากปุ่มด้านบน
                        </p>
                      )}
                      {credit && credit.available != null && (
                        <FactList columns={1} className="pt-2">
                          <Fact label="ภาระหนี้รวม" value={formatBaht(credit.exposure)} />
                          <Fact label="งานยังไม่วางบิล" value={formatBaht(credit.unbilled)} />
                          <Fact
                            label={credit.available < 0 ? "เกินวงเงิน" : "วงเงินที่ยังใช้ได้"}
                            value={formatBaht(Math.abs(credit.available))}
                            tone={credit.available < 0 ? "danger" : "default"}
                          />
                        </FactList>
                      )}
                      {canSeeMoney &&
                        !creditLoading &&
                        !creditError &&
                        credit?.available == null && (
                          <p className="pl-6 text-xs text-muted">
                            ยังไม่มีข้อมูลภาระหนี้
                          </p>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {editing && (
            <CustomerEditDialog
              customer={customer}
              canEditCredit={!!me && me.role !== "SALES"}
              onClose={() => setEditing(false)}
            />
          )}
          {loggingComm && (
            <CustomerCommLogDialog
              customerId={id}
              customerName={customer.name}
              onClose={() => setLoggingComm(false)}
            />
          )}
        </>
      ) : null}
    </PageShell>
  );
}
