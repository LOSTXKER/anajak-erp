/* ============================================================
   ภาษาหน้าตาของ UI — นิยามที่เดียวของทั้งระบบ (เบสสั่ง 2026-08-01
   "ตรวจดีๆ ว่ามีอะไรไม่เป็นมาตรฐานบ้าง")

   คู่กับ control-size.ts ที่นิยาม "control สูงเท่าไร" — ไฟล์นี้นิยามที่เหลือ:
   มุมโค้งเท่าไร · วงแหวนตอนโฟกัสหน้าตายังไง · ผิวช่องกรอก/กล่องลอยเป็นแบบไหน

   ทำไมต้องมี: audit รอบนี้พบว่าของที่ทำหน้าที่เดียวกันมีหลายหน้าตา เพราะไม่มี
   ที่ให้ยึด — คนสร้างของใหม่จึงก๊อปจากตัวที่ "ดูใกล้เคียงที่สุด" แล้วค่าเพี้ยนสะสม
     · มุมโค้ง 4 ค่าใช้ปนกันไม่มีกฎ (lg 58 ไฟล์ · xl 61 · 2xl 51 · full 48)
     · กล่องลอย 15 จุดเขียนสูตรผิวเอง 5 แบบ — มุมโค้ง lg/xl/2xl ปนกัน
       บางจุดใส่ขอบ+พื้นซ้ำทั้งที่ .overlay-surface ให้มาแล้ว
     · วงแหวนโฟกัส 3 สูตร ทั้งที่มีแค่ 2 ความหมาย (ช่องกรอก vs ปุ่ม)

   เป็นค่าคงที่ TypeScript ไม่ใช่ CSS class ด้วยเหตุผลเดียวกับ control-size.ts:
   คลาสของเราจะอยู่หลัง utilities ของ Tailwind เสมอ ถ้าทำเป็น CSS จะชนะ className
   ที่ส่งมาแล้ว override ไม่ได้ · เก็บเป็น string แล้วให้ cn()/twMerge จัดการแทน
   ============================================================ */

/* ------------------------------------------------------------
   มุมโค้ง — 4 ระดับ เลือกจาก "ของชิ้นนั้นใหญ่แค่ไหน" ไม่ใช่จากความชอบ
   ยิ่งกล่องใหญ่ มุมยิ่งต้องโค้งมาก ไม่งั้นจะดูแข็ง · กลับกันของชิ้นเล็ก
   ถ้าโค้งมากจะกลายเป็นเม็ดยา
   ------------------------------------------------------------ */
export const RADIUS = {
  /** 8px — ชิ้นเล็กในรายการ: ตัวเลือกในเมนู · ปุ่มในแถบสลับ · แถบโครงร่างตอนโหลด */
  item: "rounded-lg",
  /** 10px — ช่องกรอก/ช่องเลือก/กล่องข้อความ (เบสเคาะ 2026-08-03 รอบ "ปรับสัดส่วน")
   *  เดิมช่องกรอกใช้ 16px เท่าการ์ด — สูง 36px แต่โค้ง 16px = โค้งเกือบครึ่งความสูง
   *  จึงดูเป็น "เม็ดยา" และทำให้การ์ด/กล่องย่อย/ช่องกรอกโค้งเท่ากันหมด 69 จุดบนจอเดียว
   *  จนสายตาอ่านลำดับชั้นไม่ออก · ตอนนี้เป็นบันได การ์ด 16 › กล่องย่อย 12 › ช่องกรอก 10 › ชิ้นเล็ก 8 */
  field: "rounded-[10px]",
  /** 12px — กล่องย่อยที่ซ้อนอยู่ในการ์ด · รูปย่อ · ป้ายสี่เหลี่ยม */
  inner: "rounded-xl",
  /** 16px — ของชิ้นใหญ่: การ์ด · ส่วน · ช่องกรอกทรงเหลี่ยม · กล่องเด้ง · เมนูที่กางออกมา */
  surface: "rounded-2xl",
  /** เต็ม — ของทรงแคปซูล: ปุ่ม · ชิปตัวกรอง · ช่องค้นหา · สวิตช์ */
  pill: "rounded-full",
} as const;

/** ทรงของ control — pill ใช้ในแถบเครื่องมือให้เข้าชุดกับปุ่ม (เบสสั่ง 2026-07-31
 *  หลังเห็นจอจริงว่าปุ่มโค้งเต็มแต่ช่องเลือกข้างกันโค้งแค่ 16px) · box คือฟอร์มกรอกข้อมูล
 *
 *  อยู่ที่นี่ไม่ได้อยู่ในไฟล์ช่องเลือกแล้ว — ของเดิม input.tsx ต้อง import จาก
 *  native-select.tsx ทั้งที่ไม่เกี่ยวกัน ถ้าไฟล์นั้นถูกลบช่องกรอกทั้งระบบพัง */
export type ControlShape = "box" | "pill";
export const controlShapeClass = (shape: ControlShape = "box") =>
  shape === "pill" ? RADIUS.pill : RADIUS.field;

/* ------------------------------------------------------------
   วงแหวนตอนโฟกัส — มี 2 ความหมายเท่านั้น ห้ามคิดแบบที่ 3
   ------------------------------------------------------------ */

/** ช่องที่ "พิมพ์ลงไปได้" — ช่องกรอก · กล่องข้อความ · ช่องเลือก
 *  เส้นขอบเปลี่ยนเป็นน้ำเงิน + เรืองจางๆ รอบนอก (เบาเพราะเคอร์เซอร์บอกตำแหน่งอยู่แล้ว) */
export const FOCUS_FIELD =
  "focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:focus-visible:border-blue-300 dark:focus-visible:ring-blue-300/25";

/** ของที่ "กดแล้วเกิดอะไรขึ้น" — ปุ่ม · ชิป · สวิตช์ · ปุ่มในแถบสลับ · แถวที่กดได้
 *  วงแหวนชัดกว่า + เว้นช่องว่างรอบตัว เพราะไม่มีเคอร์เซอร์ช่วยบอกว่าอยู่ตรงไหน
 *
 *  audit สี 2026-08-02 แก้ 2 เรื่อง (ครอบปุ่มทั้งระบบ 347 จุด):
 *  ① วงแหวนเคยเป็นสีน้ำเงินจาง 40% — คนที่ใช้คีย์บอร์ดไล่ Tab แทบไม่เห็นว่าอยู่ปุ่มไหน
 *  ② ช่องว่างรอบวงแหวนเคยล็อกเป็นขาว/ดำสนิทตายตัว — พอพื้นเว็บเปลี่ยนเป็นขาว/ดำเทา
 *     โหมดมืดเลยได้ "แถบดำคาด" รอบปุ่ม · ผูกกับสีพื้นจริงแทน จะได้เปลี่ยนตามทุกครั้ง */
export const FOCUS_BUTTON =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:focus-visible:ring-blue-400";

/** ของที่กดได้แต่เต็มพื้นที่จนไม่มีที่ให้เว้นขอบ — หัวคอลัมน์ตาราง · แถวในรายการ
 *  ใช้วงแหวนด้านใน เพราะ ring-offset จะโดนขอบตารางบังจนมองไม่เห็นว่าโฟกัสอยู่ไหน */
export const FOCUS_INSET =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300";

/** ช่องที่กรอกผิด — วงแหวนแดงแทนน้ำเงิน (ใช้คู่กับ border-red-* บนตัวช่อง)
 *  ของเดิมเขียนเอง 4 แบบไม่ตรงกัน: ring-red-400 · ring-red-500 · ring-red-500/40 · ring-amber-400
 *  ทั้งที่หมายถึงเรื่องเดียวกัน — ความเข้มต่างกันทำให้ "ผิดแรงไม่เท่ากัน" โดยไม่มีเหตุผล */
export const FOCUS_FIELD_INVALID =
  "focus-visible:outline-none focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/30";

/* ------------------------------------------------------------
   ผิวของพื้นผิวแต่ละแบบ
   ------------------------------------------------------------ */

/** ผิวช่องกรอก/ช่องเลือก/กล่องข้อความ — light เป็นขาว, dark เป็น neutral gray จมลง
 *  ขอบ field-border แยกจากขอบการ์ดโดยตั้งใจและผ่าน 3:1 กับ surface ทั้งสองธีม */
export const FIELD_SURFACE =
  "border border-field-border bg-field text-strong placeholder:text-placeholder";

/** ช่องกรอกบรรทัดเดียวที่ยืนลำพัง — กว้างเท่า 1 คอลัมน์ของกริด 2 ช่อง (ขอบขวาตรงกับ
 *  ช่องที่อยู่เหนือมันพอดี) · เดิมยืดเต็มการ์ด 976px = กว้างกว่าข้อความที่จะพิมพ์ 5 เท่า
 *  แล้วจบแบบไม่ตรงกับอะไรเลย (เบสเคาะ 2026-08-03 รอบ "ปรับสัดส่วน")
 *  ไม่ใช้กับ: กล่องข้อความหลายบรรทัด · ตาราง · ช่องที่อยู่ในกริดอยู่แล้ว */
export const FIELD_MEASURE = "max-w-[calc(50%-0.5rem)]";

/** กล่องย่อยที่จมลงไปในการ์ด (กลุ่มฟอร์ม · แถบสรุป)
 *  ช่องกรอกเป็นพื้นขาว+ขอบ มองเห็นบนแผงเทาได้เอง — ไม่ต้องมีกลไกสลับสีอีก */
export const SUNK_PANEL = "bg-surface-muted";

/** ของที่กดได้ตอนชี้ — คนละชั้นกับ SUNK_PANEL เสมอ
 * แยก hover/pressed คนละ token เพื่อให้แถวที่ใช้แค่ช่วยไล่สายตาไม่หลอกว่ากดได้ */
export const INTERACTIVE_HOVER =
  "hover:bg-interactive-hover hover:text-strong dark:hover:bg-interactive-hover dark:hover:text-strong";

/** feedback ตอนกำลังกด — compose เฉพาะ element ที่มี action จริง */
export const INTERACTIVE_PRESSED =
  "active:bg-interactive-pressed active:text-strong dark:active:bg-interactive-pressed dark:active:text-strong";

/** ของที่กำลังถูกเลือก — เข้มกว่า hover แต่ยังไม่แย่งปุ่ม action หลัก */
export const INTERACTIVE_SELECTED =
  "bg-interactive-selected text-interactive-selected-text";

/** กล่องที่ลอยขึ้นมาทับเนื้อหา — เมนู · ปฏิทิน · ตัวกรอง · กล่องเด้ง
 *  .overlay-surface (globals.css) ให้ทั้งพื้นและเงามาแล้ว — ห้ามใส่ bg-white/border ซ้ำ
 *  ของเดิม 6 จุดใส่ซ้ำ ทำให้ในโหมดมืดได้ขอบสว่างซ้อนเงา และมุมโค้งไม่ตรงกัน */
export const OVERLAY_PANEL = `overlay-surface ${RADIUS.surface}`;

/** หัวตารางที่วางบน surface ปกติ — semantic ชุดเดียวทั้งสองธีม */
export const TABLE_HEAD_SURFACE =
  "border-b border-divider bg-surface text-muted";

/** ขอบประ = "ที่ว่างรอของ" — ปุ่มเพิ่มของ · ช่องอัปโหลด · กล่องว่างที่กดเพิ่มได้
 *  audit 2026-08-01: 21 จุดใช้ slate-200 สลับ slate-300 โดยไม่มีเหตุผล
 *  และครึ่งหนึ่งลืมใส่สีโหมดมืด → ขอบหายไปเลยบนพื้นดำ */
export const DASHED = "border border-dashed border-border-strong";

/** ตัวเลือกหนึ่งบรรทัดในเมนูที่กางออกมา — สถานะชี้/ถูกเลือก/กดไม่ได้ ชุดเดียวกันทุกเมนู */
export const MENU_ITEM =
  "relative flex cursor-pointer select-none items-center justify-between gap-2 px-3 text-sm outline-none data-[highlighted]:bg-interactive-hover data-[highlighted]:text-strong data-[state=checked]:bg-interactive-selected data-[state=checked]:font-medium data-[state=checked]:text-interactive-selected-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** เส้นคั่นในเมนูที่กางออกมา — เดิมเขียนซ้ำคำต่อคำ 4 จุด (เมนูโปรไฟล์ 2 · เมนู "…" ของออเดอร์ 2)
 *  โหมดมืดเคยใช้ slate-800 ซึ่งเข้มกว่าพื้นกล่องลอย = เส้นหายไปเลย
 *  ผลคือเส้นเหนือ "ออกจากระบบ" / "ยกเลิกออเดอร์" ไม่มี — เพิ่มโอกาสกดพลาดของอันตราย */
export const MENU_SEPARATOR = "my-1 h-px bg-divider";

/**
 * สีกล่องแจ้งเตือน 5 ระดับ — **แยกออกมาจาก <Alert> โดยตั้งใจ**
 * (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไรไม่เป็นมาตรฐาน")
 *
 * audit เจอกล่องสีเขียนเอง 47 จุด · 23 จุดเป็นข้อความล้วน → ใช้ <Alert> ได้ตรงๆ
 * แต่อีก 8 จุดมี **ปุ่ม/ช่องกรอกอยู่ข้างใน** ซึ่งยัดเข้า <Alert> ไม่ได้:
 * <Alert> ตั้ง role="alert" = พื้นที่ "ประกาศสด" ที่เครื่องอ่านหน้าจอจะขัดจังหวะ
 * ผู้ใช้เพื่ออ่านทันที — ของที่กดได้/โฟกัสได้ไม่ควรอยู่ในนั้น
 *
 * → จุดพวกนั้นหยิบแค่ "สี" ไปใช้ (`TINT.warning`) แล้ววาง layout เอง
 *   สิ่งที่เคยเพี้ยนคือเฉดสี ไม่ใช่ layout — แก้ตรงที่เพี้ยนพอ
 */
export const TINT = {
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  /** บอกเฉยๆ ไม่มีสัญญาณดี/ร้าย — เดิมเขียนเองด้วย slate-200/slate-50 เฉดไม่ตรงกัน */
  neutral:
    "border-border bg-surface-muted text-secondary",
} as const;

/* ------------------------------------------------------------
   จะกรองรายการด้วยอะไร — กติกาเดียวทั้งเว็บ (เบสเคาะ 2026-08-01 หลังไล่ดูทุกหน้า)

   audit เจอว่าหน้ารายการใช้ตัวกรอง **5 แบบ** ทั้งที่ทำงานเดียวกัน:
   ชิปกลม (ใบเสนอราคา · แจ้งเตือน · จ้างร้านนอก) · แถบสลับ (สินค้า · หัก ณ ที่จ่าย)
   · ดรอปดาวน์ (บิล · ลูกค้า) · ปุ่มตัวกรองลอย (ออเดอร์) · สวิตช์ (คลังฟิล์ม)
   → คนใช้ต้องเรียนรู้ใหม่ทุกหน้าว่า "หน้านี้กรองยังไง"

     ตัวเลือก ≤5     → <FilterChip>   ชิปกลม เห็นทุกตัวเลือกพร้อมกัน กดทีเดียว
     ตัวเลือก >5     → <Select shape="pill">  ชิปเกิน 5 ตัวจะล้นแถวบนมือถือ
     เปิด/ปิดอย่างเดียว → <FilterChip> ตัวเดียว (ไม่ใช่สวิตช์ — สวิตช์คือ "ตั้งค่า" ไม่ใช่ "กรอง")
     กรองหลายเงื่อนไขพร้อมกัน → <FilterPopover> (หน้าออเดอร์)

   <SegmentedControl> เหลือไว้ใช้ใน **ฟอร์ม** (เลือก 1 จากไม่กี่ตัว เช่นประเภทลูกค้า)
   ไม่ใช้กรองรายการ — มันดูเหมือนแท็บ คนจะนึกว่ากดแล้วเปลี่ยนหน้า
   ------------------------------------------------------------ */

/** ยอดเงินสรุป — สูตรเดียวทุกจุดที่โชว์ "ยอดจริง" (benchmark 2026-08-04:
 *  Stripe ใช้ display-amount สูตรเดียวจนคนจำได้ว่าเลขแบบนี้ = ยอดจริง
 *  ของเราเคยมี 4 หน้าตา: 16/20/20/24px + จุดหนึ่งเป็นสีน้ำเงิน)
 *  ป้ายกำกับใช้ DISPLAY_AMOUNT_LABEL คู่กันเสมอ */
export const DISPLAY_AMOUNT = "text-xl font-semibold tabular-nums text-strong";
export const DISPLAY_AMOUNT_LABEL = "text-xs text-muted";

/** label เบานอก <Field> — ใช้ในแถวตาราง/ช่องย่อยที่ Field เต็มตัวใหญ่เกิน
 *  (Field ยังเป็นทางหลักของฟอร์ม — ตัวนี้สำหรับ editable grid เท่านั้น)
 *  เดิม labelClass ถูกประกาศซ้ำ 3 ไฟล์ค่าไม่เท่ากัน (บางไฟล์ไม่มี font-medium) */
export const FIELD_LABEL =
  "mb-1 block text-xs font-medium text-muted";

/** สถานะ "ตัวกรองนี้เปิดอยู่" — ปุ่มช่วงวันที่ · ปุ่มตัวกรอง · ปุ่มเลือกหลายชิ้น
 *  audit 2026-08-01: สูตรนี้ถูกเขียนซ้ำคำต่อคำใน 2 ไฟล์ และมีอีกที่ใช้เฉดต่างกัน
 *  (blue-400/blue-900) ทั้งที่หมายถึงเรื่องเดียวกัน — คนอ่านหน้าจอเห็นว่า
 *  "กรองอยู่" ด้วยสีที่ไม่เท่ากันในแต่ละหน้า */
export const ACTIVE_FILTER =
  "border-blue-200 bg-interactive-selected text-interactive-selected-text hover:bg-interactive-selected hover:text-interactive-selected-text active:bg-interactive-selected active:text-interactive-selected-text dark:border-blue-800";
