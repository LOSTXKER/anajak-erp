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
