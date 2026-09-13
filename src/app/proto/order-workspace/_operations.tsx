"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, CalendarDays, ClipboardList, FileImage, ImageOff, MapPin, Package, PackageOpen, Pencil, Phone, Shirt, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { PREVIEW_ITEMS, PREVIEW_ORDER, PREVIEW_ORDER_NUMBER } from "../ui-reset/_order-data";
import styles from "./_operations.module.css";

const sampleItem = PREVIEW_ITEMS[0];
const sampleProduct = sampleItem.products[0];
const samplePrint = sampleItem.prints[0];
const sampleSizes = sampleProduct.variants;
const totalQuantity = PREVIEW_ITEMS.reduce((total, item) => total + item.products.reduce((sum, product) => sum + product.variants.reduce((count, variant) => count + variant.quantity, 0), 0), 0);
const shippingLocality = [PREVIEW_ORDER.shippingSubDistrict, PREVIEW_ORDER.shippingDistrict, PREVIEW_ORDER.shippingProvince, PREVIEW_ORDER.shippingPostalCode].filter(Boolean).join(" ");

function SizeAllocation({ label }: { label: string }) {
  return <table className={styles.sizeTable}>
    <caption className="sr-only">{label}</caption>
    <thead><tr><th scope="col">ไซซ์</th>{sampleSizes.map(size => <th key={size.id} scope="col">{size.size}</th>)}<th scope="col">รวม</th></tr></thead>
    <tbody><tr><th scope="row">จำนวนตัว</th>{sampleSizes.map(size => <td key={size.id}>{size.quantity}</td>)}<td className={styles.quantityTotal}>{totalQuantity}</td></tr></tbody>
  </table>;
}

export function WorkspaceProduction({ hasMockup, printFileCount, deadline, onOpenMockup, onOpenPrintFiles, onOpenItems, onOpenWorkOrder }: {
  hasMockup: boolean;
  printFileCount: number;
  deadline: string;
  onOpenMockup: () => void;
  onOpenPrintFiles: () => void;
  onOpenItems: () => void;
  onOpenWorkOrder: () => void;
}) {
  return <section className={styles.workspace} aria-label="งานผลิตตัวอย่าง">
    <header className={styles.heading}>
      <div><Shirt size={19} /><h2>งานผลิต</h2><Badge size="sm">ยังไม่เปิดใบผลิต</Badge></div>
      <span className={styles.deadline}><CalendarDays size={15} />กำหนดส่ง <strong>{formatDate(deadline)}</strong></span>
    </header>

    <div className={styles.productionColumns}>
      <section className={styles.workBrief} aria-labelledby="workspace-production-brief">
        <div className={styles.productHeading}>
          <div className={styles.productThumbnail}>{hasMockup ? <Image src="/proto/ui-reset/studio-coffee-shirt.svg" width={112} height={112} alt="เสื้อสีกรม โลโก้ Studio Coffee สีครีมที่อกซ้าย" /> : <Shirt size={34} strokeWidth={1.25} aria-hidden="true" />}</div>
          <div><h3 id="workspace-production-brief">{sampleItem.description}</h3><p>{sampleProduct.description}</p><span className={styles.source}><span aria-hidden="true" />จากสต๊อก</span></div>
          <span className={styles.quantity}>{totalQuantity}<small>ตัว</small></span>
        </div>
        <SizeAllocation label="จำนวนเสื้อตามออเดอร์แยกไซซ์" />
        <div className={styles.printSpec}>
          <span className={styles.technique}>{samplePrint.printType}</span>
          <div><h4>{samplePrint.designNote}</h4><p>{String(samplePrint.width)} × {String(samplePrint.height)} ซม.</p></div>
          <Button variant="outline" size="sm" onClick={onOpenItems}>ดูรายการ<ArrowRight /></Button>
        </div>
        <div className={styles.workNote}><Package size={17} /><p>{sampleItem.notes}</p></div>
      </section>

      <section className={styles.preparation} aria-labelledby="workspace-production-files">
        <h3 id="workspace-production-files">แบบและไฟล์ของงาน</h3>
        <div className={styles.fileState}>
          {hasMockup ? <FileImage size={20} /> : <ImageOff size={20} />}
          <div><h4>ม็อกอัพ{hasMockup && <span>v2</span>}</h4><Badge variant="warning" size="sm">{hasMockup ? "รอลูกค้าตรวจ" : "ยังไม่มีม็อกอัพ"}</Badge></div>
          <Button variant="outline" size="sm" onClick={onOpenMockup}>ดูม็อกอัพ<ArrowRight /></Button>
        </div>
        <div className={styles.fileState}>
          <FileImage size={20} />
          <div><h4>ไฟล์พิมพ์</h4><span className={styles.fileAvailability}>{printFileCount > 0 ? `${printFileCount} ไฟล์ตัวอย่าง` : "ยังไม่มีไฟล์พิมพ์"}</span></div>
          <Button variant="outline" size="sm" onClick={onOpenPrintFiles}>เปิดไฟล์พิมพ์<ArrowRight /></Button>
        </div>
        <div className={styles.workOrder}>
          <ClipboardList size={21} />
          <div><h4>ใบสั่งงาน</h4><p>รายละเอียดจากออเดอร์นี้</p></div>
          <Button variant="ghost" size="sm" onClick={onOpenWorkOrder}>ดูตัวอย่าง<ArrowRight /></Button>
        </div>
      </section>
    </div>
  </section>;
}

export function WorkspaceDelivery({ deadline, shippingAddress, onEditShipping, onOpenProduction, onOpenItems }: {
  deadline: string;
  shippingAddress: string;
  onEditShipping: () => void;
  onOpenProduction: () => void;
  onOpenItems: () => void;
}) {
  const [showAddressPreview, setShowAddressPreview] = useState(false);

  return <>
    <section className={styles.workspace} aria-label="การจัดส่งตัวอย่าง">
      <header className={styles.heading}>
        <div><Truck size={19} /><h2>การจัดส่ง</h2><Badge size="sm">ยังไม่พร้อมส่ง</Badge></div>
        <span className={styles.deadline}><CalendarDays size={15} />กำหนดส่ง <strong>{formatDate(deadline)}</strong></span>
      </header>

      <div className={styles.deliveryColumns}>
        <section className={styles.destination} aria-labelledby="workspace-delivery-recipient">
          <div className={styles.sectionHeading}><h3 id="workspace-delivery-recipient"><MapPin size={17} />ผู้รับและที่อยู่</h3><Button variant="outline" size="sm" onClick={onEditShipping}><Pencil />แก้ไขที่อยู่</Button></div>
          <div className={styles.address}>
            <strong>{PREVIEW_ORDER.shippingRecipientName}</strong>
            <p>{shippingAddress}<br />{shippingLocality}</p>
            <span><Phone size={16} />{PREVIEW_ORDER.shippingPhone}</span>
          </div>
          <Button variant="ghost" size="sm" className={styles.previewAddress} onClick={() => setShowAddressPreview(true)}><ClipboardList />ดูตัวอย่างใบปะหน้า<ArrowRight /></Button>
        </section>

        <section className={styles.manifest} aria-labelledby="workspace-delivery-items">
          <div className={styles.sectionHeading}><h3 id="workspace-delivery-items"><Package size={17} />รายการที่จะจัดส่ง</h3><Button variant="ghost" size="sm" onClick={onOpenItems}>ดูรายการ<ArrowRight /></Button></div>
          <div className={styles.manifestProduct}><h4>{sampleItem.description}</h4><span>{sampleProduct.description}</span></div>
          <SizeAllocation label="จำนวนเสื้อที่จะจัดส่งตามออเดอร์แยกไซซ์" />
          <div className={styles.packingNote}><PackageOpen size={18} /><p>{PREVIEW_ORDER.notes}</p></div>
        </section>
      </div>

      <section className={styles.shipmentState} aria-label="รอบจัดส่ง">
        <span className={styles.shipmentIcon}><Truck size={24} strokeWidth={1.5} /></span>
        <div><h3>ยังไม่มีรอบจัดส่ง</h3><p>งานอยู่ระหว่างเตรียมแบบ</p></div>
        <Button variant="outline" size="sm" onClick={onOpenProduction}>ดูงานผลิต<ArrowRight /></Button>
      </section>
    </section>

    {showAddressPreview && <Dialog open onOpenChange={open => { if (!open) setShowAddressPreview(false); }}>
      <DialogContent>
        <DialogTitle>ใบปะหน้า · ตัวอย่าง</DialogTitle>
        <div className={styles.addressPreview}>
          <div className={styles.previewNumber}><span>{PREVIEW_ORDER_NUMBER}</span><Badge size="sm">ข้อมูลจำลอง</Badge></div>
          <p className={styles.previewLabel}>ผู้รับ</p>
          <strong>{PREVIEW_ORDER.shippingRecipientName}</strong>
          <p>{shippingAddress}<br />{shippingLocality}</p>
          <span className={styles.previewPhone}><Phone size={16} />{PREVIEW_ORDER.shippingPhone}</span>
          <div className={styles.previewContents}><Package size={17} /><span>{sampleItem.description}</span><strong>{totalQuantity} ตัว</strong></div>
        </div>
      </DialogContent>
    </Dialog>}
  </>;
}
