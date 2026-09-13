"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREVIEW_ORDER } from "../ui-reset/_order-data";
import styles from "./_contact.module.css";

export function WorkspaceContact({ onOpenCustomer }: { onOpenCustomer: () => void }) {
  const customer = PREVIEW_ORDER.customer!;
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const channels = [
    { label: "โทรศัพท์", value: customer.phone },
    { label: "LINE", value: customer.lineId },
    { label: "อีเมล", value: customer.email },
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
      <h3 id="workspace-contact-heading">ผู้ติดต่อ</h3>
      <Button variant="link" size="sm" onClick={onOpenCustomer}>ข้อมูลลูกค้า<ArrowRight /></Button>
    </header>
    <div className={styles.identity}><strong>{customer.name}</strong><p>{customer.company}</p></div>
    <dl className={styles.channels}>
      {channels.map(({ label, value }) => value ? <div key={label}>
        <dt>{label}</dt>
        <dd><span>{value}</span><Button variant="link" size="sm" className={styles.copy} aria-label={`คัดลอก${label}`} onClick={() => copyContact(label, value)}>{copied === label ? "คัดลอกแล้ว" : "คัดลอก"}</Button></dd>
      </div> : null)}
    </dl>
    <span className="sr-only" role="status">{copied ? `คัดลอก${copied}แล้ว` : ""}</span>
    {copyError && <p role="alert" className={styles.error}>คัดลอกไม่ได้ เลือกข้อความเพื่อคัดลอกได้</p>}
    <p className={styles.note}>{customer.notes}</p>
  </section>;
}
