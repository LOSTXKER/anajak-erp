"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, FileImage, ImageOff, Info, Mail, MessageSquareText, Package, Pencil, Plus, Shirt, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import { OrderArtworkCardView } from "@/components/orders/detail/order-artwork-card";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { OrderRevisions } from "@/components/orders/detail/order-revisions";
import { getFlowSteps } from "@/lib/order-status";
import { ORDER_TAB_DEFS, type TabKey } from "@/lib/order-tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PREVIEW_ARTWORK, PREVIEW_FEES, PREVIEW_ITEMS, PREVIEW_ORDER, PREVIEW_ORDER_NUMBER, PREVIEW_PRICING } from "../ui-reset/_order-data";
import { useProtoVariant } from "../_kit/use-proto-variant";
import { WorkspacePriceSummary } from "./_price-summary";
import { WorkspaceMoney } from "./_money";
import { WorkspaceFiles, type WorkspaceSampleFile } from "./_files";
import styles from "./workspace.module.css";

export type WorkspaceScenario = "ready" | "empty" | "blocked";
type Draft = { deadline: string; poNumber: string; shippingAddress: string };
type Detail = { title: string; content: ReactNode };
export const WORKSPACE_ORDER_TABS = ORDER_TAB_DEFS.map(tab => tab.key);
const RAW_FILES: WorkspaceSampleFile[] = [
  { name: "studio-coffee-logo.svg", kind: "image", path: "/proto/ui-reset/studio-coffee-logo.svg" },
  { name: "รายละเอียดงาน.txt", kind: "text" },
];

export function WorkspaceOrder({ variant, scenario, onGoHome, onNotice }: {
  variant: "new" | "current";
  scenario: WorkspaceScenario;
  onGoHome: () => void;
  onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useProtoVariant("tab", WORKSPACE_ORDER_TABS, "overview");
  const [fileTab, setFileTab] = useState("mockup");
  const [addedMockup, setAddedMockup] = useState(false);
  const [printFiles, setPrintFiles] = useState<WorkspaceSampleFile[]>([]);
  const [edit, setEdit] = useState<"info" | "shipping" | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Draft>({ deadline: "2026-09-25", poNumber: PREVIEW_ORDER.poNumber ?? "", shippingAddress: PREVIEW_ORDER.shippingAddress ?? "" });
  const order = { ...PREVIEW_ORDER, ...draft, deadline: draft.deadline + "T08:00:00+07:00" };
  const customer = order.customer!;
  const hasMockup = scenario !== "empty" || addedMockup;
  const openDetail = (title: string, content: ReactNode) => setDetail({ title, content });
  const openFiles = () => { setTab("files"); setFileTab("mockup"); };
  const addMockupExample = () => { setAddedMockup(true); onNotice("เพิ่มม็อกอัพตัวอย่างแล้ว"); };
  const addPrintExample = () => { setPrintFiles([{ name: "studio-coffee-print.svg", kind: "image", path: "/proto/ui-reset/studio-coffee-logo.svg" }]); onNotice("เพิ่มไฟล์พิมพ์ตัวอย่างแล้ว"); };
  const openContact = () => openDetail("ข้อมูลติดต่อ", <dl className={styles.detailRows}>
    <div><dt>ผู้ติดต่อ</dt><dd>{customer.name}</dd></div>
    <div><dt>โทรศัพท์</dt><dd>{customer.phone}</dd></div>
    <div><dt>อีเมล</dt><dd>{customer.email}</dd></div>
    <div><dt>LINE ID</dt><dd>{customer.lineId}</dd></div>
  </dl>);
  const openCustomer = () => openDetail("ข้อมูลลูกค้า", <div className="space-y-5">
    <div><p className="font-semibold">{customer.company}</p><p className="mt-1 text-sm text-secondary">{customer.address}</p></div>
    <dl className={styles.detailRows}>
      <div><dt>ชำระสะสม</dt><dd>{formatCurrency(customer.totalSpent ?? 0)}</dd></div>
      <div><dt>สั่งมาแล้ว</dt><dd>{customer.totalOrders} ครั้ง</dd></div>
      <div><dt>วงเงินเครดิต</dt><dd>{formatCurrency(customer.creditLimit ?? 0)}</dd></div>
      <div><dt>เงื่อนไขประจำ</dt><dd>เครดิต 30 วัน</dd></div>
      <div><dt>เลขภาษี</dt><dd>{customer.taxId}</dd></div>
    </dl>
    <p className="text-sm text-secondary">{customer.notes}</p>
  </div>);
  const openFile = (file: WorkspaceSampleFile) => openDetail(file.name, file.path
    ? <Image src={file.path} width={500} height={500} alt={file.name} className="max-h-[60vh] w-full rounded-lg bg-surface object-contain" />
    : <p className="text-sm leading-7">{order.description}</p>);
  const interceptSampleLinks = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
    if (anchor.getAttribute("href") === order.brandProfile?.logoUrl) openFile(RAW_FILES[0]);
    else openContact();
  };

  const artwork = <section className={styles.artworkPane} aria-label="พื้นที่ม็อกอัพและไฟล์">
    <div className={styles.sectionHeading}><h2><Shirt size={18} />ม็อกอัพและไฟล์</h2>{hasMockup && <Badge variant="warning" size="sm">รอลูกค้าตรวจ</Badge>}</div>
    <Tabs value={fileTab} onValueChange={setFileTab}>
      <TabsBar className="static mx-0 border-0 bg-transparent"><TabsList aria-label="ชนิดไฟล์ตัวอย่าง" className="gap-4">
        <TabsTrigger value="mockup">ม็อกอัพ</TabsTrigger>
        <TabsTrigger value="raw">ต้นฉบับ <span className={styles.fileCount}>{RAW_FILES.length}</span></TabsTrigger>
        <TabsTrigger value="print">ไฟล์พิมพ์{printFiles.length > 0 && <span className={styles.fileCount}>{printFiles.length}</span>}</TabsTrigger>
      </TabsList></TabsBar>
      <TabsContent value="mockup" className="mt-4">
        {hasMockup ? <>
          <div className={styles.mockupCanvas}>
            <span className={styles.version}>v2</span>
            <MockupGallery version={PREVIEW_ARTWORK} versionNumber={2} className={styles.mockupGallery} />
          </div>
          <div className={styles.mockupCaption}><span>{formatDate(PREVIEW_ARTWORK.createdAt)}</span></div>
        </> : <div className={styles.emptyCanvas}>
          <ImageOff size={36} strokeWidth={1.3} />
          <p>ยังไม่มีม็อกอัพ</p>
          <Button variant="outline" size="sm" onClick={addMockupExample}><Plus />ลองเพิ่มม็อกอัพ</Button>
        </div>}
      </TabsContent>
      <TabsContent value="raw" className="mt-4">
        <div className={styles.fileList}>{RAW_FILES.map(file => <button key={file.name} onClick={() => openFile(file)}><FileImage size={22} /><span>{file.name}<small>{file.kind === "image" ? "SVG" : "ข้อความจากลูกค้า"}</small></span><ArrowRight size={16} /></button>)}</div>
      </TabsContent>
      <TabsContent value="print" className="mt-4">
        {printFiles.length ? <div className={styles.fileList}>{printFiles.map(file => <button key={file.name} onClick={() => openFile(file)}><FileImage size={22} /><span>{file.name}<small>ไฟล์ตัวอย่าง</small></span><ArrowRight size={16} /></button>)}</div>
          : <div className={styles.emptyCanvas}><FileImage size={34} strokeWidth={1.3} /><p>ยังไม่มีไฟล์พิมพ์</p><Button variant="outline" size="sm" onClick={addPrintExample}><Plus />เพิ่มไฟล์ตัวอย่าง</Button></div>}
      </TabsContent>
    </Tabs>
    <div className={styles.brief}>
      <h3><MessageSquareText size={16} />รายละเอียดงาน</h3>
      <p>{order.description}</p>
      <div className={styles.brandLine}><span className={styles.colorDot} style={{ backgroundColor: "#173047" }} /><span className={styles.colorDot} style={{ backgroundColor: "#F2E5CB" }} /><span>Studio Coffee</span><Button variant="ghost" size="sm" onClick={() => openFile(RAW_FILES[0])}>ไฟล์โลโก้<ArrowRight /></Button></div>
    </div>
  </section>;

  const overview = <div className={styles.orderBoard}>
    <section className={styles.recordPane} aria-label="ข้อมูลออเดอร์">
      <div className={styles.sectionHeading}><h2><Info size={18} />ข้อมูลออเดอร์</h2><Button variant="ghost" size="sm" onClick={() => setEdit("info")}><Pencil />แก้ไข</Button></div>
      <dl className={styles.keyFacts}>
        <div><dt><CalendarDays size={15} />กำหนดส่ง</dt><dd className={styles.dateValue}>{formatDate(order.deadline)}</dd><Badge variant="warning" size="sm">สูง</Badge></div>
        <div><dt><Package size={15} />จำนวน</dt><dd>30 <small>ตัว</small></dd></div>
        <div><dt>ยอดรวม</dt><dd><button onClick={() => setTab("money")} aria-label="ดูเงินและบิล ยอดรวม 5,992 บาท">{formatCurrency(5992)}<ArrowRight size={17} /></button></dd></div>
      </dl>
      <dl className={styles.orderMeta}>
        <div><dt>ประเภทงาน</dt><dd>สั่งทำ</dd></div>
        <div><dt>ช่องทาง</dt><dd><span className={styles.lineMark} />LINE</dd></div>
        <div><dt>เลขที่ PO</dt><dd className="font-mono">{draft.poNumber || "—"}</dd></div>
        <div><dt>เงื่อนไขชำระ</dt><dd>มัดจำ 50%<small>ประจำลูกค้า: เครดิต 30 วัน</small></dd></div>
      </dl>

      <div className={styles.customerBlock}>
        <div className={styles.customerHeading}><span className={styles.customerAvatar}>ฟ</span><div><h3>{customer.name}</h3><p>{customer.company}</p></div><Button variant="ghost" size="icon" aria-label="เปิดข้อมูลลูกค้า" onClick={openCustomer}><ArrowRight /></Button></div>
        <div className={styles.contactStrip}><button onClick={openContact}><MessageSquareText size={15} />ข้อมูลติดต่อ</button><button onClick={openContact}>{customer.phone}</button><button aria-label="ดูอีเมลลูกค้า" onClick={openContact}><Mail size={17} /></button></div>
        <div className={styles.customerMeta}><span>เลขภาษี <b>{customer.taxId}</b></span><span>{customer.tags.map(tag => <Badge key={tag} size="sm">{tag}</Badge>)}</span></div>
        <p className={styles.customerNote}>{customer.notes}</p>
      </div>

      <div className={styles.shippingBlock}>
        <div className={styles.sectionHeading}><h3><Truck size={18} />การจัดส่ง</h3><Button variant="ghost" size="sm" aria-label="แก้ไขที่อยู่จัดส่ง" onClick={() => setEdit("shipping")}><Pencil />แก้ไข</Button></div>
        <p className="font-medium">{order.shippingRecipientName}</p>
        <p>{draft.shippingAddress}<br />บางจาก พระโขนง กรุงเทพมหานคร 10260</p>
        <span className={styles.shippingPhone}>{order.shippingPhone}</span>
      </div>
    </section>
    {artwork}
  </div>;

  const currentOverview = <div onClickCapture={interceptSampleLinks} onAuxClickCapture={interceptSampleLinks}>
    <OrderOverviewTab order={order} showMoney totalAmount={5992} totalQuantity={30} onEditInfo={setEdit} onOpenMoney={() => setTab("money")} onOpenDelivery={() => setTab("delivery")} onOpenCustomer={openCustomer} channelColor={{ bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300" }} isMarketplace={false}
      artwork={<OrderArtworkCardView latest={hasMockup ? PREVIEW_ARTWORK : null} versionCount={hasMockup ? 2 : 0} rawCount={RAW_FILES.length} printCount={printFiles.length} description={order.description} onOpenFiles={openFiles} />} />
  </div>;

  return (
    <div className={styles.orderPage}>
      {scenario === "blocked" && printFiles.length === 0 && <div className={styles.problemBanner}><FileImage size={18} /><span>ยังไม่มีไฟล์พิมพ์พร้อมผลิต</span><Button variant="ghost" size="sm" onClick={() => { setTab("files"); setFileTab("print"); }}>เปิดไฟล์พิมพ์<ArrowRight /></Button></div>}
      <div className={styles.orderNote}><ClipboardList size={16} /><span>{order.notes}</span></div>
      <header className={styles.orderHeader}>
        <div className={styles.orderIdentity}><Button variant="ghost" size="icon" aria-label="กลับหน้าแรกของต้นแบบ" onClick={onGoHome}><ArrowLeft /></Button><div><div className={styles.orderNumber}><h1>{PREVIEW_ORDER_NUMBER}</h1><Badge variant="accent" size="sm">กำลังเตรียมงาน</Badge></div><p>Studio Coffee <span>·</span> {customer.name}</p></div></div>
        <div className={styles.orderActions}><Button variant="outline" size="sm" onClick={() => openDetail("ใบสั่งงานตัวอย่าง", <div className="space-y-4"><h3 className="font-semibold">{PREVIEW_ORDER_NUMBER}</h3><p>{order.description}</p><dl className={styles.detailRows}><div><dt>จำนวน</dt><dd>30 ตัว</dd></div><div><dt>กำหนดส่ง</dt><dd>{formatDate(order.deadline)}</dd></div></dl><p className="text-sm text-secondary">{order.notes}</p></div>)}><ClipboardList />ใบสั่งงาน</Button><Button size="sm" onClick={openFiles}>ไปส่วนงานออกแบบ<ArrowRight /></Button></div>
      </header>
      <div className={styles.rail}><OrderStatusBar flowSteps={getFlowSteps("CUSTOM")} currentStepIndex={2} internalStatus="DESIGNING" customerStatus="PREPARING" /></div>
      <Tabs value={tab} onValueChange={value => setTab(value as TabKey)}>
        <TabsBar className="static mx-0 border-0 bg-transparent"><TabsList aria-label="ส่วนของออเดอร์ต้นแบบ">{ORDER_TAB_DEFS.map(item => <TabsTrigger key={item.key} value={item.key}>{item.label}</TabsTrigger>)}</TabsList></TabsBar>
        <TabsContent value="overview" className="pt-5">{variant === "current" ? currentOverview : overview}</TabsContent>
        <TabsContent value="files" className="pt-5"><WorkspaceFiles activeGroup={fileTab} onGroupChange={setFileTab} hasMockup={hasMockup} rawFiles={RAW_FILES} printFiles={printFiles} onAddMockup={addMockupExample} onAddPrintFile={addPrintExample} onPreviewFile={openFile} /></TabsContent>
        <TabsContent value="items" className="pt-5"><OrderItemsDisplay orderId={order.id} items={PREVIEW_ITEMS} fees={PREVIEW_FEES} showMoney canEditReceiveTracking={false} totals={{ discount: 0, taxRate: 7, taxAmount: PREVIEW_PRICING.taxAmount, totalAmount: PREVIEW_PRICING.grandTotal }} priceSummary={variant === "new" ? <WorkspacePriceSummary onOpenMoney={() => setTab("money")} /> : undefined} /></TabsContent>
        <TabsContent value="money" keepMounted className="pt-5"><WorkspaceMoney onOpenItems={() => setTab("items")} poNumber={draft.poNumber} /></TabsContent>
        <TabsContent value="production" className="pt-5"><div className={styles.flowEmpty}><Package size={32} /><h2>รอลูกค้าอนุมัติแบบ</h2><Button variant="outline" onClick={openFiles}>ดูม็อกอัพ<ArrowRight /></Button></div></TabsContent>
        <TabsContent value="delivery" className="pt-5"><div className={styles.flowEmpty}><Truck size={32} /><h2>ยังไม่ถึงขั้นจัดส่ง</h2><Button variant="outline" onClick={() => setTab("production")}>ดูงานผลิต<ArrowRight /></Button></div></TabsContent>
        <TabsContent value="history" className="pt-5"><OrderRevisions revisions={[...(hasMockup ? [{ id: "prototype-revision-2", description: "ส่งม็อกอัพ v2 ให้ลูกค้าตรวจ", changedBy: "ดีไซเนอร์", changeType: "DESIGN", createdAt: PREVIEW_ARTWORK.createdAt }] : []), { id: "prototype-revision-1", description: "เปิดออเดอร์ 30 ตัว", changedBy: "ฝ่ายขาย", changeType: "INFO", createdAt: order.createdAt }]} /></TabsContent>
      </Tabs>
      <footer className={styles.orderFooter}><span>เปิดโดย ฝ่ายขาย</span><span>10 ก.ย. 2569</span><span>{PREVIEW_ORDER_NUMBER}</span></footer>
      {edit && <EditDialog section={edit} initial={draft} onClose={() => setEdit(null)} onSave={next => { setDraft(next); setEdit(null); onNotice("บันทึกข้อมูลตัวอย่างแล้ว"); }} />}
      {detail && <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent><DialogTitle>{detail.title}</DialogTitle>{detail.content}</DialogContent></Dialog>}
    </div>
  );
}

function EditDialog({ section, initial, onClose, onSave }: { section: "info" | "shipping"; initial: Draft; onClose: () => void; onSave: (draft: Draft) => void }) {
  const [draft, setDraft] = useState(initial);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogTitle>{section === "info" ? "แก้ไขข้อมูลออเดอร์" : "แก้ไขที่อยู่จัดส่ง"}</DialogTitle>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); onSave(draft); }}>
      {section === "info" ? <>
        <label className={styles.formField} htmlFor="prototype-deadline">กำหนดส่ง<Input id="prototype-deadline" type="date" required value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })} /></label>
        <label className={styles.formField} htmlFor="prototype-po">เลขที่ PO<Input id="prototype-po" value={draft.poNumber} onChange={e => setDraft({ ...draft, poNumber: e.target.value })} /></label>
      </> : <label className={styles.formField} htmlFor="prototype-address">ที่อยู่จัดส่ง<Input id="prototype-address" required value={draft.shippingAddress} onChange={e => setDraft({ ...draft, shippingAddress: e.target.value })} /></label>}
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button><Button type="submit">บันทึกตัวอย่าง</Button></div>
    </form>
  </DialogContent></Dialog>;
}
