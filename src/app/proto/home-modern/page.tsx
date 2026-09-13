"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  CheckCheck, ChevronRight, CircleHelp, Clock3, Command,
  Factory, FileText, Home, Layers3, Menu, Moon, Package, PanelLeftClose,
  Plus, Search, Settings2, Shirt, ShoppingBag, Star, Sun, Truck, Users, Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { useProtoVariant } from "../_kit/use-proto-variant";
import { ACTIVITIES, ORDERS, type PreviewOrder } from "./_data";
import s from "./home-modern.module.css";

const money = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const themes = ["light", "dark"] as const;
const filters = ["ทั้งหมด", "กำลังผลิต", "พร้อมส่ง", "ติดดาว"] as const;
type Filter = (typeof filters)[number];
type Popup = "search" | "notifications" | "create" | "help" | null;
const navGroups = [
  { label: "พื้นที่ทำงาน", items: [
    { icon: Home, label: "ภาพรวม", href: "/proto/home-modern", active: true },
    { icon: CheckCheck, label: "งานของฉัน", href: "/my-tasks" },
  ] },
  { label: "จัดการธุรกิจ", items: [
    { icon: ShoppingBag, label: "ออเดอร์", href: "/orders" },
    { icon: FileText, label: "ใบเสนอราคา", href: "/quotations" },
    { icon: Users, label: "ลูกค้า", href: "/customers" },
    { icon: Factory, label: "การผลิต", href: "/production" },
    { icon: Package, label: "สินค้า", href: "/products" },
    { icon: Wallet, label: "การเงิน", href: "/billing" },
  ] },
];
const statusClass = (status: PreviewOrder["status"]) => ({
  "กำลังผลิต": s.statusBlue, "พร้อมส่ง": s.statusGreen,
  "รออนุมัติแบบ": s.statusAmber, "รับออเดอร์": s.statusGray,
})[status];

function ShirtPreview({ order }: { order: PreviewOrder }) {
  return <span className={s.shirtThumb} data-color={order.color} aria-hidden="true"><Shirt /><span>{order.mark}</span></span>;
}

export default function HomeModernPrototype() {
  const [theme, setTheme] = useProtoVariant("theme", themes, "light");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("ทั้งหมด");
  const [stars, setStars] = useState<string[]>([ORDERS[0].id]);
  const [day, setDay] = useState(14);
  const [popup, setPopup] = useState<Popup>(null);
  const [selected, setSelected] = useState<PreviewOrder | null>(null);
  const [search, setSearch] = useState("");
  const [read, setRead] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const orderTable = useRef<HTMLDivElement>(null);
  const dialogOrigin = useRef<HTMLElement | null>(null);
  const switchingDialog = useRef(false);
  const rememberOrigin = () => {
    dialogOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const openPopup = (value: Popup) => {
    rememberOrigin();
    setPopup(value);
  };
  const openOrder = (order: PreviewOrder | null) => {
    if (!popup) rememberOrigin();
    switchingDialog.current = Boolean(popup);
    setPopup(null);
    setSelected(order);
  };
  const restoreFocus = (event: Event) => {
    if (dialogOrigin.current?.isConnected) {
      event.preventDefault();
      dialogOrigin.current.focus();
    }
  };
  const attention = ORDERS.filter(order => order.attention);
  const due = ORDERS.filter(order => order.day === day);
  const filtered = ORDERS.filter(order => filter === "ทั้งหมด" || (filter === "ติดดาว" ? stars.includes(order.id) : order.status === filter));
  const searchResults = ORDERS.filter(order => `${order.id} ${order.customer} ${order.project}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggleStar = (id: string) => setStars(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchButton.current?.focus();
        dialogOrigin.current = searchButton.current;
        setSearch("");
        setSelected(null);
        setPopup(current => current === "search" ? null : "search");
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  return (
    <div className={`${s.prototype} ${collapsed ? s.collapsed : ""} ${mobileOpen ? s.navOpen : ""}`} data-theme={theme}>
      <a href="#preview-main" className={s.skip}>ข้ามไปเนื้อหาหลัก</a>
      <aside className={s.sidebar} id="preview-sidebar" aria-label="เมนูหลัก">
        <Link href="/proto/home-modern" className={s.brand} aria-label="Anajak หน้าแรกต้นแบบ">
          <span className={s.brandMark}><Layers3 /></span>
          <span className={s.brandName}>anajak<span>WORKSPACE</span></span>
        </Link>
        <div className={s.workspaceName}><span className={s.avatar}>A</span><span>Anajak T-Shirt<small>โรงงานสกรีนเสื้อ</small></span></div>
        <nav className={s.nav}>
          {navGroups.map(group => <div key={group.label}>
            <p className={s.navLabel}>{group.label}</p>
            {group.items.map(item => <Link key={item.label} href={item.href} prefetch={false} className={`${s.navItem} ${"active" in item ? s.navActive : ""}`} aria-current={"active" in item ? "page" : undefined} title={collapsed ? item.label : undefined}>
              <item.icon /><span>{item.label}</span>{"active" in item && <span className={s.navCount}><span className={s.activityDot} data-color="blue" /></span>}
            </Link>)}
          </div>)}
        </nav>
        <div className={s.sidebarBottom}>
          <button type="button" className={s.navItem} onClick={() => openPopup("help")} title={collapsed ? "เกี่ยวกับต้นแบบ" : undefined}><CircleHelp /><span>เกี่ยวกับต้นแบบ</span><ArrowUpRight /></button>
          <Link href="/settings" prefetch={false} className={s.navItem} title={collapsed ? "ตั้งค่า" : undefined}><Settings2 /><span>ตั้งค่า</span></Link>
          <div className={s.profile}><span className={s.avatar}>B</span><span className={s.profileText}>เบส<small>เจ้าของกิจการ · ตัวอย่าง</small></span><span className={s.activityDot} data-color="green" /></div>
        </div>
      </aside>
      <div className={s.main}>
        <header className={s.topbar}>
          <button type="button" className={`${s.iconButton} ${s.collapseButton}`} aria-label={collapsed ? "กางเมนู" : "หุบเมนู"} aria-expanded={!collapsed} aria-controls="preview-sidebar" onClick={() => setCollapsed(!collapsed)}><PanelLeftClose /></button>
          <button type="button" className={`${s.iconButton} ${s.mobileMenu}`} aria-label={mobileOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={mobileOpen} aria-controls="preview-sidebar" onClick={() => setMobileOpen(!mobileOpen)}><Menu /></button>
          <div className={s.breadcrumb}><span>Workspace</span><ChevronRight /><strong>ภาพรวม</strong></div>
          <div className={s.topActions}>
            <button ref={searchButton} type="button" className={s.searchButton} onClick={() => { setSearch(""); openPopup("search"); }} aria-label="ค้นหาออเดอร์ตัวอย่าง"><Search /><span>ค้นหาอะไรก็ได้</span><kbd className={s.shortcut}>⌘ K</kbd></button>
            <button type="button" className={s.iconButton} aria-label={theme === "light" ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon /> : <Sun />}</button>
            <button type="button" className={s.iconButton} aria-label={`แจ้งเตือนตัวอย่าง${read ? "" : " 3 รายการใหม่"}`} onClick={() => openPopup("notifications")}><Bell />{!read && <span className={s.notificationDot} />}</button>
          </div>
        </header>
        <main className={s.content} id="preview-main">
          <div className={s.intro}>
            <div><div className={s.eyebrow}><span className={s.activityDot} data-color="blue" />จันทร์ 14 กันยายน 2569</div><h1 className={s.title}>ภาพรวมวันนี้<span>.</span></h1></div>
            <div className={s.introActions}><span className={s.prototypeBadge}>ต้นแบบ · ข้อมูลตัวอย่าง</span><button type="button" className={s.primaryButton} onClick={() => openPopup("create")}><Plus />เปิดงานใหม่</button></div>
          </div>

          <section className={s.metrics} aria-label="ภาพรวมออเดอร์ตัวอย่าง">
            {[
              { label: "ออเดอร์กำลังเดิน", value: ORDERS.length, hint: "ออเดอร์", icon: ShoppingBag },
              { label: "กำหนดส่งวันนี้", value: ORDERS.filter(order => order.day === 14).length, hint: "ออเดอร์", icon: CalendarDays },
              { label: "พร้อมส่งแล้ว", value: ORDERS.filter(order => order.status === "พร้อมส่ง").length, hint: "ออเดอร์", icon: Package },
              { label: "มูลค่าออเดอร์ตัวอย่าง", value: `฿${money(ORDERS.reduce((sum, order) => sum + order.amount, 0))}`, hint: `รวม ${ORDERS.length} ออเดอร์`, icon: Wallet },
            ].map(metric => <div key={metric.label} className={s.metric}><div className={s.metricLabel}><metric.icon />{metric.label}</div><div className={s.metricValue}>{metric.value}<span className={s.metricHint}>{metric.hint}</span></div></div>)}
          </section>

          <div className={s.mainGrid}>
            <section className={`${s.panel} ${s.focusPanel}`} aria-labelledby="focus-title">
              <div className={s.panelHeading}><h2 id="focus-title"><span className={s.headingIcon}><Layers3 /></span>โฟกัสวันนี้ <span className={s.countBadge}>{attention.length}</span></h2><span className={s.eyebrow}>ต้องติดตาม</span></div>
              <div className={s.focusList}>{attention.map((order, index) => <button type="button" key={order.id} className={s.focusRow} onClick={() => openOrder(order)}>
                <span className={s.focusIcon} data-kind={index}>{index === 0 ? <Clock3 /> : index === 1 ? <FileText /> : <Truck />}</span>
                <span className={s.focusText}><strong>{order.customer}</strong><span>{order.attention}</span></span>
                <span className={s.focusMeta}>{order.quantity} ตัว<small>#{order.id.slice(-4)}</small></span><span className={s.focusArrow}><ArrowUpRight /></span>
              </button>)}</div>
              <div className={s.panelFooter}><span><span className={s.activityDot} data-color="blue" />เลือกงานเพื่อดูรายละเอียด</span><ArrowDownRight /></div>
            </section>
            <section className={`${s.panel} ${s.weekPanel}`} aria-labelledby="week-title">
              <div className={s.panelHeading}><h2 id="week-title">กำหนดส่งสัปดาห์นี้</h2><span className={s.weekHeading}>14–20 ก.ย. <CalendarDays /></span></div>
              <div className={s.days} aria-label="เลือกวันส่งงาน">{["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((label, index) => <button type="button" key={index} className={`${s.day} ${day === index + 14 ? s.dayActive : ""}`} aria-label={`${index + 14} กันยายน`} aria-pressed={day === index + 14} onClick={() => setDay(index + 14)}><span>{label}</span><strong>{index + 14}</strong><span className={s.dayDot} data-has-work={ORDERS.some(order => order.day === index + 14)} /></button>)}</div>
              <div className={s.deliveries} aria-live="polite">{due.length ? due.map(order => <button key={order.id} type="button" className={s.delivery} onClick={() => openOrder(order)}><span className={s.deliveryTime}><span className={s.activityDot} data-color={order.status === "พร้อมส่ง" ? "green" : "blue"} /></span><span className={s.deliveryText}><strong>{order.customer}</strong><small>{order.quantity} ตัว · {order.status}</small></span><ArrowUpRight /></button>) : <div className={s.empty}><CalendarDays /><span>ไม่มีงานกำหนดส่งวันนี้</span><button className={s.textButton} type="button" onClick={() => setDay(14)}>กลับมาวันนี้</button></div>}</div>
            </section>
          </div>

          <div className={s.lowerGrid}>
            <section className={`${s.panel} ${s.ordersPanel}`} aria-labelledby="orders-title">
              <div className={s.panelHeading}><h2 id="orders-title">ออเดอร์ที่กำลังเดิน <span className={s.countBadge}>{ORDERS.length}</span></h2><Link prefetch={false} href="/orders" className={s.textButton}>หน้าออเดอร์เดิม <ArrowUpRight /></Link></div>
              <div className={s.orderTools}><div className={s.tabs} aria-label="กรองออเดอร์ตัวอย่าง">{filters.map(value => <button key={value} type="button" className={`${s.tab} ${filter === value ? s.tabActive : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "ติดดาว" && <Star />}{value}</button>)}</div><button type="button" className={s.iconButton} aria-label="ค้นหาในออเดอร์ตัวอย่าง" onClick={() => { setSearch(""); openPopup("search"); }}><Search /></button></div>
              <div className={s.tableScrollHint}><span>ดูคอลัมน์ต่อ</span><button type="button" aria-label="เลื่อนตารางไปซ้าย" onClick={() => orderTable.current?.scrollBy({ left: -230 })}><ArrowLeft /></button><button type="button" aria-label="เลื่อนตารางไปขวา" onClick={() => orderTable.current?.scrollBy({ left: 230 })}><ArrowRight /></button></div>
              <div ref={orderTable} className={s.tableWrap} role="region" aria-label="ตารางออเดอร์ตัวอย่าง เลื่อนได้ในแนวนอน">
                <table className={s.orderTable}><thead className={TABLE_HEAD_SURFACE}><tr><th scope="col">ออเดอร์ / ลูกค้า</th><th scope="col">สถานะ</th><th scope="col">กำหนดส่ง</th><th scope="col"><span className={s.srOnly}>รายการโปรด</span><Star aria-hidden="true" /></th></tr></thead><tbody>{filtered.map(order => <tr key={order.id}>
                  <td><button type="button" className={s.orderCell} onClick={() => openOrder(order)}><ShirtPreview order={order} /><span><strong className={s.orderTitle}>{order.customer}</strong><span className={s.orderNumber}>#{order.id.slice(-4)}<span>·</span>{order.technique}<span>·</span>{order.quantity} ตัว</span></span></button></td>
                  <td><span className={`${s.status} ${statusClass(order.status)}`}><span />{order.status}</span></td>
                  <td><span className={s.dueDate} data-today={order.day === 14}>{order.day === 14 ? "วันนี้" : `${order.day} ก.ย.`}</span></td>
                  <td><button type="button" className={`${s.starButton} ${stars.includes(order.id) ? s.starred : ""}`} aria-label={`${stars.includes(order.id) ? "เลิกติดดาว" : "ติดดาว"} ${order.customer}`} aria-pressed={stars.includes(order.id)} onClick={() => toggleStar(order.id)}><Star /></button></td>
                </tr>)}</tbody></table>
                {!filtered.length && <div className={s.empty}><Star /><span>ยังไม่มีออเดอร์ที่ติดดาว</span><button type="button" className={s.textButton} onClick={() => setFilter("ทั้งหมด")}>ดูออเดอร์ทั้งหมด <ArrowRight /></button></div>}
              </div><div className={s.tableFooter}><span aria-live="polite">{filtered.length} จาก {ORDERS.length} ออเดอร์ตัวอย่าง</span><span>เลือกออเดอร์เพื่อดูรายละเอียด <ArrowUpRight /></span></div>
            </section>
            <aside className={`${s.panel} ${s.activityPanel}`} aria-labelledby="activity-title"><div className={s.panelHeading}><h2 id="activity-title">ความเคลื่อนไหว</h2><span className={s.countBadge}>วันนี้</span></div><div className={s.activityList}>{ACTIVITIES.map(activity => <div key={activity.time} className={s.activity}><span className={s.activityDot} data-color={activity.color} /><div className={s.activityText}><span className={s.activityTime}>{activity.time}</span><p><strong>{activity.person}</strong> {activity.action}</p><button type="button" className={s.textButton} onClick={() => openOrder(ORDERS.find(order => order.id === activity.orderId) ?? null)}>#{activity.orderId.slice(-4)} <ArrowUpRight /></button></div></div>)}</div><div className={s.quickActions}><div className={s.eyebrow}>ไปทำงานต่อ</div><Link prefetch={false} href="/production"><Factory /><span>คิวการผลิต</span><ArrowUpRight /></Link><Link prefetch={false} href="/my-tasks"><CheckCheck /><span>งานของฉัน</span><ArrowUpRight /></Link></div></aside>
          </div>
          <footer className={s.footer}><span>ANAJAK WORKSPACE <span> / </span> HOME EXPLORATION 01</span><span><Command /> K เพื่อค้นหา</span></footer>
        </main>
      </div>

      {selected && <Dialog open onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className={`${s.dialog} ${s.drawer}`} data-theme={theme} onCloseAutoFocus={restoreFocus}><span className={s.dialogEyebrow}>ออเดอร์ตัวอย่าง / {selected.id}</span><DialogTitle className={s.dialogTitle}>{selected.customer}</DialogTitle><DialogDescription className={s.dialogSubtitle}>{selected.project}</DialogDescription><div className={s.detailArtwork} data-color={selected.color}><Shirt /><strong>{selected.mark}</strong><span>{selected.technique} · {selected.quantity} ตัว</span></div><div className={s.dialogFacts}><div><span>สถานะ</span><strong className={`${s.status} ${statusClass(selected.status)}`}>{selected.status}</strong></div><div><span>กำหนดส่ง</span><strong>{selected.day} กันยายน 2569</strong></div><div><span>ผู้ดูแลงาน</span><strong>{selected.owner}</strong></div><div><span>มูลค่าออเดอร์</span><strong>฿{money(selected.amount)}</strong></div></div>{selected.attention && <p className={s.detailAttention}><Clock3 />{selected.attention}</p>}<div className={s.dialogActions}><button className={s.subtleButton} type="button" onClick={() => toggleStar(selected.id)}><Star fill={stars.includes(selected.id) ? "currentColor" : "none"} />{stars.includes(selected.id) ? "ติดดาวแล้ว" : "ติดดาวออเดอร์"}</button><button className={s.primaryButton} type="button" onClick={() => setSelected(null)}>กลับภาพรวม <ArrowRight /></button></div><p className={s.dialogSubtitle}>ข้อมูลตัวอย่างสำหรับดูหน้าตา ไม่มีการบันทึกเข้าระบบ</p></DialogContent></Dialog>}

      {popup && <Dialog open onOpenChange={open => { if (!open) setPopup(null); }}><DialogContent className={s.dialog} data-theme={theme} onCloseAutoFocus={event => {
          if (switchingDialog.current) {
            event.preventDefault();
            switchingDialog.current = false;
          } else restoreFocus(event);
        }}>
        <DialogTitle className={s.dialogTitle}>{popup === "search" ? "ค้นหาออเดอร์ตัวอย่าง" : popup === "notifications" ? "การแจ้งเตือน" : popup === "create" ? "เริ่มงานใหม่" : "หน้าแรก · Modern workspace"}</DialogTitle>
        <DialogDescription className={s.dialogSubtitle}>{popup === "create" ? "เปิดฟอร์มเดิมของระบบ ยังไม่มีการสร้างรายการจนกว่าจะบันทึก" : "ต้นแบบหน้าแรก · ข้อมูลและกิจกรรมทั้งหมดเป็นตัวอย่าง"}</DialogDescription>
        {popup === "search" && <><div className={s.searchInput}><Search /><input aria-label="ค้นหาเลขออเดอร์ ชื่อลูกค้า หรือชื่องาน" placeholder="เลขออเดอร์ ลูกค้า หรือชื่องาน..." value={search} onChange={event => setSearch(event.target.value)} /></div><div className={s.searchResults} aria-live="polite">{searchResults.map(order => <button key={order.id} type="button" className={s.searchResult} onClick={() => { openOrder(order); }}><ShirtPreview order={order} /><span><strong>{order.customer}</strong><small>{order.id} · {order.project}</small></span><ArrowUpRight /></button>)}{!searchResults.length && <div className={s.empty}><Search /><span>ไม่พบออเดอร์ “{search}”</span><button type="button" className={s.textButton} onClick={() => setSearch("")}>ล้างการค้นหา</button></div>}</div></>}
        {popup === "notifications" && <><div className={s.notificationList}>{attention.map(order => <button type="button" key={order.id} className={s.notification} onClick={() => { openOrder(order); }}><span className={s.activityDot} data-color={read ? "gray" : "blue"} /><span><strong>{order.customer}</strong><small>{order.attention}</small></span><ArrowUpRight /></button>)}</div><button type="button" className={s.subtleButton} onClick={() => setRead(true)} disabled={read}><CheckCheck />{read ? "อ่านทั้งหมดแล้ว" : "ทำเครื่องหมายว่าอ่านแล้ว"}</button></>}
        {popup === "create" && <div className={s.quickActions}><Link prefetch={false} href="/orders/new"><ShoppingBag /><span>เปิดออเดอร์ใหม่</span><ArrowUpRight /></Link><Link prefetch={false} href="/quotations/new"><FileText /><span>สร้างใบเสนอราคา</span><ArrowUpRight /></Link></div>}
        {popup === "help" && <><div className={s.dialogFacts}><div><span>ลองใช้งาน</span><strong>ค้นหา · กรอง · ติดดาว · เลือกวัน</strong></div><div><span>การแสดงผล</span><strong>สว่าง / มืด · มือถือ / คอมพิวเตอร์</strong></div></div><Link prefetch={false} href="/" className={s.subtleButton}>เปิดหน้าแรกเดิม <ArrowUpRight /></Link></>}
      </DialogContent></Dialog>}
    </div>
  );
}
