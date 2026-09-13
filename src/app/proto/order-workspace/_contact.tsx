"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PREVIEW_ORDER } from "../ui-reset/_order-data";
import styles from "./_contact.module.css";

export function WorkspaceContact({ onOpenCustomer }: { onOpenCustomer: () => void }) {
  const customer = PREVIEW_ORDER.customer!;
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const channels = [
    { label: "โทรศัพท์", value: customer.phone, icon: Phone },
    { label: "LINE", value: customer.lineId, icon: MessageSquareText },
    { label: "อีเมล", value: customer.email, icon: Mail },
  ];

  async function copyContact(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError(false);
    } catch {
      setCopied("");
      setCopyError(true);
    }
  }

  return <section className={styles.contact} aria-labelledby="workspace-contact-heading">
    <header className={styles.heading}>
      <h3 id="workspace-contact-heading"><UserRound size={18} />ผู้ติดต่อ</h3>
      <Button variant="outline" size="sm" onClick={onOpenCustomer}>ข้อมูลลูกค้า<ArrowRight /></Button>
    </header>
    <div className={styles.identity}><span className={styles.avatar}>ฟ</span><div><strong>{customer.name}</strong><p>{customer.company}</p></div></div>
    <dl className={styles.channels}>
      {channels.map(({ label, value, icon: Icon }) => value ? <div key={label}>
        <dt><Icon size={16} />{label}</dt>
        <dd><span>{value}</span><Button variant="outline" size="sm" className={styles.copy} aria-label={`คัดลอก${label}`} onClick={() => copyContact(label, value)}>{copied === label ? <Check /> : <Copy />}{copied === label ? "คัดลอกแล้ว" : "คัดลอก"}</Button></dd>
      </div> : null)}
    </dl>
    <span className="sr-only" role="status">{copied ? `คัดลอก${copied}แล้ว` : ""}</span>
    {copyError && <p role="alert" className={styles.error}>คัดลอกไม่ได้ เลือกข้อความเพื่อคัดลอกได้</p>}
    <div className={styles.meta}><span>เลขภาษี <b>{customer.taxId}</b></span><span>{customer.tags.map(tag => <Badge key={tag} size="sm">{tag}</Badge>)}</span></div>
    <p className={styles.note}>{customer.notes}</p>
  </section>;
}
