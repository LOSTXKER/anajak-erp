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
- [x] **URL หลักมีหน้าตาเดียว** — `/` และ `/orders*` ใช้ dashboard/shell/order presentation ที่ผ่านการทดลองใน V2 · ไม่มี branch classic/V2 ใน component หลัก · `/v2*` เป็น compatibility redirect มายัง URL หลักและรักษา query เดิม
- [x] **เป็นของจริง ไม่ใช่ mockup** — อ่านข้อมูลจาก tRPC/service/permission ชุดเดิมและทุก action พาไป flow ที่ใช้งานได้จริง · ห้ามมีตัวเลข/รายการตัวอย่างเขียนค้างในหน้า
- [x] **จุดโฟกัสชัดใน 3 วินาที** — งานเสี่ยง/งานค้างและ action หลักมาก่อนสถิติสะสม · desktop Sidebar แสดงทุกโมดูลที่มีสิทธิ์เป็นหมวดตลอดโดยไม่ซ่อนใน disclosure ส่วนมือถือคงงานหลัก 4 รายการและเปิดที่เหลือผ่าน “เพิ่มเติม”
- [x] **ชุดสีเดียวทั้งระบบทั้งสองธีม** — ล็อกน้ำเงินแบรนด์ `#3973b2` ไว้ · Light ใช้ผืนเกือบขาว · Dark เป็น neutral gray เข้ม · page, chrome, card, sunk, field, overlay, border และข้อความทุกระดับอ่านลำดับเดียวกัน · semantic text ผ่าน WCAG AA · public/print ไม่ถูกธีมหลังบ้านรบกวน
- [x] **สถานะโต้ตอบชัดแต่ไม่เป็นแถบหนัก** — navigation/ขั้นสถานะ/clickable card ใช้ neutral surface hover ที่ขาวนวลและครอบ hit area จริง · pressed เข้มกว่า hover · selected/focus ใช้น้ำเงิน · disabled แยกชัด · ข้อความบนทุก state ผ่าน WCAG AA
- [x] **แถบบนเป็นผืนเดียวเต็มจอ** — chrome และเส้นคั่นของ navbar พาดเต็ม viewport รวมส่วนโลโก้เหนือ sidebar · เนื้อหา/เมนูยังเลื่อนแยกกันและ mobile bottom navigation ไม่ถอย
- [x] **ใช้ได้จริงหลายขนาดจอ** — 390px และ 1440px ไม่มี horizontal overflow · เป้ากดมือถือ ≥44px · sticky action ไม่ถูก bottom navigation ทับ · keyboard focus/ภาษาไทย/reduced-motion ใช้ได้ครบ
- [x] **สถานะและสิทธิ์ไม่โกหก** — loading/error/retry/empty แยกกัน · ข้อมูลเงินและเมนู gated ตาม permission เดิม · ทางเข้าฟอร์มเปิดงานทุกจุดใช้กติกาเดียวกันและ fail closed
- [x] **รายการออเดอร์เริ่มจากงาน ไม่เริ่มจากแผงสถานะ** — มือถือเห็นรายการหรือ empty/error ที่ลงมือทำได้ก่อน `y=600` · จอกว้างเห็น status rail ครบ · search/filter/sort/pagination/CSV ยังใช้งานจริง
- [x] **เปิดงานและรายละเอียดคง flow เดิม** — draft/validation/upload/`next=quote`/duplicate/status/เอกสาร/แท็บ URL+Back ผ่าน service/server guard เดิม · แท็บเป็น underline minimal และไม่เสีย ARIA/keyboard
- [x] **พื้นผิวแยกตามหน้าที่ ไม่กลืนกัน** — card/table/status rail เป็น surface สีขาวมีเงานุ่มและไม่มีกรอบตกแต่ง · field ในฟอร์มเป็นขาว Light/เข้ม Dark พร้อมเส้น resting อ่อนที่ไม่แข่งกับเนื้อหา · พื้นที่เพิ่ม/อัปโหลดใช้ขอบประอ่อนและค่อยเน้นตอน hover/focus · standalone toolbar/secondary action เป็น surface ยก · `surface-muted` สงวนให้โครงสร้างหรือ disabled · focus/error/selected ต้องชนะสถานะปกติอย่างชัดเจน
- [x] **รายการงานแยกเป็นการ์ดที่อ่านออกทันที** — หน้าเปิดงานและหน้าแก้ไขใช้หนึ่งรายการต่อหนึ่ง card ขาวไร้ขอบ · CTA “เพิ่มรายการ” อยู่เหนือ list และเห็นได้ก่อนเลื่อน · Light workspace เป็น off-white ที่ต่างจาก card ขาวเพียงเล็กน้อย โดยยังแยก hierarchy ได้ทั้ง desktop/mobile

## 🧩 UX integrity refactor (Impeccable audit 2026-08-13)
- [x] **โค้ด UI หลักมีบ้านเดียว** — shell/dashboard/order primitives ที่เป็น canonical ไม่ใช้ชื่อ V2 หลังเลื่อนขึ้นเป็นระบบจริงแล้ว · ถอด shell เก่าที่ไม่มี caller เพื่อกันแก้ผิดชุด
- [x] **แท็บโหลดเท่าที่ใช้** — หน้ารายละเอียดออเดอร์ mount/query เมื่อเปิดครั้งแรกแล้วรักษา state ของแท็บที่เคยเข้า · ฟอร์มเปิดงาน opt-in keep-mounted เพื่อไม่ทำข้อมูลที่พิมพ์ค้างหาย
- [x] **interaction ไม่โกหก** — ไม่มี interactive element ซ้อนกัน · ปุ่มล้าง/ปิดบนมือถือมีเป้ากด≥44px · สถานะที่ยังทำไม่ได้ไม่วาดเป็นปุ่ม · ป้าย action ห้ามถูกตัดจนเดาความหมายไม่ได้
- [x] **สิทธิ์และ deep link ชัดเจน** — order detail รอ permission ก่อนวาด action/แท็บ · query สิทธิ์พังเป็น error ระดับหน้า · ลิงก์ไปแท็บที่ไม่มีสิทธิ์ต้องบอกเหตุผลและกลับแท็บที่เข้าได้
- [x] **คิวผลิตสดพอสำหรับหลายคน** — `/production` โพลล์ข้อมูลและ refetch เมื่อกลับแท็บ ไม่พึ่งเฉพาะ mutation ของเครื่องตัวเอง
- [x] **กู้ร่างได้ตรงกับคำที่บอก** — `/orders/new` กู้ค่าหัวออเดอร์ เงื่อนไข ค่าใช้จ่าย ที่อยู่จัดส่ง และ metadata ไฟล์ที่อัปโหลดแล้ว · แยกตามผู้ใช้ มีอายุ 7 วัน ไม่เก็บ base64 preview และ debounce เก่าห้ามเขียนร่างกลับหลังสร้างสำเร็จ/reset

## 🎨 ม็อกอัพออเดอร์ (2026-08-22)
- [x] **หนึ่งเวอร์ชัน = หลายรูป** — ดีไซเนอร์แนบม็อกอัพหลายด้าน (หน้า/หลัง/แขน) ในเวอร์ชันเดียว ระบุตำแหน่งพิมพ์ต่อรูปได้ และลูกค้าอนุมัติทั้งชุดครั้งเดียว · เวอร์ชันก่อน migration ที่มีรูปเดียวต้องแสดงได้เหมือนเดิมทุกจอโดยไม่ต้อง backfill
- [x] **ม็อกอัพมีบ้านเดียว** — ตัวจัดการอยู่ที่หน้าออเดอร์แท็บ `ม็อกอัพ & ไฟล์` เท่านั้น · จอที่เหลือ (แท็บงานผลิต, `/production/[id]`, Station, ใบสั่งผลิต, ลิงก์ลูกค้า) อ่านอย่างเดียวและใช้ component/สูตรอ่านชุดเดียวกัน ห้ามยิง query ซ้ำหรือทำ UI จัดการซ้อน
- [x] **ลูกค้าเห็นครบก่อนตัดสิน** — ลิงก์อนุมัติแสดงทุกรูปในชุดขนาดใหญ่พร้อมป้ายบอกด้าน · ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ (`.ai/.psd/.pdf`) ต้องแนบรูปตัวอย่างก่อนส่ง มิฉะนั้นส่งชุดนั้นไม่ได้
- [x] **ทุกรูปในชุดเปิดได้ด้วย token เดียว** — `/api/files` อนุญาตครบทั้งชุดของเวอร์ชันนั้น โดย allowlist กว้างเท่าที่หน้าโชว์เท่านั้น (ลิงก์สถานะและใบงานร้านนอกยังโชว์รูปปกจึงไม่ขยายสิทธิ์)
- [x] **ฝ่ายผลิตเห็นภาพก่อนลงมือ** — คิวผลิตทุกแถวมีรูปม็อกอัพนำหน้า · `/production/[id]` มีแท็บม็อกอัพพร้อมสเปกรีดจากคลังลาย · Station และใบสั่งผลิตกระดาษแสดงครบทุกด้าน · ทั้งหมดไม่มีข้อมูลเงินและไม่มีปุ่มอนุมัติ

## 🏭 Factory surfaces + Station Mode (audit โค้ดจริง 2026-08-16)
- [x] **3 พื้นผิวแยกหน้าที่ชัด** — `/production` ยังอยู่ใน AppShell พร้อม sidebar/topbar เป็นบอร์ดหัวหน้า · `/factory/station` เป็นจอเต็มไม่มี sidebar/topbar ของ ERP · `/factory` เป็นทีวีคิวรวมแบบ read-only ที่ไม่มี action
- [x] **Station Mode มี 5 จุดทำงานจริง** — เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย · เมื่อเปิดงานต้องเห็นงานปัจจุบันนำและตัดงานนั้นออกจาก rail; คิวแยก **กำลังทำ / พร้อมถัดไป / ติดปัญหา** โดยงาน blocked แสดงเหตุจริงแต่ห้ามปนเป็นงานที่กดลงมือได้
- [x] **จบขั้นแล้วตามออเดอร์เดิมต่อได้** — เมื่อบริบทที่เปิดอยู่หลุดจากสถานีเดิมหลังบันทึกสำเร็จ Station ต้องเสนอ current/ready ของ production เดิมก่อน แล้วค่อย production/order เดียวกัน; หลาย lane ต้องให้เลือก, blocked ต้องแสดงเหตุจริง, งานนอก/CUSTOM/owner อื่นต้องหยุดและส่ง ERP แทนการเดา · การกด handoff เปลี่ยนเฉพาะบริบท/สถานี ห้าม claim, start หรือ complete อัตโนมัติ · DTF ready เปิด batch workspace และโฟกัส exact งานเดิมเพียงครั้งเดียว
- [x] **สแกนเปิด context เท่านั้น** — รับเลขออเดอร์/QR จาก ERP แล้วเปิดใบผลิตหรือบริบทออเดอร์ที่ตรงกัน · หลายใบผลิตต้องให้คนเลือก · การสแกนห้ามเริ่ม ปิด หรือเดินสถานะเอง
- [x] **flow หลังผลิตมีทางเดียว** — ผลิตจริงครบ → `QUALITY_CHECK` นับของดี/เสียครบ → `PACKING` นับแพ็กผ่านใบส่ง → `READY_TO_SHIP` เมื่อมีหลักฐานและจำนวนครบ · `PACKAGING` เป็นเพียง compatibility ของใบเก่า ห้ามสร้าง/อัปเดตเป็นขั้นแพ็กของ flow ใหม่
- [x] **สิทธิ์ตรงกับ server จริง** — ทุกจอ factory ต้อง login · ผู้ไม่มี `manage_production` เห็น Station แบบดูอย่างเดียว · การสร้างใบส่งต้องมี `manage_production` + `manage_delivery` · ยืนยันพร้อมส่งต้องมี `manage_production` + `update_order_status_production` · `supervise_operations` จึงเห็นงานข้ามผู้รับผิดชอบ
- [x] **Station ไม่รับและไม่วาดเงิน** — `factory.stationQueue`, scan/context, ใบผลิต รอบพิมพ์ QC และ pack context ส่งเฉพาะข้อมูลหน้างาน · Station ไม่ mount การ์ดวัตถุดิบที่มีต้นทุน ไม่ส่ง readiness ด้านชำระเงิน และซ่อน/ไม่ส่งค่าจัดส่งในฟอร์มแพ็ก
- [x] **ข้อมูลและ state ไม่โกหก** — Station ใช้ `factory.stationQueue/stationQueueContext/resolveStationScan/stationContext`, `production.getById`, `printRun.queue/list`, QC/pack endpoints และ `user.me` จริง · selected context อ่านตรงไม่ติดเพดานคิวรวม 200 งาน, ไม่มีเงินโดย DTO และ sync ใหม่หลังคิวเปลี่ยน · โพลล์ 30 วินาที · แยก initial loading/error/empty กับ background-stale และ mutation ทุกก้อนยังผ่าน service/guard เดิม
- [x] **สต๊อก local สำหรับทดลองไม่แตะระบบหลัก** — `dev:demo` ใช้เฉพาะฐาน `127.0.0.1:5433/anajak_erp_demo` และสินค้า `DEMO-*`; จอง/เบิก/คืน/ยอดคงเหลือ/ledger เปลี่ยนใน transaction เดียวพร้อมกันยอดจองงานอื่น · เปิด writer ได้เมื่อ flag+ฐานตรงทั้งคู่, ไม่มี Stock credential, ไม่มี Sync/API field และ outbound request ถูกปิดก่อน fetch

## 🧭 Production UX2 — ERP production operations ที่ใช้ทำงานจริง (เบสสั่งรื้อ 2026-08-16)
- [x] **หนึ่งบทบาทมีหนึ่งคำถามหลัก** — `/production` ตอบ “งานไหนต้องจัดการก่อน” · `/factory/station` ตอบ “สถานีนี้กำลังทำอะไรและงานถัดไปคืออะไร” · `/factory` ตอบ “โรงงานติดตรงไหน” โดยไม่ยก presentation เดียวกันไปใช้ทั้งสามจอ
- [x] **หัวหน้าใช้ worklist ไม่ใช่กองการ์ดซ้ำ** — `/production` แสดงหนึ่งออเดอร์ต่อหนึ่งแถว มองเห็นจุดปัจจุบันทั้งหมด กำหนดส่ง ความเสี่ยง ความคืบหน้า และทางเปิดงานที่ถูกต้อง · งานเดียวห้ามโผล่ซ้ำหลายคอลัมน์จนดูเหมือนหลายออเดอร์ · ตัวกรอง `ต้องจัดการ / กำลังผลิต / รอ QC / รอแพ็ก / ทั้งหมด` และจำนวนต้องมาจากข้อมูลชุดเดียวกัน
- [x] **production family ไปมาง่ายแบบโมดูล ERP เดียว** — `/production`, `/production/print-runs`, `/production/films` และ `/outsource` มี local navigation/ชื่อ/ลำดับเดียวกันใต้ `AppShell`; ทางไป Station และ TV ชัดแต่ไม่สร้าง sidebar ฝ่ายผลิตชุดที่สอง
- [x] **Station เห็นงานก่อนเครื่องมือค้นหา** — เลือกสถานีครั้งเดียวจาก control เดียวแล้วคงใน URL · เปิดสถานีแล้วเห็น “กำลังทำ” ก่อน “พร้อมทำ” และ scan/search เป็นทางลัดขนาดกระชับ · ห้ามมีแถบเลือกสถานีกับการ์ดเลือกสถานีซ้ำ ห้าม mount หน้า ERP เต็มซ้อนใน Station และหนึ่งบริบทมี primary action เดียวตาม station/status
- [x] **ใบผลิตแยก Control ออกจาก Execution** — ERP `/production/[id]` เป็น exception control record ที่ให้เลขงาน/สถานะ/deadline นำ แล้วเห็น attention, actual, owner รายขั้น, blocker, readiness, handoff และหลักฐานทั้งใบ; ค่าที่ยังไม่มีในข้อมูลจริงห้ามสร้างค่าเดา และ default surface ต้องซ่อน field ที่ใช้ตัดสินใจไม่ได้หรืออธิบายความไม่ครบด้วยภาษาผู้ใช้แบบข้อความรอง ไม่ใช้ป้าย data-gap ของทีมพัฒนา · งานร้านนอกที่ยัง active และเลย `expectedBackAt` ต้องเป็น warning attention ก่อนสถานะ `IN_PROGRESS` ทั่วไป · routine action ได้แก่เบิก/รับเสื้อ เริ่ม บันทึกจำนวน และ complete อยู่ที่ Station ตาม work center; ERP default เหลือมอบหมาย/แก้ exceptionและห้ามคืน routine fallback เมื่อ operation ยังขาด parity — ให้แสดง read-only/ส่งต่อ Phase ถัดไปแทน · compatibility inventory deep link อนุญาตเฉพาะ supervisor recovery ที่มี audit ไม่ใช่งานประจำสถานี · Station แสดง current job หนึ่งงานพร้อมหนึ่ง primary action, `แจ้งปัญหา`, rail พร้อม/blocked และ scan โดยไม่ mount inspector/MaterialUsage หรือข้อมูลเงิน · boundary สำคัญต้องบังคับฝั่ง server จาก step/order/permission จริง ไม่เชื่อ station/source ที่ client ส่งมา
- [x] **TV ตรงกับ flow 5 จุด** — `/factory` เป็นจออ่านอย่างเดียวหนึ่ง viewportเรียง เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย · แยก exception ด่วน, งานกำลังทำ, จำนวนคิว และงานถัดไป · ห้ามรวม QC กับแพ็กหรือแพ็กกับส่ง และข้อมูลเก่าต้องมี timestamp/stale warning
- [x] **หน้าย่อยคง business truth เดิม** — print run, film stock, outsource, QC และ final pack ใช้ query/mutation/permission/transition เดิม · flow บังคับ production → QC → final pack → ready · scan เปิดบริบทเท่านั้น · ไม่มีเงินบน Station/TV และไม่สร้าง mock/example path
- [x] **จอเป้าหมายและ state ผ่านจริง** — desktop 1440×900 และ touch 1024×768 ใช้งาน primary flow โดยไม่เลื่อนแนวนอน เป้ากด coarse ≥44px · keyboard/focus/label/contrast/reduced-motion ผ่าน · loading/error/retry/empty/read-only/blocked/background-stale แยกกัน · browser ไม่มี hydration/console error · typecheck/lint/unit/`verify:ui`/build ผ่าน

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
