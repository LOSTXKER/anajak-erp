// "ขั้นถัดไปที่แนะนำ" ของออเดอร์ — จุดโฟกัสเดียวบนหน้าออเดอร์
// ระบบเป็นคนจำว่างานนี้ขาดอะไร/ต้องทำอะไรต่อ ไม่ใช่ให้คนไล่เดาเอาจากการ์ด 8 ใบ

export interface NextStepInput {
  internalStatus: string;
  orderType: string; // READY_MADE | CUSTOM — ใช้เลือกปลายทางตอนเปิดงานจากร่าง
  itemCount: number;
  totalAmount: number;
  paymentTerms: string | null;
  // มีบิลมัดจำ/ใบแจ้งหนี้ (ไม่ void) แล้วหรือยัง
  hasInvoice: boolean;
  // มีแบบรอลูกค้าตัดสิน (PENDING) อยู่ไหม / มีแบบที่อนุมัติแล้วไหม
  hasPendingDesign: boolean;
  hasApprovedDesign: boolean;
  hasProduction: boolean;
  // มีใบส่งในระบบแล้วหรือยัง — ตัวตัดสินทางตอนพร้อมส่ง (สร้างใบส่ง vs กดส่งแล้ว)
  hasDelivery: boolean;
  // วางบิล/ออกใบเสร็จครบยอดหรือยัง (นิยามเดียวกับด่านปิดงาน)
  billingHandled: boolean;
}

export type NextStepAction =
  | { type: "EDIT_ITEMS" }
  | { type: "STATUS"; to: string }
  | { type: "ANCHOR"; target: "billing" | "design" | "production" | "delivery" | "qc" }
  | { type: "NONE" };

export interface NextStep {
  title: string;
  description: string;
  buttonLabel?: string;
  action: NextStepAction;
}

const DEPOSIT_TERMS = ["DEPOSIT_30", "DEPOSIT_50", "FULL_PREPAY"];

export function getOrderNextStep(o: NextStepInput): NextStep | null {
  if (o.internalStatus === "CANCELLED") return null;
  if (o.internalStatus === "COMPLETED") return null;

  if (o.internalStatus === "DRAFT") {
    // ร่างเดินได้ทางเดียวคือสถานะแรกของเส้นทางตามชนิด (state machine บังคับ)
    return {
      title: "งานยังเป็นร่าง",
      description: "ข้อมูลครบเมื่อไหร่กดเปิดงานเพื่อเริ่มเดินสถานะ",
      buttonLabel: "เปิดงาน",
      action: {
        type: "STATUS",
        to: o.orderType === "READY_MADE" ? "CONFIRMED" : "INQUIRY",
      },
    };
  }

  // ยังไม่มีรายการ = ยังตีราคาไม่ได้ — ทุกอย่างรอข้อนี้
  if (o.itemCount === 0) {
    return {
      title: "ใส่รายการสินค้าและตีราคา",
      description: "งานนี้ยังไม่มีรายการ/ราคา — ใส่ก่อนถึงจะยืนยันออเดอร์ได้",
      buttonLabel: "ใส่รายการสินค้า",
      action: { type: "EDIT_ITEMS" },
    };
  }

  if (o.internalStatus === "INQUIRY") {
    return {
      title: "รอลูกค้าตกลง → ยืนยันออเดอร์",
      description: `ยอดรวม ${o.totalAmount.toLocaleString("th-TH")} บาท — ลูกค้าตกลงแล้วกดยืนยันเพื่อเริ่มงาน`,
      buttonLabel: "ยืนยันออเดอร์",
      action: { type: "STATUS", to: "CONFIRMED" },
    };
  }

  if (o.internalStatus === "CONFIRMED") {
    // เทอมมัดจำ/จ่ายล่วงหน้า → เก็บเงินก่อนเริ่มงาน
    if (DEPOSIT_TERMS.includes(o.paymentTerms ?? "") && !o.hasInvoice) {
      return {
        title: "เรียกมัดจำก่อนเริ่มงาน",
        description: "เงื่อนไขชำระของงานนี้ต้องเก็บมัดจำ — สร้างบิลมัดจำแล้วส่งให้ลูกค้า",
        buttonLabel: "ไปที่การ์ดบิล",
        action: { type: "ANCHOR", target: "billing" },
      };
    }
    // สำเร็จรูป (เสื้อเปล่า) ไม่มีขั้นออกแบบ — เข้าคิวผลิตตรง (state machine ก็ไม่ยอมทางอื่น)
    if (o.orderType === "READY_MADE") {
      return {
        title: "ส่งงานเข้าคิวผลิต",
        description: "งานสำเร็จรูปไม่ต้องผ่านขั้นออกแบบ — เข้าคิวหยิบ/แพ็คได้เลย",
        buttonLabel: "เข้าคิวผลิต",
        action: { type: "STATUS", to: "PRODUCTION_QUEUE" },
      };
    }
    return {
      title: "ส่งงานเข้าขั้นถัดไป",
      description: "งานพิมพ์ → ส่งเข้าออกแบบ · มีไฟล์พร้อมแล้ว → เข้าคิวผลิตได้เลย",
      buttonLabel: "ส่งเข้าออกแบบ",
      action: { type: "STATUS", to: "DESIGNING" },
    };
  }

  if (o.internalStatus === "DESIGNING") {
    if (!o.hasPendingDesign && !o.hasApprovedDesign) {
      return {
        title: "อัปโหลดแบบให้ลูกค้าดู",
        description: "ยังไม่มีไฟล์แบบ — อัปโหลดแล้วระบบจะสร้างลิงก์ให้ลูกค้ากดอนุมัติเอง",
        buttonLabel: "ไปส่วนงานออกแบบ",
        action: { type: "ANCHOR", target: "design" },
      };
    }
    return {
      title: "รอลูกค้าตัดสินแบบ",
      description: "ส่งลิงก์อนุมัติให้ลูกค้าทาง LINE ได้จากส่วนงานออกแบบ — ลูกค้ากดแล้วทีมได้กระดิ่ง",
      buttonLabel: "ไปส่วนงานออกแบบ",
      action: { type: "ANCHOR", target: "design" },
    };
  }

  if (o.internalStatus === "DESIGN_APPROVED") {
    return {
      title: "แบบผ่านแล้ว — เปิดใบผลิต",
      description: "กำหนดขั้นตอนผลิต (ระบบแนะนำตามวิธีพิมพ์ให้) แล้วงานจะเข้าคิวทันที",
      buttonLabel: "ไปส่วนการผลิต",
      action: { type: "ANCHOR", target: "production" },
    };
  }

  if (["PRODUCTION_QUEUE", "PRODUCING"].includes(o.internalStatus)) {
    if (!o.hasProduction) {
      return {
        title: "เปิดใบผลิต",
        description: "งานอยู่คิวผลิตแต่ยังไม่มีใบผลิต/ขั้นตอน",
        buttonLabel: "ไปส่วนการผลิต",
        action: { type: "ANCHOR", target: "production" },
      };
    }
    return {
      title: "กำลังผลิต — อัปเดตขั้นตอนตามจริง",
      description: "พิมพ์เสร็จ/รีดเสร็จ ติ๊กขั้นตอนในส่วนการผลิต แล้วเดินสถานะไปตรวจ QC",
      buttonLabel: "ไปส่วนการผลิต",
      action: { type: "ANCHOR", target: "production" },
    };
  }

  // ผ่านด่านตรวจทางเดียวคือนับจริง (Gate B4) — ห้ามพากดเดินสถานะตรง (server ก็กันแล้ว):
  // นับดีครบยอด→เด้งแพ็คเอง · มีของเสีย→ถอยกลับผลิต+เปิดงานแก้ให้เอง
  if (o.internalStatus === "QUALITY_CHECK") {
    return {
      title: "นับของจริงก่อนแพ็ค",
      description: "กดตรวจนับในการ์ด \"ตรวจนับ QC\" — ดีครบยอดงานเข้าคิวแพ็คเอง มีของเสียระบบถอยกลับผลิตให้",
      buttonLabel: "ไปตรวจนับ QC",
      action: { type: "ANCHOR", target: "qc" },
    };
  }

  if (o.internalStatus === "PACKING") {
    return {
      title: "งานอยู่ช่วงท้าย — เดินสถานะตามจริง",
      description: "เสร็จขั้นนี้แล้วกดไปขั้นถัดไป",
      buttonLabel: "แพ็คเสร็จ → พร้อมส่ง",
      action: { type: "STATUS", to: "READY_TO_SHIP" },
    };
  }

  if (o.internalStatus === "READY_TO_SHIP") {
    // ยังไม่มีใบส่ง → พาไปสร้างก่อน (server กันกด "ส่งแล้ว" โดยไม่มีใบส่งอยู่แล้ว) —
    // เลขพัสดุ/ที่อยู่ต้องอยู่ในระบบ ไม่ใช่ใน LINE
    if (!o.hasDelivery) {
      return {
        title: "สร้างใบส่งของก่อนกดส่ง",
        description: "บันทึกผู้รับ/ที่อยู่/ขนส่ง — กดส่งของที่ใบส่งแล้วสถานะจะเดินให้เอง",
        buttonLabel: "ไปส่วนจัดส่ง",
        action: { type: "ANCHOR", target: "delivery" },
      };
    }
    return {
      title: "ของพร้อมส่ง — กดส่งที่ใบส่ง",
      description: "กด \"ส่งของ\" บนใบส่งในส่วนจัดส่ง (ใส่เลขพัสดุ) แล้วออเดอร์เดินเป็นจัดส่งแล้วเอง",
      buttonLabel: "ไปส่วนจัดส่ง",
      action: { type: "ANCHOR", target: "delivery" },
    };
  }

  if (o.internalStatus === "SHIPPED") {
    if (!o.billingHandled) {
      return {
        title: "วางบิลให้ครบก่อนปิดงาน",
        description: "ของส่งแล้วแต่ยังวางบิล/ออกใบเสร็จไม่ครบยอด — หนี้จะหล่นถ้าปิดงานตอนนี้ (ระบบกันไว้)",
        buttonLabel: "ไปที่การ์ดบิล",
        action: { type: "ANCHOR", target: "billing" },
      };
    }
    return {
      title: "ปิดงาน",
      description: "ของถึงลูกค้า + วางบิลครบแล้ว — ปิดงานได้เลย (เก็บเงินตามเทอมต่อใน ลูกหนี้)",
      buttonLabel: "ปิดงาน",
      action: { type: "STATUS", to: "COMPLETED" },
    };
  }

  if (o.internalStatus === "ON_HOLD") {
    // ระบบไม่ได้จำสถานะก่อนพัก — เดาจุดกลับที่ใกล้ความจริงสุด:
    // มีใบผลิตแล้ว = พักช่วงผลิต กลับเข้าคิวผลิต · ยังไม่มี = กลับจุดยืนยัน
    const resumeTo = o.hasProduction ? "PRODUCTION_QUEUE" : "CONFIRMED";
    return {
      title: "งานพักอยู่",
      description:
        "พร้อมเดินต่อเมื่อไหร่กดปลดพัก (เลือกสถานะอื่นได้จากปุ่มเปลี่ยนสถานะด้านบน)",
      buttonLabel: o.hasProduction ? "ปลดพัก → เข้าคิวผลิต" : "ปลดพัก → ยืนยันออเดอร์",
      action: { type: "STATUS", to: resumeTo },
    };
  }

  return null;
}
