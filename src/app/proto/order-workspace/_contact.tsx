"use client";

import { Button } from "@/components/ui/button";
import { PREVIEW_ORDER } from "../ui-reset/_order-data";
import styles from "./_contact.module.css";

export function WorkspaceContact({ onOpenCustomer }: { onOpenCustomer: () => void }) {
  const customer = PREVIEW_ORDER.customer!;
  const channels = [
    { label: "โทรศัพท์", value: customer.phone },
    { label: "LINE", value: customer.lineId },
    { label: "อีเมล", value: customer.email },
  ];

  return <section className={styles.contact} aria-labelledby="workspace-contact-heading">
    <header className={styles.heading}>
      <h3 id="workspace-contact-heading">ผู้ติดต่อ</h3>
      <Button variant="link" size="sm" onClick={onOpenCustomer}>ข้อมูลลูกค้า</Button>
    </header>
    <div className={styles.identity}><strong>{customer.name}</strong><p>{customer.company}</p></div>
    <dl className={styles.channels}>
      {channels.map(({ label, value }) => value ? <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div> : null)}
    </dl>
    <p className={styles.note}>{customer.notes}</p>
  </section>;
}
