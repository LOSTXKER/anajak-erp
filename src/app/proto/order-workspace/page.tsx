"use client";

import { useState } from "react";
import Link from "next/link";
import { Factory, LayoutDashboard, Moon, Package, Printer, ShoppingCart, Sun, Users, Wallet } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProtoVariant } from "../_kit/use-proto-variant";
import { WORKSPACE_ORDER_TABS, WorkspaceOrder, type WorkspaceScenario } from "./_order";
import { WorkspaceHome } from "./_home";
import styles from "./workspace.module.css";

const SURFACES = ["order", "home"] as const;
const VIEWS = ["new", "current"] as const;
const SCENARIOS = ["ready", "empty", "blocked"] as const;

export default function OrderWorkspacePrototype() {
  const [surface, setSurface] = useProtoVariant("page", SURFACES, "order");
  const [view, setView] = useProtoVariant("view", VIEWS, "new");
  const [scenario, setScenario] = useProtoVariant("case", SCENARIOS, "ready");
  const [, setOrderTab] = useProtoVariant("tab", WORKSPACE_ORDER_TABS, "overview");
  const { resolvedTheme, setTheme } = useTheme();
  const [notice, setNotice] = useState("");
  const openOrder = () => { setSurface("order"); setView("new"); setScenario("ready"); setOrderTab("overview"); setNotice(""); };
  const openHome = () => { setSurface("home"); setNotice(""); };

  return (
    <div className={styles.prototype}>
      <div className={styles.previewBar}>
        <Link href="/proto" className={styles.previewLabel}>ต้นแบบ <span>ข้อมูลจำลอง</span></Link>
        <div className={styles.previewControls}>
          {surface === "order" && <>
            <div className={styles.viewSwitch} role="group" aria-label="เปรียบเทียบหน้าตา">
              <button aria-pressed={view === "current"} onClick={() => setView("current")}>โครงปัจจุบัน</button>
              <button aria-pressed={view === "new"} onClick={() => setView("new")}>แนวใหม่</button>
            </div>
            <Select aria-label="สถานการณ์ตัวอย่าง" size="sm" value={scenario} onChange={(e) => { setScenario(e.target.value as WorkspaceScenario); setNotice(""); }} className="w-36">
              <option value="ready">มีม็อกอัพ</option>
              <option value="empty">ยังไม่มีม็อกอัพ</option>
              <option value="blocked">ขาดไฟล์พิมพ์</option>
            </Select>
          </>}
          <Button variant="ghost" size="icon" aria-label="สลับธีมหน้าลอง" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="hidden dark:block" /><Moon className="dark:hidden" />
          </Button>
        </div>
      </div>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}><span><Printer size={19} /></span>Anajak Print</div>
          <nav aria-label="หน้าที่ทดลองได้">
            <span className={styles.navGroup}>พื้นที่ทำงาน</span>
            <button className={cn(styles.navItem, surface === "home" && styles.navActive)} aria-current={surface === "home" ? "page" : undefined} onClick={openHome}><LayoutDashboard size={18} />หน้าแรก</button>
            <button className={cn(styles.navItem, surface === "order" && styles.navActive)} aria-current={surface === "order" ? "page" : undefined} onClick={openOrder}><ShoppingCart size={18} />ออเดอร์</button>
          </nav>
          <div className={styles.navReference} aria-label="เมนูประกอบหน้าตัวอย่าง">
            <span className={styles.navGroup}>ส่วนอื่นของระบบ</span>
            <span><Users size={18} />ลูกค้า</span>
            <span><Factory size={18} />การผลิต</span>
            <span><Package size={18} />สินค้า</span>
            <span><Wallet size={18} />การเงิน</span>
          </div>
          <div className={styles.sidebarFoot}><span className={styles.avatar}>บ</span><div>เบส<small>เจ้าของ</small></div></div>
        </aside>

        <div className={styles.content}>
          <nav className={styles.mobileNav} aria-label="เลือกหน้าลองบนมือถือ">
            <button aria-current={surface === "home" ? "page" : undefined} onClick={openHome}>หน้าแรก</button>
            <button aria-current={surface === "order" ? "page" : undefined} onClick={openOrder}>ออเดอร์</button>
          </nav>
          <main className={styles.main}>
            {surface === "order"
              ? <WorkspaceOrder key={scenario} variant={view} scenario={scenario} onGoHome={openHome} onNotice={setNotice} />
              : <WorkspaceHome onOpenOrder={openOrder} />}
          </main>
        </div>
      </div>
      {notice && <div className={styles.notice} role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="ปิดผลการทดลอง">ปิด</button></div>}
    </div>
  );
}
