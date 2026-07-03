# B15 — Vercel Firewall / rate-limit (ตั้งตอน deploy)

> เบสเคาะ 2026-07-03: rate-limit public endpoints ใช้ **Vercel platform** (ไม่เขียน code ในแอป)
> ทำใน Vercel (dashboard หรือ `vercel firewall` CLI) — **หลัง deploy + `vercel link` แล้ว**

## ✅ มีให้ฟรีอัตโนมัติแล้ว (ไม่ต้องทำอะไร)
- **DDoS mitigation** เปิดทุก project ทุก plan (รวม Hobby) — กัน L3/L4/L7 · ไม่คิดเงินทราฟฟิกที่ถูกบล็อก
- นี่คือ baseline — ต่อให้ยังไม่ตั้ง WAF rule ก็มีการกันยิงถล่มระดับ platform อยู่แล้ว

## ⬜ ต้องตั้งเพิ่ม (rate-limit เจาะจง public token pages)

**หน้า public ที่เปิดได้ไม่ต้อง login** (ควร rate-limit ต่อ IP): `/job/` `/status/` `/quote/` `/approve/` `/upload/`
(ลิงก์ใบงานร้านนอก/สถานะลูกค้า/ใบเสนอ/อนุมัติแบบ/อัปโหลด — คนนอกถือลิงก์เปิดได้)

### ขั้นที่ 1 — เพิ่ม rule แบบ "log ก่อน" (ยังไม่บล็อก ดูทราฟฟิกจริงก่อน)
```bash
vercel link            # ครั้งแรก — ผูก repo กับ project บน Vercel
vercel firewall rules add "RL public token pages" \
  --condition '{"type":"path","op":"pre","value":"/job/"}' \
  --or --condition '{"type":"path","op":"pre","value":"/status/"}' \
  --or --condition '{"type":"path","op":"pre","value":"/quote/"}' \
  --or --condition '{"type":"path","op":"pre","value":"/approve/"}' \
  --or --condition '{"type":"path","op":"pre","value":"/upload/"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 60 \
  --rate-limit-keys ip \
  --rate-limit-action log \
  --yes
vercel firewall diff            # ดูของที่จะเปลี่ยน
vercel firewall publish --yes   # ดัน draft ขึ้น production
```
- 60 ครั้ง/นาที/IP = เผื่อไว้เยอะ (ร้าน/ลูกค้าเปิดลิงก์ปกติไม่ถึง) · `--rate-limit-action log` = แค่บันทึก ยังไม่บล็อก
- ดูผลที่ `https://vercel.com/<team>/<project>/firewall/traffic?filter=<ruleId>` ว่ามีแต่ทราฟฟิกผิดปกติโดน (ไม่โดนลูกค้าจริง)

### ขั้นที่ 2 — พอมั่นใจแล้ว เปลี่ยนเป็นบล็อกจริง
```bash
vercel firewall rules edit "RL public token pages" \
  --rate-limit-action rate_limit \
  --yes          # เกินลิมิต → ตอบ 429 (ช้าลงหน่อย) · ตั้ง requests ให้แคบลงได้ เช่น 20-30/นาที
vercel firewall publish --yes
```

### BotID / Bot Protection (กันบอท)
- Dashboard: `Project → Firewall → Bot Protection` เปิด managed ruleset (กันบอท/AI crawler)
- ใช้ verified-bot signals ของ Vercel (อย่าบล็อกด้วย user-agent เอง — ชนบอทดีอย่าง Googlebot/LINE unfurler)

## ⚠️ ข้อควรรู้
- rate-limit counter **นับแยกต่อ region** — N region รวมกันอาจเกินลิมิตที่ตั้ง ~N เท่า (ตั้งเผื่อ)
- ห้ามตั้ง `deny` บน path กว้าง (เช่น `/`) — บล็อกทั้งเว็บ
- ต้องการนับซับซ้อน (ต่อ token/cookie) → Rate Limiting SDK: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk

---
_อัปเดตล่าสุด: 2026-07-03 (Gate B15) · อ้างอิง skill vercel:vercel-firewall_
