"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Eye, FileImage, FileText, FolderOpen, ImageOff, LockKeyhole, MessageSquareText, Palette, Plus, Printer, Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { formatDate } from "@/lib/utils";
import { PREVIEW_ARTWORK, PREVIEW_ORDER, PREVIEW_ORDER_NUMBER } from "../ui-reset/_order-data";
import styles from "./_files.module.css";

export type WorkspaceSampleFile = { name: string; kind: "image" | "text"; path?: string };

export function WorkspaceFiles({
  activeGroup, onGroupChange, hasMockup, rawFiles, printFiles,
  onAddMockup, onAddPrintFile, onPreviewFile,
}: {
  activeGroup: string;
  onGroupChange: (group: string) => void;
  hasMockup: boolean;
  rawFiles: WorkspaceSampleFile[];
  printFiles: WorkspaceSampleFile[];
  onAddMockup: () => void;
  onAddPrintFile: () => void;
  onPreviewFile: (file: WorkspaceSampleFile) => void;
}) {
  const [selectedName, setSelectedName] = useState("");
  const [customerPreview, setCustomerPreview] = useState(false);
  const files = activeGroup === "print" ? printFiles : rawFiles;
  const selectedFile = files.find(file => file.name === selectedName) ?? files[0];
  const isMockup = activeGroup === "mockup";
  const isPrint = activeGroup === "print";
  const selectFile = (group: "raw" | "print", file: WorkspaceSampleFile) => {
    setSelectedName(file.name);
    onGroupChange(group);
  };

  const fileRow = (file: WorkspaceSampleFile, group: "raw" | "print") => (
    <button key={file.name} className={styles.fileRow} aria-pressed={activeGroup === group && selectedFile?.name === file.name} onClick={() => selectFile(group, file)}>
      <span className={styles.fileThumb}>
        {file.path ? <Image src={file.path} alt="" width={44} height={44} /> : <FileText size={22} />}
      </span>
      <span className={styles.fileName}>{file.name}<small>{file.kind === "image" ? "SVG" : "ข้อความจากลูกค้า"}</small></span>
      <ArrowUpRight size={15} />
    </button>
  );

  return (
    <div className={styles.workspace}>
      <section className={styles.preview} aria-label="แสดงตัวอย่างไฟล์">
        <Tabs value={activeGroup} onValueChange={onGroupChange}>
          <TabsBar className="static mx-0 border-0 bg-transparent">
            <TabsList aria-label="เลือกประเภทไฟล์" className="gap-5">
              <TabsTrigger value="mockup">ม็อกอัพ</TabsTrigger>
              <TabsTrigger value="raw">ไฟล์ลูกค้า</TabsTrigger>
              <TabsTrigger value="print">ไฟล์พิมพ์</TabsTrigger>
            </TabsList>
          </TabsBar>
        <TabsContent value={activeGroup}>
        <div className={styles.previewHeading} aria-live="polite">
          <div>
            <h2>{isMockup ? "แบบขออนุมัติ" : selectedFile?.name ?? "ไฟล์พิมพ์"}</h2>
            {isMockup && hasMockup ? <span>v{PREVIEW_ARTWORK.versionNumber} <span aria-hidden="true">·</span> {formatDate(PREVIEW_ARTWORK.createdAt)}</span>
              : !isMockup && selectedFile ? <span>{isPrint ? "ไฟล์ใช้ผลิต" : "ไฟล์จากลูกค้า"}</span> : null}
          </div>
          {isMockup && hasMockup ? <Badge variant="warning" size="sm">รอลูกค้าตรวจ</Badge>
            : isPrint ? <span className={styles.privateLabel}><LockKeyhole size={13} />ภายใน</span> : null}
        </div>

        {!isMockup && files.length > 1 ? <div className={styles.mobilePicker}><Select aria-label="เลือกไฟล์ที่จะแสดง" value={selectedFile.name} onChange={event => setSelectedName(event.target.value)}>{files.map(file => <option key={file.name} value={file.name}>{file.name}</option>)}</Select></div> : null}

        {isMockup ? (
          hasMockup ? <div className={styles.canvas}><MockupGallery version={PREVIEW_ARTWORK} versionNumber={PREVIEW_ARTWORK.versionNumber} className={styles.gallery} /></div>
            : <div className={styles.emptyCanvas}><ImageOff size={40} strokeWidth={1.3} /><p>ยังไม่มีม็อกอัพ</p><Button variant="outline" onClick={onAddMockup}><Plus />ลองเพิ่มม็อกอัพ</Button></div>
        ) : selectedFile ? (
          <div className={selectedFile.path ? styles.canvas : styles.textCanvas}>
            {selectedFile.path ? <button className={styles.selectedImage} aria-label={`ขยาย ${selectedFile.name}`} onClick={() => onPreviewFile(selectedFile)}><Image src={selectedFile.path} alt={selectedFile.name} width={520} height={520} /></button>
              : <><FileText size={24} /><h3>รายละเอียดจากลูกค้า</h3><p>{PREVIEW_ORDER.description}</p></>}
          </div>
        ) : <div className={styles.emptyCanvas}><Printer size={40} strokeWidth={1.3} /><p>ยังไม่มีไฟล์พิมพ์</p><Button variant="outline" onClick={onAddPrintFile}><Plus />เพิ่มไฟล์ตัวอย่าง</Button></div>}

        {isMockup && hasMockup ? <div className={styles.previewFooter}><span><Shirt size={16} />Studio Coffee</span><Button variant="ghost" size="sm" onClick={() => setCustomerPreview(true)}><Eye />มุมมองลูกค้า</Button></div> : null}
        {isMockup ? <div className={styles.brief}><h3><MessageSquareText size={16} />รายละเอียดงาน</h3><p>{PREVIEW_ORDER.description}</p></div> : null}
        </TabsContent>
        </Tabs>
      </section>

      <aside className={styles.shelf} aria-label="รายการไฟล์แนบ">
        <section className={styles.fileGroup} aria-labelledby="workspace-customer-files">
          <header><h2 id="workspace-customer-files"><FolderOpen size={18} />ไฟล์ลูกค้า</h2><span>{rawFiles.length} ไฟล์</span></header>
          <div className={styles.fileList} role="group" aria-label="เลือกไฟล์จากลูกค้า">{rawFiles.map(file => fileRow(file, "raw"))}</div>
        </section>

        <section className={styles.fileGroup} aria-labelledby="workspace-print-files">
          <header><h2 id="workspace-print-files"><Printer size={18} />ไฟล์พิมพ์</h2><span>{printFiles.length} ไฟล์</span></header>
          <span className={styles.privateLabel}><LockKeyhole size={13} />ภายในโรงงาน</span>
          {printFiles.length ? <div className={styles.fileList} role="group" aria-label="เลือกไฟล์พิมพ์">{printFiles.map(file => fileRow(file, "print"))}</div>
            : !isPrint ? <div className={styles.emptyShelf}><FileImage size={23} /><span>ยังไม่มีไฟล์พิมพ์</span><Button variant="ghost" size="sm" onClick={() => { onGroupChange("print"); onAddPrintFile(); }}><Plus />เพิ่มตัวอย่าง</Button></div> : null}
        </section>

        <section className={styles.brand} aria-labelledby="workspace-brand-title">
          <h2 id="workspace-brand-title"><Palette size={18} />แบรนด์ลูกค้า</h2>
          <div className={styles.swatches}>
            {PREVIEW_ORDER.brandProfile?.colorCodes.map(color => <span key={color}><i style={{ backgroundColor: color }} />{color}</span>)}
          </div>
          <dl><div><dt>ฟอนต์แบรนด์</dt><dd>{PREVIEW_ORDER.brandProfile?.fonts.join(", ")}</dd></div></dl>
          <p>{PREVIEW_ORDER.brandProfile?.styleNotes}</p>
        </section>
      </aside>

      <Dialog open={customerPreview} onOpenChange={setCustomerPreview}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>มุมมองลูกค้า · ตัวอย่าง</DialogTitle>
          <div className={styles.customerPreview}>
            <div><strong>Studio Coffee</strong><span>{PREVIEW_ORDER_NUMBER}</span></div>
            <Image src={PREVIEW_ARTWORK.fileUrl} width={600} height={600} alt="แบบขออนุมัติ Studio Coffee" />
            <p>อกซ้าย 9 × 6 ซม. · สีครีม</p>
            <Badge variant="warning" size="sm">รอตรวจแบบ v{PREVIEW_ARTWORK.versionNumber}</Badge>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
