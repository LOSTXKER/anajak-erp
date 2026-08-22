import {
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CloudCog,
  Factory,
  FileClock,
  FileStack,
  FileText,
  Film,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Package,
  PanelsTopLeft,
  Printer,
  ReceiptText,
  Scissors,
  Settings,
  Shapes,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

type PageIdentityIconProps = { label?: string | null; className?: string; strokeWidth?: number };

const DEFAULT_PAGE_DESCRIPTION = "ดูข้อมูลสำคัญและงานที่ทำต่อได้จากหน้านี้";

/**
 * คำอธิบายระดับหน้าเป็นประโยคสั้นที่เห็นเสมอ ไม่ใช่คู่มือหรือสูตรคำนวณ
 * รับ title + breadcrumb รวมกันเพื่อให้หน้ารายละเอียดที่ title เป็นเลขเอกสาร/ชื่อสินค้า
 * ยังได้คำอธิบายจากโมดูลแม่โดยไม่ต้องก๊อปข้อความทุก state ของหน้า
 */
export function pageDescriptionForLabel(label?: string | null) {
  const text = label ?? "";

  if (/ภาพรวมวันนี้|แดชบอร์ด|ภาพรวม/.test(text)) {
    return "ดูงานสำคัญ สถานะล่าสุด และสิ่งที่ต้องทำต่อวันนี้";
  }
  if (/งานของฉัน|งานค้าง|งานวันนี้/.test(text)) {
    return "รวมงานที่รอคุณลงมือ เรียงเรื่องสำคัญไว้ก่อน";
  }
  if (/เปิดงานใหม่|สร้างออเดอร์/.test(text)) {
    return "บันทึกความต้องการลูกค้า รายการงาน ราคา และกำหนดส่งในที่เดียว";
  }
  if (/แก้ไขออเดอร์|แก้ไข ORD-/.test(text)) {
    return "แก้ข้อมูลรับเรื่อง รายการงาน ราคา และรายละเอียดจัดส่ง";
  }
  if (/ออเดอร์ทั้งหมด/.test(text)) {
    return "ค้นหาและติดตามลูกค้า สถานะงาน และกำหนดส่งของทุกออเดอร์";
  }
  if (/ออเดอร์|ORD-/.test(text)) {
    return "ดูรายละเอียด ม็อกอัพ การผลิต การส่ง และเอกสารของงานนี้";
  }
  if (/สร้างใบเสนอราคา|แก้ไขใบเสนอราคา/.test(text)) {
    return "จัดรายการ ราคา เงื่อนไข และข้อมูลสำหรับส่งให้ลูกค้าตัดสินใจ";
  }
  if (/ใบเสนอราคา|เสนอราคา|QT-/.test(text)) {
    return "ติดตามฉบับร่าง การส่ง และผลตอบรับของใบเสนอราคา";
  }
  if (/ลูกค้า|ผู้ติดต่อ/.test(text)) {
    return "ค้นหาข้อมูลติดต่อ ประวัติงาน และรายละเอียดที่ใช้ดูแลลูกค้า";
  }
  if (/ควบคุมการผลิต/.test(text)) {
    return "ดูคิวผลิต งานที่ติดขัด และขั้นตอนที่ต้องจัดการต่อ";
  }
  if (/รอบพิมพ์/.test(text)) {
    return "เปิดและติดตามรอบพิมพ์ ตั้งแต่จัดคิวจนตัดแยกฟิล์ม";
  }
  if (/คลังฟิล์ม|ฟิล์ม/.test(text)) {
    return "ค้นหาฟิล์มที่เหลือและตรวจจำนวนก่อนเปิดรอบพิมพ์ใหม่";
  }
  if (/งานร้านนอก|ร้านรับจ้าง|ร้านนอก|ภายนอก/.test(text)) {
    return "ติดตามงานที่ส่งออก กำหนดรับกลับ และผลตรวจรับจากร้าน";
  }
  if (/แพทเทิร์น|ตัดเย็บ/.test(text)) {
    return "จัดเก็บแพทเทิร์นมาตรฐานเพื่อเลือกใช้ซ้ำในออเดอร์";
  }
  if (/แพ็คเกจ|บรรจุภัณฑ์/.test(text)) {
    return "จัดการรูปแบบบรรจุและรายการที่ใช้เตรียมส่งสินค้า";
  }
  if (/บริการ/.test(text)) {
    return "จัดการบริการมาตรฐานที่ใช้เปิดงานและเสนอราคา";
  }
  if (/สินค้า|แคตตาล็อก/.test(text)) {
    return "ค้นหาและดูข้อมูลสินค้า SKU ตัวเลือก และสถานะการใช้งาน";
  }
  if (/ลูกหนี้|ค้างชำระ/.test(text)) {
    return "ติดตามยอดค้าง วันครบกำหนด และลูกหนี้ที่ต้องเร่งจัดการ";
  }
  if (/ใบวางบิล/.test(text)) {
    return "จัดชุดเอกสารวางบิลและติดตามรอบรับชำระของลูกค้า";
  }
  if (/หัก ณ ที่จ่าย|50ทวิ/.test(text)) {
    return "ติดตามหนังสือรับรองและยอดภาษีที่ลูกค้าหักไว้";
  }
  if (/ภาษีขาย|VAT/.test(text)) {
    return "ตรวจเอกสารและยอดภาษีขายแยกตามงวดสำหรับส่งบัญชี";
  }
  if (/บิล\/การเงิน|บิลและการเงิน|การเงิน/.test(text)) {
    return "ติดตามเอกสาร ยอดค้าง การรับชำระ และงานการเงินที่เกี่ยวข้อง";
  }
  if (/รายงาน|สถิติ|วิเคราะห์/.test(text)) {
    return "ดูแนวโน้มยอดขาย งาน และลูกค้าเพื่อใช้ติดตามภาพรวม";
  }
  if (/แจ้งเตือน/.test(text)) {
    return "รวมเหตุการณ์ที่ต้องรับรู้และลิงก์กลับไปจัดการงานต้นทาง";
  }
  if (/ประวัติระบบ|Audit/.test(text)) {
    return "ตรวจว่าใครทำอะไรกับข้อมูลสำคัญและเกิดขึ้นเมื่อใด";
  }
  if (/สำรองข้อมูล/.test(text)) {
    return "ส่งออกข้อมูลสำหรับเก็บสำรองและใช้ตรวจสอบภายหลัง";
  }
  if (/ข้อมูลกิจการ|กิจการ|บริษัท/.test(text)) {
    return "แก้ข้อมูลกิจการที่ใช้บนเอกสารส่งให้ลูกค้า";
  }
  if (/เรตต้นทุน/.test(text)) {
    return "กำหนดเรตกลางสำหรับประเมินงานโดยไม่แทนตัวเลขบัญชีจริง";
  }
  if (/สต๊อกทดสอบ/.test(text)) {
    return "ตรวจและทดลองการเบิกคืนสินค้าในพื้นที่ข้อมูลตัวอย่าง";
  }
  if (/สต๊อก|Stock/.test(text)) {
    return "ตรวจสถานะการเชื่อมต่อและการส่งข้อมูลกับ Anajak Stock";
  }
  if (/ผู้ใช้|สิทธิ์/.test(text)) {
    return "จัดการบัญชี บทบาท และสิทธิ์เข้าถึงของทีม";
  }
  if (/ตั้งค่า/.test(text)) {
    return "รวมค่าระบบและข้อมูลกลางที่มีผลกับการทำงานจริง";
  }

  return DEFAULT_PAGE_DESCRIPTION;
}

export function PageIdentityIcon({ label, ...props }: PageIdentityIconProps) {
  const text = label ?? "";
  if (/แดชบอร์ด|ภาพรวม/.test(text)) return <LayoutDashboard {...props} />;
  if (/งานของฉัน|งานค้าง|งานวันนี้/.test(text)) return <ListChecks {...props} />;
  if (/ออเดอร์|เปิดงาน/.test(text)) return <ShoppingCart {...props} />;
  if (/ใบเสนอราคา|เสนอราคา/.test(text)) return <ClipboardList {...props} />;
  if (/ลูกค้า|ผู้ติดต่อ/.test(text)) return <Users {...props} />;
  if (/ควบคุมการผลิต|ผลิต/.test(text)) return <Factory {...props} />;
  if (/รอบพิมพ์/.test(text)) return <Printer {...props} />;
  if (/ฟิล์ม/.test(text)) return <Film {...props} />;
  if (/ร้านรับจ้าง|ร้านนอก|ภายนอก/.test(text)) return <Truck {...props} />;
  if (/สินค้า|แคตตาล็อก/.test(text)) return <Package {...props} />;
  if (/แพทเทิร์น|ตัดเย็บ/.test(text)) return <Scissors {...props} />;
  if (/แพ็คเกจ|บรรจุภัณฑ์/.test(text)) return <Shapes {...props} />;
  if (/บริการ/.test(text)) return <Tags {...props} />;
  if (/บิล\/การเงิน|การเงิน/.test(text)) return <WalletCards {...props} />;
  if (/ใบวางบิล/.test(text)) return <FileStack {...props} />;
  if (/ลูกหนี้|ค้างชำระ/.test(text)) return <FileClock {...props} />;
  if (/หัก ณ ที่จ่าย|50ทวิ/.test(text)) return <ReceiptText {...props} />;
  if (/ภาษีขาย|VAT/.test(text)) return <Landmark {...props} />;
  if (/รายงาน|สถิติ|วิเคราะห์/.test(text)) return <BarChart3 {...props} />;
  if (/แจ้งเตือน/.test(text)) return <Bell {...props} />;
  if (/ผู้ใช้|สิทธิ์/.test(text)) return <UserCog {...props} />;
  if (/กิจการ|บริษัท/.test(text)) return <Building2 {...props} />;
  if (/ประวัติระบบ|Audit/.test(text)) return <History {...props} />;
  if (/สำรองข้อมูล/.test(text)) return <CloudCog {...props} />;
  if (/สต๊อก|Stock/.test(text)) return <ClipboardCheck {...props} />;
  if (/ตั้งค่า|เรตต้นทุน/.test(text)) return <Settings {...props} />;
  if (/ใบงาน|เอกสาร/.test(text)) return <FileText {...props} />;
  return <PanelsTopLeft {...props} />;
}
