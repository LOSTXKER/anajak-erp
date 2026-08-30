"use client";

/**
 * C · ลายคือหน้าปก — "ภาพรวมคือหน้าปกของงาน ไม่ใช่แฟ้มข้อมูล"
 *
 * โครงคิดจากลำดับที่คนใช้จริงถาม: ① ส่งเมื่อไหร่/กี่ตัว/เท่าไร (แถบบนสุด ไม่มีการ์ด)
 * ② หน้าตางานเป็นยังไง (ลายเต็มแถว) ③ รายละเอียดที่เหลือ (ยุบเป็นแถวป้าย-ค่าตัวเล็ก
 * สามคอลัมน์)
 *
 * ทุกช่องที่ของจริงมี **ยังอยู่ครบ** — ไม่มีอันไหนถูกตัดทิ้ง แค่เปลี่ยนจาก "ช่องใหญ่
 * ในการ์ด" เป็น "แถวเล็กในตาราง" ซึ่งเป็นข้อแลกของแบบนี้: กระชับสุดแต่ตาต้องทำงานหนักขึ้น
 */

import Link from "next/link";
import { ArrowRight, Shirt } from "lucide-react";

import { ChatLink } from "@/components/customers/chat-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { DISPLAY_AMOUNT, FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import {
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

import { demoOrder, demoTotals } from "../../order-detail/_data";
import { demoMockups, demoPrintFiles, demoRawFiles } from "../_artwork";
import {
  FileRow,
  MockupStatusBadge,
  NoMockupNote,
  PhoneLink,
  areaLine,
} from "../_ui";

/** แถวป้ายซ้าย-ค่าขวา — หน่วยพื้นฐานของแบบนี้ (ค่าว่างไม่สร้างแถว เหมือนของจริง) */
function Row({
  label,
  children,
  tone,
}: {
  label: string;
  children?: React.ReactNode;
  tone?: "warn";
}) {
  const filled =
    children !== null && children !== undefined && children !== false && children !== "";
  if (!filled) return null;
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-28 shrink-0 text-xs text-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 flex-1 text-sm [overflow-wrap:anywhere]",
          tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-strong",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 border-b border-divider pb-1.5">
        <h3 className="text-xs font-semibold text-muted">{title}</h3>
        {action}
      </div>
      <dl className="divide-y divide-divider/60">{children}</dl>
    </div>
  );
}

export function CoverVariant({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const customer = order.customer;
  const mockups = demoMockups(thin);
  const latest = mockups[0];
  const rawFiles = demoRawFiles(thin);
  const printFiles = demoPrintFiles(thin);

  const termsLabel = order.paymentTerms
    ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms)
    : null;
  const customerTerms = customer?.defaultPaymentTerms ?? null;
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms
    ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms)
    : null;

  const shippingArea = areaLine([
    order.shippingSubDistrict,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]);
  const billingArea = areaLine([
    customer?.billingSubDistrict ?? null,
    customer?.billingDistrict ?? null,
    customer?.billingProvince ?? null,
    customer?.billingPostalCode ?? null,
  ]);
  const hasBilling = Boolean(customer?.billingAddress || billingArea);
  const hasPricedWork = totals.totalAmount !== 0 || totals.totalQuantity > 0;

  return (
    <div className="space-y-6">
      {/* ① แถบข้อเท็จจริง — ไม่มีการ์ด ไม่มีหัวข้อ อ่านจบในบรรทัดเดียว */}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted">กำหนดส่ง</dt>
          <dd className="text-lg font-semibold text-strong">
            {order.deadline ? (
              formatDate(order.deadline)
            ) : (
              <span className="text-base text-amber-700 dark:text-amber-300">
                ยังไม่กำหนดส่ง
              </span>
            )}
            <span className="mt-1 block text-xs font-normal text-muted">
              ความเร่งด่วน{" "}
              <Badge
                variant={
                  order.priority === "URGENT"
                    ? "destructive"
                    : order.priority === "HIGH"
                      ? "warning"
                      : "default"
                }
                size="sm"
              >
                {PRIORITY_LABELS[order.priority] ?? order.priority}
              </Badge>
            </span>
          </dd>
        </div>

        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted">จำนวนรวม</dt>
          <dd className="text-lg font-semibold text-strong">
            {totals.totalQuantity > 0 ? (
              `${totals.totalQuantity.toLocaleString()} ชิ้น`
            ) : order.estimatedQuantity ? (
              `~${order.estimatedQuantity.toLocaleString()} ชิ้น`
            ) : (
              <span className="text-base text-muted">ยังไม่มีรายการ</span>
            )}
          </dd>
        </div>

        {showMoney && (
          <div className="min-w-0 space-y-1">
            <dt className="text-xs font-medium text-muted">ยอดรวม</dt>
            <dd className={hasPricedWork ? DISPLAY_AMOUNT : "text-base font-medium text-muted"}>
              {hasPricedWork ? formatCurrency(totals.totalAmount) : "ยังไม่ตีราคา"}
            </dd>
          </div>
        )}

        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted">ลูกค้า</dt>
          <dd className="min-w-0 text-sm font-semibold text-strong [overflow-wrap:anywhere]">
            {customer ? (
              <>
                <Link
                  href={`/customers/${customer.id}`}
                  className={cn("hover:underline", FOCUS_BUTTON)}
                >
                  {customer.name}
                </Link>
                {customer.company && (
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {customer.company}
                  </span>
                )}
              </>
            ) : (
              <span className="font-normal text-muted">ยังไม่ผูกลูกค้า</span>
            )}
          </dd>
        </div>

        <div className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted">สถานะแบบ</dt>
          <dd className="text-sm font-semibold text-strong">
            {latest ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <MockupStatusBadge version={latest} />
                <span className="text-xs font-normal text-muted">
                  v{latest.versionNumber}
                  {mockups.length > 1 && ` · แก้ ${mockups.length - 1} รอบ`}
                </span>
              </span>
            ) : (
              <span className="text-sm font-normal text-muted">ยังไม่มีม็อกอัพ</span>
            )}
          </dd>
        </div>
      </dl>

      {/* ② ลาย — พระเอกของหน้า */}
      <div className={cn("p-4", SUNK_PANEL, RADIUS.surface)}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Shirt className="h-3.5 w-3.5" aria-hidden="true" />
                ลายงาน
                {latest && (
                  <span className="font-normal">
                    · ม็อกอัพ v{latest.versionNumber}
                    {latest.approvedAt
                      ? ` · ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                      : ` · ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
                  </span>
                )}
              </p>
              <Button variant="ghost" size="sm">
                ม็อกอัพ &amp; ไฟล์
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {latest ? (
              <MockupGallery version={latest} versionNumber={latest.versionNumber} />
            ) : (
              <NoMockupNote rawCount={rawFiles.length} />
            )}
          </div>

          <div className="min-w-0 space-y-4">
            {order.description?.trim() ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">รายละเอียดงาน</p>
                <p className="text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
                  {order.description}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">รายละเอียดงาน</p>
                <p className="text-sm text-muted">ยังไม่มีรายละเอียดงาน</p>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted">ไฟล์ของงานนี้</p>
              {rawFiles.length + printFiles.length > 0 ? (
                <ul className="divide-y divide-divider">
                  {rawFiles.map((file) => (
                    <FileRow key={file.id} file={file} />
                  ))}
                  {printFiles.map((file) => (
                    <FileRow key={file.id} file={file} locked />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">ยังไม่มีไฟล์แนบ</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ③ ข้อมูลที่เหลือ — ครบทุกช่อง แต่เป็นแถวเล็ก */}
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        <Block
          title="ลูกค้าและผู้ติดต่อ"
          action={
            customer ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/customers/${customer.id}`}>เปิดหน้าลูกค้า</Link>
              </Button>
            ) : undefined
          }
        >
          {customer ? (
            <>
              <Row label="ประเภท">
                {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา"}
              </Row>
              <Row
                label="เลขผู้เสียภาษี"
                tone={customer.taxId ? undefined : "warn"}
              >
                {customer.taxId ? (
                  <span className="font-mono">
                    {customer.taxId}
                    {customer.branchNumber && (
                      <span className="ml-1.5 font-sans text-xs text-muted">
                        (สาขา
                        {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber})
                      </span>
                    )}
                  </span>
                ) : (
                  "ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้"
                )}
              </Row>
              <Row label="โทรศัพท์">
                {customer.phone && <PhoneLink phone={customer.phone} />}
              </Row>
              <Row label="ห้องแชท">
                {(customer.chatName || customer.chatUrl) && (
                  <ChatLink
                    name={customer.chatName}
                    url={customer.chatUrl}
                    wrap
                    className="min-h-11 min-w-11 text-sm"
                  />
                )}
              </Row>
              <Row label="LINE ID">{customer.lineId}</Row>
              <Row label="อีเมล">{customer.email}</Row>
              <Row label="ที่อยู่ลูกค้า">{customer.address}</Row>
              <Row label="ที่อยู่ออกบิล">
                {hasBilling ? (
                  <span className="block space-y-0.5">
                    {customer.billingAddress && <span className="block">{customer.billingAddress}</span>}
                    {billingArea && <span className="block">{billingArea}</span>}
                  </span>
                ) : customer.address ? (
                  "ใช้ที่อยู่ลูกค้า"
                ) : undefined}
              </Row>
              <Row label="ป้ายลูกค้า">
                {customer.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {customer.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        size="sm"
                        className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </Row>
              <Row label="หมายเหตุลูกค้า">{customer.notes}</Row>
              {showMoney && (
                <>
                  <Row label="วงเงินเครดิต">
                    {customer.creditLimit != null && (
                      <span className="tabular-nums">{formatCurrency(customer.creditLimit)}</span>
                    )}
                  </Row>
                  <Row label="ยอดซื้อสะสม">
                    {customer.totalSpent != null && (
                      <span className="tabular-nums">{formatCurrency(customer.totalSpent)}</span>
                    )}
                  </Row>
                </>
              )}
              <Row label="สั่งมาแล้ว">
                {customer.totalOrders > 0 && `${customer.totalOrders.toLocaleString()} ครั้ง`}
              </Row>
              <Row label="สั่งล่าสุด">
                {customer.lastOrderAt && formatDate(customer.lastOrderAt)}
              </Row>
            </>
          ) : (
            <p className="py-2 text-sm text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
          )}
        </Block>

        <Block
          title="ข้อมูลออเดอร์"
          action={<Button variant="ghost" size="sm">แก้ไข</Button>}
        >
          <Row label="ประเภทงาน">
            <Badge variant={order.orderType === "CUSTOM" ? "accent" : "default"} size="sm">
              {ORDER_TYPE_UI_LABELS[order.orderType]}
            </Badge>
          </Row>
          <Row label="ช่องทาง">{CHANNEL_LABELS[order.channel] ?? order.channel}</Row>
          <Row label="สถานะที่ลูกค้าเห็น">
            <Badge variant="default" size="sm">
              {CUSTOMER_STATUS_LABELS[order.customerStatus] ?? order.customerStatus}
            </Badge>
          </Row>
          <Row label="เงื่อนไขชำระ">
            {termsLabel && (
              <span>
                {termsLabel}
                {termsDiffers && (
                  <span className="mt-0.5 block text-xs text-muted">
                    มาตรฐานลูกค้า: {customerTermsLabel}
                  </span>
                )}
              </span>
            )}
          </Row>
          <Row label="เลขที่ PO">
            {order.poNumber && <span className="font-mono">{order.poNumber}</span>}
          </Row>
          <Row label="หมายเลขภายนอก">
            {order.externalOrderId && <span className="font-mono">{order.externalOrderId}</span>}
          </Row>
          <Row label="จองสต๊อกแล้ว">
            {order.stockReservedAt && formatDateTime(order.stockReservedAt)}
          </Row>
          <Row label="เปิดโดย">{order.createdBy.name}</Row>
          <Row label="เปิดเมื่อ">{formatDateTime(order.createdAt)}</Row>
          <Row label="ยืนยันเมื่อ">
            {order.confirmedAt && formatDateTime(order.confirmedAt)}
          </Row>
          <Row label="แก้ล่าสุด">{formatDateTime(order.updatedAt)}</Row>
        </Block>

        <div className="min-w-0 space-y-6">
          <Block
            title="การจัดส่ง"
            action={
              <Button variant="ghost" size="sm">
                {order.shippingRecipientName ? "แก้ไข" : "เพิ่มที่อยู่"}
              </Button>
            }
          >
            <Row label="ผู้รับ">{order.shippingRecipientName}</Row>
            <Row label="เบอร์ผู้รับ">
              {order.shippingPhone && <PhoneLink phone={order.shippingPhone} />}
            </Row>
            <Row
              label="ที่อยู่จัดส่ง"
              tone={order.shippingAddress || shippingArea ? undefined : "warn"}
            >
              {order.shippingAddress || shippingArea ? (
                <span className="block space-y-0.5">
                  {order.shippingAddress && <span className="block">{order.shippingAddress}</span>}
                  {shippingArea && <span className="block">{shippingArea}</span>}
                </span>
              ) : (
                "ยังไม่มีที่อยู่จัดส่ง"
              )}
            </Row>
            <Row label="เลขพัสดุ">
              {order.trackingNumber && (
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">{order.trackingNumber}</span>
                  <Button variant="ghost" size="sm">
                    ดูการจัดส่ง
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </span>
              )}
            </Row>
          </Block>

          {order.brandProfile && (
            <Block title="แบรนด์ลูกค้า">
              <Row label="ชื่อแบรนด์">{order.brandProfile.brandName}</Row>
              <Row label="โลโก้">
                {order.brandProfile.logoUrl && (
                  <a
                    href={order.brandProfile.logoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
                      FOCUS_BUTTON,
                    )}
                  >
                    เปิดไฟล์โลโก้
                  </a>
                )}
              </Row>
              <Row label="โค้ดสี">
                {order.brandProfile.colorCodes.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {order.brandProfile.colorCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-secondary dark:bg-slate-800"
                      >
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-300 dark:ring-white/20"
                          style={{ backgroundColor: code }}
                        />
                        {code}
                      </span>
                    ))}
                  </span>
                )}
              </Row>
              <Row label="ฟอนต์">
                {order.brandProfile.fonts.length > 0 && order.brandProfile.fonts.join(" · ")}
              </Row>
              <Row label="โน้ตสไตล์">{order.brandProfile.styleNotes}</Row>
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}
