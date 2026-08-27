# Anajak ERP — SPEC (อะไรคือ "เสร็จ")
> เกณฑ์ที่ต้องเป็นจริงถึงเรียกว่าเสร็จ · AI verify ทุกข้อก่อนเคลม done ด้วยรัน/เปิดดูจริง (type check ผ่าน ≠ ใช้งานได้) · เปลี่ยน spec = แก้ที่นี่ก่อนเขียนโค้ด
> สถานะ `[x]` = audit โค้ดจริงยืนยันผ่าน (2026-06-19 + audit ใหญ่ 2026-07-02 adversarial verify — มี file:line อ้างอิง) · `[ ]` = ยังไม่ verify / gate ที่ต้องปิดก่อน deploy · งานต่อ trace กลับ `ROADMAP.md`

## เป้าหมาย
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ให้ทีม 5 คน+เจ้าของ จัดการ ขาย→ผลิต→outsource→ส่ง→ออกบิล/ภาษี ของลูกค้า B2B (เครดิตเทอม) ครบวงจร ออกเอกสารภาษีเต็มรูปเอง + เชื่อม Anajak Stock · **ห้าม deploy/ใช้จริงจนจบ P0** (ROADMAP.md:18)

## ⚙️ Framework runtime (ตรวจจริง 2026-08-16)
- [x] **Runtime เป็น Next.js 16.3 จริงทั้งเครื่องพัฒนาและ production build** — pin `next`/`eslint-config-next` ที่ 16.3.1, React/React DOM 19.2.8 และ type packages ที่ตรง peer range · Node local/CI ผ่านขั้นต่ำ 20.9
- [x] **ขอบเขต auth ใช้ Proxy convention ของ Next 16** — `src/proxy.ts` คง Supabase session refresh, dashboard redirect, public-token allowlist และ API 401 JSON เดิม · มี Proxy regression test ครบ matcher, refreshed cookie, redirect/`next` และ API no-redirect
- [x] **ด่าน framework ไม่พึ่งไฟล์ generated เก่า** — `typecheck` รัน `next typegen` ก่อน TypeScript · lint ใช้ flat config ของ Next 16 โดยตรง · Turbopack เป็นค่าเริ่มต้นและไม่เปิด Cache Components/React Compiler เพิ่ม

## 🧭 UI หลักแบบ minimal (เลื่อน V2 ขึ้นเป็นระบบจริง 2026-08-12)
- [x] **ทุก surface มี visual identity ที่สแกนได้โดยไม่รก** — หน้ามาตรฐานมี module marker neutral แบบเส้นล้วนที่มีชื่อเข้าถึงได้และไม่มีพื้น/กรอบ/เงา; registry ใช้ข้อความเป็นหลักและไม่สร้าง object icon/initials ซ้ำ ส่วนรายการออเดอร์แสดงม็อกอัพจริงล่าสุดหรือช่องภาพว่างขอบประจาก component เดียวกับคิวผลิต; section สำคัญใช้ไอคอน neutral และไม่มีศัพท์คำสั่งพัฒนาหลุดไปหาผู้ใช้
- [x] **ความเด่นไม่ทำลายงาน** — โครงสร้าง ขนาด ภาพงานจริง และ object identity เป็นตัวนำ; น้ำเงิน Anajak ใช้กับ primary/selected/focus, สีสถานะใช้เฉพาะความหมายจริง, หนึ่งหน้ามี primary action เดียว และ Station/TV ไม่มีเงิน
- [x] **public และ print เป็นครอบครัวเดียวกันแต่ไม่ฝืนหน้าที่** — public token ทั้ง 5 surface ใช้ masthead neutral, panel 8px ไร้เงา และ semantic state โดยรักษา blind-ship/token/action เดิม; เอกสารทั้ง 5 ชนิดคง document marker/metadata hierarchy, A4, light-only, grayscale-safe, ข้อความกฎหมาย/ภาษี/ยอด/ลำดับหน้าเดิม · preview บนจอมีเงากระดาษได้และจอแคบเลื่อนอยู่ภายในพื้นที่เอกสาร ส่วนตอนพิมพ์ต้องถอดเงา/มุมทั้งหมด
- [x] **สีรองช่วยบอกบริบทโดยไม่แย่ง primary** — sales ใช้น้ำเงินเดิม, production teal, product saffron, finance violet และ system graphite ผ่าน semantic token กลางทั้ง Light/Dark; selected/focus/CTA ยังเป็น Anajak Blue และ status/print ไม่ถูกเปลี่ยนความหมาย
- [x] **ทุกหน้ามีคำอธิบายสั้นใต้หัวข้อ** — PageHeader/PageShell แสดงหนึ่งประโยคว่าหน้านี้ใช้ทำอะไรและแยกจาก metadata ของรายการ; HelpTip ใช้เฉพาะสูตร กติกา หรือรายละเอียดเสริมที่ยาว ส่วน warning/error/validation/blocker/legal/action consequence ยังเห็นตรงหน้าและใช้ได้บน mouse/keyboard/touch
- [x] **URL หลักมีหน้าตาเดียว** — `/` และ `/orders*` ใช้ dashboard/shell/order presentation ที่ผ่านการทดลองใน V2 · ไม่มี branch classic/V2 ใน component หลัก · `/v2*` เป็น compatibility redirect มายัง URL หลักและรักษา query เดิม
- [x] **เป็นของจริง ไม่ใช่ mockup** — อ่านข้อมูลจาก tRPC/service/permission ชุดเดิมและทุก action พาไป flow ที่ใช้งานได้จริง · ห้ามมีตัวเลข/รายการตัวอย่างเขียนค้างในหน้า
- [x] **จุดโฟกัสชัดใน 3 วินาที** — งานเสี่ยง/งานค้างและ action หลักมาก่อนสถิติสะสม · desktop Sidebar แสดงทุกโมดูลที่มีสิทธิ์เป็นหมวดแบบแบน ไม่มีพื้น/สีครอบหมวด และใช้น้ำเงินเฉพาะ active item โดยไม่ซ่อนใน disclosure; ปุ่มหุบ/กางใช้สัญลักษณ์แผงซ้ายเปิด/ปิด โดย visual 24px อยู่กึ่งกลางทับเส้นแบ่ง sidebar ทั้งตอนกาง/หุบ ส่วนพื้นที่กดมาตรฐาน 36px (coarse pointer 44px) ยื่นไปฝั่งเนื้อหาเพื่อไม่ทับตรา · ไม่ทับช่องค้นหาและคง focus/ARIA เดิม · ส่วนมือถือคงงานหลัก 4 รายการและเปิดที่เหลือผ่าน “เพิ่มเติม”
- [x] **ชุดสีเดียวทั้งระบบทั้งสองธีม** — ล็อกน้ำเงินแบรนด์ `#3973b2` ไว้ · บันไดความลึก (แก้ล่าสุด 2026-08-27 UI-2026 เฟส 11): Light ใช้ผืนงาน near-white `#f7f7f8` ใต้ `chrome/card #ffffff`; การ์ดแยกชั้นด้วย edge บางและเงากลางชุดเดียว ไม่พึ่งพื้นเทาเข้ม · Dark คง `chrome #0a0a0b` จมใต้ผืนงาน `#0e0e10` < การ์ด `#161618` และห้ามดำสนิท · ของที่กดได้มีคู่ interaction สามชุดตามพื้นที่ไปยืน (การ์ด / กรอบเว็บ / ผืนงาน) ใช้ผิดคู่ = ชี้แล้วจอไม่ขยับ · semantic text ผ่าน WCAG AA · public/print ไม่ถูกธีมหลังบ้านรบกวน
- [x] **สถานะโต้ตอบชัดแต่ไม่เป็นแถบหนัก** — navigation/row/clickable card ใช้ neutral hover/pressed ที่ครอบ hit areaจริงโดยไม่ขยับตำแหน่ง · active navigation เป็นแถว neutral fill ส่วนตัวกรอง/ขั้นสถานะเลือกใช้ข้อความ neutral+เส้นใต้ · น้ำเงินยังอยู่ที่ primary/link/focus · disabled แยกชัด · ข้อความบนทุก state ผ่าน WCAG AA
- [x] **ตัวกรองธรรมดาแบบ minimal** — ตัวเลือกไม่เกิน 5 ตัวใช้ `FilterChip` กลางเป็นข้อความ neutral ไม่มีกรอบกล่อง พื้นสี เงา หรือ radius · selected ใช้เส้นใต้และน้ำหนักข้อความพร้อม `aria-pressed` · ตัวเลือกเกิน 5 ใช้ `Select` · ตัวกรองที่ใช้ประจำบน `/orders` (ช่วงวันที่/ช่องทาง/ประเภท) ต้องเห็นตรง toolbar ไม่ซ่อนใน `FilterPopover`; popover สงวนให้เงื่อนไขรองที่ไม่ควรกินพื้นที่ตลอด · มือถือยังแตะได้อย่างน้อย 44px
- [x] **แถบบนอยู่เหนือเฉพาะคอลัมน์เนื้อหา** (กลับคำจากข้อเดิม "พาดเต็มจอ" · เบสสั่ง 2026-08-26) — เมนูซ้ายสูงเต็มจอและถือตรา · แถบบนกับเนื้อหาใต้มันต้องขอบขวาตรงกัน (กล่อง `max-w-screen-2xl` ชุดเดียวกัน + เผื่อรางแถบเลื่อนที่ `<main>` จองไว้) · เมนูซ้ายอยู่ก่อนแถบบนใน DOM เพื่อให้ลำดับ Tab เดินตามที่ตาเห็น · จอแคบแถบยังพาดเต็มจอและถือตรา · mobile bottom navigation ไม่ถอย
- [x] **ใช้ได้จริงหลายขนาดจอ** — 390px และ 1440px ไม่มี horizontal overflow · เป้ากดมือถือ ≥44px · sticky action ไม่ถูก bottom navigation ทับ · keyboard focus/ภาษาไทย/reduced-motion ใช้ได้ครบ
- [x] **ตัวอักษรสมส่วนและภาษาไทยไม่ถูกบีบ** — Prompt เป็นฟอนต์เดียวของ surface จอ · page/section/dialog/body/metadata/micro ใช้ role 24/16/18/14/12/11px ตาม `docs/DESIGN.md` · 11px สงวนให้ status/counter ไม่ใช้กับ action/label/instruction · Button/Input/Select/Textarea ห้ามถูก caller ลดขนาด · tracking/line-height แบบ Latin ห้ามทับข้อความไทย · public/factory ผ่าน viewport จริง · print ตรวจ source/A4 contract ครบ 5 และ render จริง 4 แบบที่ฐาน dev มีข้อมูล (`billingNote` มี 0 record)
- [x] **สถานะและสิทธิ์ไม่โกหก** — loading/error/retry/empty แยกกัน · ข้อมูลเงินและเมนู gated ตาม permission เดิม · ทางเข้าฟอร์มเปิดงานทุกจุดใช้กติกาเดียวกันและ fail closed
- [x] **รายการออเดอร์เริ่มจากงาน ไม่เริ่มจากแผงสถานะ** — มือถือเห็นรายการหรือ empty/error ที่ลงมือทำได้ก่อน `y=600` · จอกว้างเห็น status rail ครบ · search/filter/sort/pagination/CSV ยังใช้งานจริง · ในแต่ละรายการทั้ง desktop/mobile ชื่อลูกค้าเป็นบรรทัดหลัก ชื่องานเป็นบรรทัดรอง และ fallback ต้องไม่พิมพ์ข้อมูลเดียวกันซ้ำ
- [x] **เปิดงานและรายละเอียดคง flow เดิม** — draft/validation/upload/`next=quote`/duplicate/status/เอกสาร/แท็บ URL+Back ผ่าน service/server guard เดิม · แท็บเป็น underline minimal และไม่เสีย ARIA/keyboard
- [x] **พื้นผิวแยกตามหน้าที่ ไม่กลืนกัน** — `Section` ที่เป็นกลุ่มหลักและ `DataTable` อยู่ใน panel เดียวกับเนื้อหาที่สัมพันธ์กัน — **ตารางระดับบนสุดมีกล่องครอบเสมอ** (เบสกลับคำตัดสินใจ 2026-08-26 หลังเห็นของจริง · prop `flush` ถูกถอดออกจากระบบแล้ว); หัวตารางโปร่งเป็นสีเดียวกับพื้นตารางแม่และใช้ divider แยกชั้น, body ของ list table ใช้ 14px ทุกระดับโดยแยกความสำคัญด้วยสี/น้ำหนัก, แถวไม่ย้อม hover รายช่อง · panel ใช้พื้นขาว/neutral dark + hairline edge + เงากลางที่มีเพดานเดียวกัน · field/toolbar/secondary action ใช้พื้น panel+ขอบบาง · overlay มี elevation สูงสุด · focus/error/selected ต้องชนะสถานะปกติอย่างชัดเจน
- [x] **ไม่มี visual island หลุดจากระบบกลาง** — panel, mobile record, alert, context, loading และพื้นที่ทำงาน Production/Station ใช้บันไดมุมกลาง (ชิ้นเล็ก 10px · กล่อง 12px · การ์ด 16px), ขอบ semantic และระยะภายในตามพื้นที่; card shadow มาจาก `.card-surface` ที่เดียว ห้ามเติม utility เงารายจุด · pill คงไว้เฉพาะ status/switch โดยไม่ลดเป้ากด Station หรือเปลี่ยน no-money boundary
- [x] **รายการงานแยกเป็นการ์ดที่อ่านออกทันที** — หน้าเปิดงานและหน้าแก้ไขใช้หนึ่งรายการต่อหนึ่ง card โดยตรงบน workspace และห้าม card ซ้อนโดยไม่เพิ่มความหมาย · CTA “เพิ่มรายการ” อยู่เหนือ list และเห็นได้ก่อนเลื่อน · hierarchy อ่านได้ทั้ง desktop/mobile และกลับชั้นผิวครบใน Dark

## 🧩 UX integrity refactor (Impeccable audit 2026-08-13)
- [x] **โค้ด UI หลักมีบ้านเดียว** — shell/dashboard/order primitives ที่เป็น canonical ไม่ใช้ชื่อ V2 หลังเลื่อนขึ้นเป็นระบบจริงแล้ว · ถอด shell เก่าที่ไม่มี caller เพื่อกันแก้ผิดชุด
- [x] **แท็บโหลดเท่าที่ใช้** — หน้ารายละเอียดออเดอร์ mount/query เมื่อเปิดครั้งแรกแล้วรักษา state ของแท็บที่เคยเข้า · ฟอร์มเปิดงาน opt-in keep-mounted เพื่อไม่ทำข้อมูลที่พิมพ์ค้างหาย
- [x] **interaction ไม่โกหก** — ไม่มี interactive element ซ้อนกัน · ปุ่มล้าง/ปิดบนมือถือมีเป้ากด≥44px · สถานะที่ยังทำไม่ได้ไม่วาดเป็นปุ่ม · ป้าย action ห้ามถูกตัดจนเดาความหมายไม่ได้ · dialog ที่เปิดแบบ conditional mount ต้องปิดด้วย Escape/ปุ่มปิดแล้วคืน focus ให้ control ที่เปิด
- [x] **สิทธิ์และ deep link ชัดเจน** — order detail รอ permission ก่อนวาด action/แท็บ · query สิทธิ์พังเป็น error ระดับหน้า · ลิงก์ไปแท็บที่ไม่มีสิทธิ์ต้องบอกเหตุผลและกลับแท็บที่เข้าได้
- [x] **คิวผลิตสดพอสำหรับหลายคน** — `/production` โพลล์ข้อมูลและ refetch เมื่อกลับแท็บ ไม่พึ่งเฉพาะ mutation ของเครื่องตัวเอง
- [x] **กู้ร่างได้ตรงกับคำที่บอก** — `/orders/new` กู้ค่าหัวออเดอร์ เงื่อนไข ค่าใช้จ่าย ที่อยู่จัดส่ง และ metadata ไฟล์ที่อัปโหลดแล้ว · แยกตามผู้ใช้ มีอายุ 7 วัน ไม่เก็บ base64 preview และ debounce เก่าห้ามเขียนร่างกลับหลังสร้างสำเร็จ/reset

## 🎨 ม็อกอัพออเดอร์ (2026-08-22)
- [x] **หนึ่งเวอร์ชัน = หลายรูป** — ดีไซเนอร์แนบม็อกอัพหลายด้าน (หน้า/หลัง/แขน) ในเวอร์ชันเดียว ระบุตำแหน่งพิมพ์ต่อรูปได้ และลูกค้าอนุมัติทั้งชุดครั้งเดียว · เวอร์ชันก่อน migration ที่มีรูปเดียวต้องแสดงได้เหมือนเดิมทุกจอโดยไม่ต้อง backfill
- [x] **ม็อกอัพมีบ้านเดียว** — ตัวจัดการอยู่ที่หน้าออเดอร์แท็บ `ม็อกอัพ & ไฟล์` เท่านั้น · จอที่เหลือ (แท็บงานผลิต, `/production/[id]`, Station, ใบสั่งผลิต, ลิงก์ลูกค้า) อ่านอย่างเดียวและใช้ component/สูตรอ่านชุดเดียวกัน ห้ามยิง query ซ้ำหรือทำ UI จัดการซ้อน
- [x] **ลูกค้าเห็นครบก่อนตัดสิน** — ลิงก์อนุมัติแสดงทุกรูปในชุดขนาดใหญ่พร้อมป้ายบอกด้าน · ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ (`.ai/.psd/.pdf`) ต้องแนบรูปตัวอย่างก่อนส่ง มิฉะนั้นส่งชุดนั้นไม่ได้
- [x] **ทุกรูปในชุดเปิดได้ด้วย token เดียว** — `/api/files` อนุญาตครบทั้งชุดของเวอร์ชันนั้น โดย allowlist กว้างเท่าที่หน้าโชว์เท่านั้น (ลิงก์สถานะและใบงานร้านนอกยังโชว์รูปปกจึงไม่ขยายสิทธิ์)
- [x] **ฝ่ายผลิตเห็นภาพก่อนลงมือ** — `/production/[id]` เก็บ approved mockup snapshot เป็นหลักฐานอ้างอิง และ Station แสดงภาพที่อนุมัติก่อน action · ใบสั่งผลิตกระดาษยังแสดงครบทุกด้าน · ทั้งหมดไม่มีข้อมูลเงินและไม่มีปุ่มอนุมัติ

## 🏭 Production V2 — ERP/MES หนึ่งข้อมูลจริง หนึ่งบ้านต่อหนึ่งงาน (2026-08-22)
- [x] **แกน Manufacturing มี lifecycle ชัด** — `Production` คือ Manufacturing Order และ `ProductionStep` คือ Operation Job โดยคง ID/FK เดิม · routing มี version, dependency แบบขนาน, snapshot ตอน release, quantity line, append-only event, exception และ rework ที่ตรวจย้อนหลังได้ · ทุก lane ต้องรวมที่ Final Pack เดียวซึ่งเป็น terminal operation
- [x] **คำสั่งปลอด retry และจอค้าง** — query/command อยู่ใน `manufacturing` router; command รับ `commandId` + `expectedRevision`, ล็อก record ตามลำดับเดียว และให้ server คำนวณ readiness/dependency/available commands · เฉพาะของดีเดินต่อได้
- [x] **ERP กับ Station แยกเจ้าของ** — `/production` คือรายการทุกงานแบบ server-side pagination; `/production/[id]` คือ Control Record สำหรับ release/priority/assignment/exception/audit โดยไม่มี start/report/complete; `/factory/station` คือ execution surface ที่มีงานปัจจุบันและ primary action เดียว
- [x] **Station ครบ Work Center จริง** — เตรียมงาน, พิมพ์ DTF, รีดร้อน, ตรวจคุณภาพขั้นสุดท้าย, แพ็กขั้นสุดท้าย และงานส่งผลิตภายนอกใช้ dispatch/read model เดียว · blocked แยกจาก actionable queue และค่าที่ยังไม่รู้แสดง “ยังไม่ประเมิน”
- [x] **จบขั้นแล้วตามออเดอร์เดิมต่อได้** — หลัง complete Station ขอ handoff DTO ที่ไม่มีเงินจาก server, เสนอ operation ของ production/order เดิม และให้ผู้ใช้กดไปจุดถัดไปเอง · navigation ห้าม claim/start/complete อัตโนมัติ
- [x] **สแกนเปิด context เท่านั้น** — รับเลขออเดอร์หรือ QR แล้วแสดง operation ที่ผู้ใช้เข้าถึงได้; หลายงานต้องให้เลือก และสถานะต้องคงเดิมจนผู้ใช้กด command ที่ server อนุญาต
- [x] **DTF เป็น batch ใน Station** — เปิด/ยกเลิก/ปิดรอบ, แยกผลดี/เสีย/พิมพ์ซ้ำ และฟิล์มผูก Operation Job · สมาชิกทั้ง batch และ revision ต้องตรงตอน commit เพื่อกันยอดซ้ำหรือปิดผิดงาน
- [x] **QC/Rework ไม่มีทางลัด** — reject ทุกบรรทัดเลือกพักรอหัวหน้า, ส่งกลับแก้+ตรวจซ้ำ หรือตัดเป็นของเสีย; rework ผูก defect line และ work center เป้าหมาย ก่อนกลับเข้า QC ใหม่
- [x] **Pack กับ Delivery คนละบ้าน** — Final Pack บันทึกตามสินค้า/สี/ไซซ์ใน Station; completion service เดินออเดอร์เป็นพร้อมส่งเมื่อทุก Operation จบจริง · การสร้างใบส่ง เลขติดตาม และยืนยันส่งอยู่แท็บ Delivery ของออฟฟิศและใช้ `ship_orders`; generic Order status เขียนสถานะการผลิต/ส่งไม่ได้เมื่อเปิด V2
- [x] **Outsource อยู่ใน Production** — ผู้ประสานงานใช้ worklist ส่งร้าน/รับกลับ/ตรวจรับ; pass/fail ผูก quantity, exception และ rework กับ Operation Job · vendor public page เดิมคง read-only
- [x] **Station/TV ไม่มีข้อมูลเงินโดยโครงสร้าง** — DTO ใช้ explicit select/mapper ที่ไม่รับราคา ต้นทุน ค่าจ้าง หรือค่าขนส่ง แม้ผู้ใช้เป็น OWNER; `/factory` เป็น TV อ่านอย่างเดียว ไม่มี link/button/mutation
- [x] **Order/My Tasks ไม่เป็นบ้านซ้ำ** — Production tab ใน Order เหลือ summary+Control Record link; header ไม่เดิน production status; My Tasks ส่งหัวหน้าเข้า Control Record และส่งพนักงานเข้า exact Station job · หลังเปิดใบผลิต นิยามสินค้า/สี/ไซซ์/จุดพิมพ์และหลักฐานรับเสื้อบน Order เป็น read-only เพื่อไม่ให้ snapshot หน้างานเก่าเงียบ
- [x] **route เก่ากลับบ้าน canonical** — `/production/print-runs`, `/production/films` และ `/outsource` redirect เข้ามุมมองใน `/production`; legacy UI อยู่หลัง flag ชั่วคราวเพื่อ rollback และต้องถูกลบพร้อม writer เก่าหลัง rollout window
- [x] **ฐานทดสอบแยกและ state ครบ** — fixture V2 ครอบ variant, parallel lane, batch, partial output, defect/rework, outsource และ partial pack; migration verifier กับ command smoke ทำงานบนฐาน disposable โดยไม่แตะฐาน shared/remote
- [x] **จอเป้าหมายและ state ผ่านจริง** — desktop/tablet/mobile/TV ไม่มี horizontal overflow; loading/error/retry/empty/stale/success, refresh, deep link, Back/Escape/focus และ console ถูกตรวจใน browser · ด่าน `npm test`, `npm run typecheck`, `npm run lint`, `npm run verify:ui` และ `npm run build` ต้องผ่านก่อนขอ cutover

## 🔐 P0 deploy-gate — verified ครบแล้ว (audit 2026-07-02 อ่านโค้ดจริง + adversarial verify)
- [x] **คนนอกเปิดเว็บแล้วเข้าไม่ได้** — `src/proxy.ts:31-78` refresh session ทุก request รวม /api · ยกเว้นเฉพาะหน้า public token (approve/upload/status/quote) + /api/mcp (auth ด้วย key เอง)
- [x] **ทีม login จริงได้ตาม role** — login `signInWithPassword` + error ไทย (`(auth)/login/page.tsx:24-37`) · logout จริง (`user-menu.tsx:22`) · จัดการ user ครบวงจรถึง Supabase ban (`user.ts:87-226`)
- [x] **auth context ถูก + fail-closed** — `trpc.ts:14-33` lookup ด้วย `supabaseId` + เช็ค `isActive` · dev-OWNER fallback ตัดทิ้งแล้ว (Supabase ล่ม = ไม่มี session ไม่หลุดเป็น OWNER)
- [x] **`requireRole` ครอบ 27/31 routers** — 4 ที่เหลือ = public token routers โดยเจตนา (customer-status/customer-upload/design.getByToken/quotation-confirm) ⚠️ หนี้ตาม: rate-limit endpoints เหล่านี้ (go-live gate v2 ข้อ 7)
- [x] **ยอดเงินทดสอบตรงทุกเส้นทาง** — invariant การเงินผ่าน (ดู §💰)
- [x] **มี migration history** — `prisma/migrations` 25 ก้อน (baseline `0_init` + ใช้ `migrate dev` จริง · เลิก db push แล้ว)
- [x] **`prisma/seed.ts` รันผ่าน** — master data idempotent (ServiceCatalog 25) แยกจาก demo แล้ว (P0.3 2026-06-10) ⚠️ MINOR: เทียบด้วย findFirst ไม่มี unique constraint — รันแข่งกันได้แถวเบิ้ล
- [x] **test แกน** — vitest 236 เคส ครอบ pricing/status/เลขเอกสาร/payment-plan/receivables ฯลฯ ⚠️ ช่องว่าง: billing.recordPayment/void ยังอยู่ใน router ไม่มี unit test + กลุ่ม stock/ผลิต (garment-pick/goods-receipt/qc/print-run) = 0 test

## 🚦 Go-live gate v2 — ต้องผ่านก่อนใช้จริง (audit 2026-07-02 · ใบงาน = ROADMAP.md Gate A+B · รายงานเต็ม: bestos `records/projects/anajak-erp/audit-2026-07-02.md`)
- [x] **เงินก้อนเดียวบันทึกซ้ำไม่ได้** — recordPayment: CN ห้ามรับเงิน · REC รับได้เฉพาะขายสดตรงไม่มีใบเรียกเก็บ (Gate A1 2026-07-02 · billing.ts recordPayment guard + UI ปุ่มตรงเงื่อนไข + sweep OVERDUE กรองเฉพาะใบเรียกเก็บ)
- [x] **ต้นทุน/กำไรไม่รั่วถึง role หน้างาน** — order.getById ตัด cost/payments/ทุน outsource ตาม role + billing.listByOrder gate + การ์ดบิลซ่อนจากช่าง (Gate A2 2026-07-02 · lib/roles.ts)
- [x] **ใบลดหนี้/เพิ่มหนี้ครบองค์กฎหมาย ม.86/10 + CN หักยอดค้างจริง** — ผูกใบเดิม+เหตุผลบังคับ · หักยอดค้างทุกเส้นทาง · ใบพิมพ์ครบองค์ (Gate B1 2026-07-02) ⚠️ activation: เบสรัน `npx prisma migrate deploy` (additive) + restart dev
- [x] **VAT default 7%** — ออเดอร์ default 7 · marketplace (ราคารวม VAT) default 0 · ใบเสนอมีปุ่มลัด (Gate B2 2026-07-02 · เบส confirm จด VAT)
- [x] **tax point จ้างทำของบังคับได้จริง** — ใบเสร็จ/ใบกำกับผูกงวดรับเงิน (1 งวด 1 ใบ · ยอดเท่าเงินรับ · issueDate = วันรับเงินจริง) + UI เตือนงวดค้างออกใบ (Gate B3 2026-07-02 · verify:terms 21/21)
- [x] **QC เชิงนับ bypass ไม่ได้** — ทางเข้า PACKING มีสองทางและปิดครบทั้งคู่ (Gate B4 2026-07-02 · audit โค้ดจริง 2026-08-15): กดมือผ่าน `order.updateStatus` เช็ค `qcRecord.count === 0 → badRequest` ใต้ `$transaction` เดียวกับ transition จึง rollback ทั้งก้อน (`order.ts:1291-1301`) · อีกทางคือ `qc.create` นับดีครบแล้ว `advanceOrderForward(onlyFrom:["QUALITY_CHECK"])` ซึ่งมี QcRecord อยู่แล้วโดยนิยาม (`services/qc.ts:218-228`) ⚠️ หนี้ค้างจาก B4: ส่งของจริงผ่านใบส่งขณะ QUALITY_CHECK ยังทำได้ทาง API ตรง (UI ทำไม่ได้) — ปิดต้องเคาะ semantics ใบส่งกับเบสก่อน
- [ ] **โครงพื้นฐาน production** — CI (lint+tsc+vitest) · backup/PITR + retention 5 ปี (Supabase audit จริง: bucket private/RLS) · rate-limit public token endpoints + security headers · env validate ตอน boot · ลบ lockfile ซ้ำ
- [ ] **รายงานภาษีขายรายเดือน export ได้** (มติตัด GL ยืนบนข้อนี้) + **นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรันจากเอกสารพิมพ์จริง**
- [ ] **แก้ข้อมูลลูกค้าจาก UI ได้ + ลูกค้าเกิน 50 รายมองเห็น** (B2B เครดิตเทอมแก้ taxId/วงเงินไม่ได้ = สร้างซ้ำแน่)
- [ ] **หน้า /settings ไม่มีฟอร์มปลอม** (ตอนนี้ 4 section ปุ่มบันทึกไม่ทำอะไร — ทำลายความเชื่อใจระบบ)
- [ ] **walkthrough ของจริงกับทีม + นักบัญชีเห็นเอกสารเงินพิมพ์จริง 1 รอบ** (audit UX ทำจากโค้ด ยังไม่เคยเปิดจอจริง)

## 💰 ความถูกต้องข้อมูล (invariant — verified audit 2026-06-19 ผ่านทั้ง 5)
- [x] **เงิน = Decimal(12,2) ทุก field เงิน ไม่มี Float** — Order/Invoice/Payment/WhtCertificate/OrderItem* ประกาศ `@db.Decimal(12,2)` · คำนวณผ่าน `Prisma.Decimal` (`money.ts` round2 half-up) · Decimal→number ที่ขอบเดียว (`lib/prisma.ts:16-82`) · Float ที่เหลือเป็น non-money มี comment กำกับ (profitMargin %, quantity, width/height) · ⚠️ sharp-edge: aggregate `_sum` ต้องเรียก `aggToNumber` เอง (money.ts:23)
- [x] **เลขเอกสารรันต่อเนื่อง ไม่สุ่ม** — `nextDocumentNumber()` (`document-number.ts:46-55`) upsert+increment บน `DocumentSequence` (unique [docType,period]) ใน `$transaction` เดียวกับ create · ทุกชนิด (ORD/INV-D/INV-F/REC/CN/DN/QT/BN/FR) · ⚠️ ถ้า import เอกสารเก่าต้อง seed lastNumber ก่อน
- [x] **status เปลี่ยนผ่าน `isValidTransition` ที่ server เท่านั้น** — `transitionOrder()` (`order-status.ts:38-92`) จุดเดียว: บังคับ valid + optimistic-lock กัน race + บันทึก `OrderRevision` · direct write `internalStatus` มีแค่ตอน create (documented) · ⚠️ ตรวจ `production.create`/`design.upload` ว่าไม่เขียน status ข้าม transition (P0.2)
- [x] **การเงินหลายขั้น = `$transaction` + row-lock** — billing create/recordPayment/voidInvoice/recordRefund ห่อ tx + `SELECT FOR UPDATE` (lockInvoiceRow/lockOrderRow) กันทะลุเพดานวางบิล/บันทึกซ้ำ (`billing.ts`)
- [x] **ใบกำกับ/ใบวางบิล ยกเลิก-ออกใหม่ ห้ามลบ** — ไม่มี `invoice.delete`/`billingNote.delete` ในโค้ด · ยกเลิก = soft-void (`isVoided`+`voidedReason`+`VOIDED`) + guard กัน void ซ้ำ + totalSpent หัก/คืนสมมาตร (`billing.ts:341-432`)

## 📋 Flow หลัก — เกณฑ์เสร็จต่อ flow (verified E2E audit 2026-06-19 · service+router+UI ครบ)
- [x] **สร้างออเดอร์** /orders/new → เลข `ORD-YYMM-NNNN` รัน + AuditLog (`order.ts:393-672`)
- [x] **ออเดอร์ CUSTOM 3 แหล่งเสื้อ** (FROM_STOCK/CUSTOM_MADE/CUSTOMER_PROVIDED) → ใบผลิตเสนอ step อัตโนมัติตามแหล่ง+printType (`production-steps.ts:221-252` + unit test)
- [x] **ยืนยันออเดอร์ READY_MADE/มีสต็อก** → จองสต๊อก Anajak Stock อัตโนมัติ + ด่านวงเงินเครดิต `assertSalesWithinCreditLimit` · จองพลาด → กระดิ่ง+retry (`stock-reservation.ts`)
- [x] **ใบเสนอราคา → แปลงเป็นออเดอร์** (กันซ้ำ) ผ่านลิงก์ public `/quote/<token>` accept→convert + ด่าน ACCEPTED/ไม่หมดอายุ (`quotation.ts:341-440`)
- [x] **customer portal (ไม่ต้อง login · token):** อนุมัติแบบ `/approve/design/<token>` · ติดตามสถานะ `/status/<token>` (read-only, ไม่รั่วราคา/ต้นทุน/internalStatus · `customer-status.ts:40-193`) · อัปโหลดไฟล์ `/upload/<token>` (signed, server เลือก path) ⚠️ P0.1: เพิ่ม token expiry + กันตัดสินซ้ำฝั่ง server
- [x] **outsource** ผูกขั้นผลิต → OutsourceOrder + step IN_PROGRESS (ล็อกแถว) → SENT→RECEIVED_BACK→QC (`outsource.ts:131-244`)
- [x] **ผลิต→QC→แพ็กสุดท้าย→พร้อมส่ง→ส่ง** → ผลิตครบทุกใบจึงเข้า QC · QC ของดีครบจึงเข้า PACKING · ใบส่งที่ไม่ถูกคืน+จำนวนแพ็กครบจึงเป็น READY_TO_SHIP · ออเดอร์เด้ง "จัดส่งแล้ว" เมื่อใบส่งครบ (แบ่งกล่องได้) · RETURNED → กระดิ่ง (`production.ts`/`qc.ts`/`delivery.ts`)
- [x] **goods receipt + print run (ฟิล์ม FR-) + คลังฟิล์ม** (`goods-receipt.ts`/`print-run.ts`/`film-stock.ts`) ⚠️ verify กันฟิล์มติดลบ (FilmStock.qty Int "ห้ามติดลบ")
- [x] **ออกบิล→ชำระ→WHT 50ทวิ อัตโนมัติ** เลขรัน + เพดานยอด (ใบแจ้งหนี้รวม ≤ ยอดออเดอร์) + นิติบุคคลหัก 3% สร้าง WhtCertificate (`billing.ts:86-339`)
- [x] **พิมพ์เอกสารภาษีจริง** ใบกำกับ ม.86/4 (ต้นฉบับ+สำเนา · void มีลายน้ำ) + quotation/billing-note/job-ticket/packing-list (`(print)/print/*`)
- [x] **วางบิลรวม + ลูกหนี้ aging + dunning** cron mark OVERDUE รายวัน (fail-closed CRON_SECRET · `billing-note.ts`/`overdue.ts`/`dunning.ts` + test)
- [x] **เชื่อม Anajak Stock + MCP** stockSync (test/sync/issue/receive) + `/api/mcp/[transport]` + cron ปลดจองค้าง ⚠️ ต้องตั้ง env เชื่อม Stock จริงถึง sync ได้

## 🚫 นอกขอบเขต (จงใจไม่ทำในรอบนี้ — กัน scope creep · ROADMAP.md:92-93 + plan.md)
- **GL/บัญชีแยกประเภท/งบการเงิน** — นักบัญชี+FlowAccount/PEAK ทำ · ERP ออกแค่เอกสารขาย/ใบกำกับ/50ทวิ + export CSV/Excel
- **job costing/ต้นทุนต่อออเดอร์** — เบสเคาะ 06-12: ต้นทุนเหมา คิดกำไรขาดทุนรายเดือนในระบบบัญชี · **ห้ามเพิ่มช่องเงิน/ต้นทุนใน flow ผลิต-outsource**
- **DTF auto-nesting** (RIP ทำ) · **online designer** (ลูกค้าคาดหวังดีไซเนอร์ช่วย) · **time-clock/payroll** (hr-platform-v2) · **WMS เต็ม/PR-PO-GRN** (Anajak Stock · ERP เชื่อมผ่าน /api/erp/*)
- **in-app chat** (LINE) · **ใบกำกับอย่างย่อ** (B2B เคลม VAT ไม่ได้) · mockup generator · CMMS · courier API booking · รายงาน ม.87(3) (อยู่ Anajak Stock)

## หมายเหตุขอบเขต (กันสับสน P0 vs P1+)
- **ภาษีเต็มรูป + WHT 2 ขา:** ขารับอยู่ P1 · ขาจ่าย outsource 3%+ภงด.53 อยู่ P2 (`ROADMAP.md:60,75,84`) · P0 ทำแค่ **tax-point rule ลง design + เผื่อ schema ตอนแตะ Decimal**
- **WHT ขาจ่าย/AP vendor** — เบสสั่ง "ทบทวนขอบเขตกับเบสก่อนเริ่ม" (plan.md:22) ไม่ใช่ทำเงียบ
- **Open decision:** ERP ออกใบกำกับเอง แต่ต้องให้นักบัญชีรีวิว template + เลขรันก่อนใช้กับลูกค้าจริง (plan.md:110)
