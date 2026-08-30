/**
 * ม็อกอัพ + ไฟล์แนบของใบตัวอย่าง — ข้อมูลปลอมทั้งหมด ไม่ยิงฐานข้อมูล
 *
 * รูปร่างข้อมูลลอกจาก schema จริงเป๊ะ ๆ (`DesignVersion` + `DesignVersionFile` +
 * `Attachment`) เพื่อให้เอา `mockupImages()/mockupCoverImage()` ตัวจริงมาอ่านได้ตรง ๆ
 * — หน้าลองจึงเลือกรูป/นับรูปด้วยสูตรเดียวกับหน้าจริง ไม่ได้เขียนตรรกะใหม่ให้ดูดี
 *
 * เคสขอบที่จงใจใส่ไว้ (กฎ "เอาของมาให้ครบ"):
 *   · v1 = เวอร์ชันเก่าที่ยังไม่มีแถวใน DesignVersionFile → `files` ว่าง
 *     ต้องถอยไปใช้รูปปกใบเดียว (ของจริงมีใบแบบนี้อยู่เต็มฐาน)
 *   · ไฟล์ .ai/.pdf/.dst = เปิดดูตัวอย่างในเบราว์เซอร์ไม่ได้ → ต้องขึ้นไอคอน ไม่ใช่รูปแตก
 *   · ไฟล์ที่ลูกค้าอัปเอง (`uploadedById: null`) ต้องมีป้ายบอก
 *   · ชื่อไฟล์ยาวเกินช่อง — ของจริงชื่อยาวแบบนี้ทั้งนั้น
 *   · ใบที่เพิ่งเปิด = ยังไม่มีม็อกอัพเลย (`thin`) — ทุกแบบต้องไม่พังและไม่กินที่ฟรี
 */

const D = (iso: string) => new Date(iso);

export interface DemoMockupFile {
  fileUrl: string;
  thumbnailUrl: string | null;
  position: string | null;
  caption: string | null;
}

export interface DemoMockupVersion {
  id: string;
  versionNumber: number;
  fileUrl: string;
  thumbnailUrl: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REVISION";
  designerNotes: string | null;
  customerComment: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  files: DemoMockupFile[];
}

export interface DemoAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: string;
  /** null = ลูกค้าอัปเองผ่านลิงก์ token (ของจริงใช้เงื่อนไขนี้ติดป้าย "ลูกค้า") */
  uploadedById: string | null;
  createdAt: Date;
}

/** ม็อกอัพของใบข้อมูลครบ — เรียงใหม่→เก่า เหมือน design.listByOrder ของจริง */
const MOCKUPS_FULL: DemoMockupVersion[] = [
  {
    id: "demo-design-3",
    versionNumber: 3,
    fileUrl: "/demo-mockups/polo-front.svg",
    thumbnailUrl: null,
    approvalStatus: "APPROVED",
    designerNotes:
      "ลดโลโก้อกซ้ายเหลือ 8 ซม. ตามที่ลูกค้าขอ · ขยายเบอร์โทรด้านหลัง · เพิ่มแขนซ้าย STAFF 2026",
    customerComment: "อนุมัติตามนี้ค่ะ ผลิตได้เลย",
    approvedAt: D("2026-08-21T15:32:00"),
    createdAt: D("2026-08-21T10:18:00"),
    files: [
      {
        fileUrl: "/demo-mockups/polo-front.svg",
        thumbnailUrl: null,
        position: "FRONT",
        caption: "ปักโลโก้อกซ้าย 8 ซม. ด้ายเขียว #12A594",
      },
      {
        fileUrl: "/demo-mockups/polo-back.svg",
        thumbnailUrl: null,
        position: "BACK",
        caption: "DTF เต็มแผ่นหลัง 29×29 ซม.",
      },
      {
        fileUrl: "/demo-mockups/polo-sleeve.svg",
        thumbnailUrl: null,
        position: "SLEEVE_L",
        caption: null,
      },
    ],
  },
  {
    id: "demo-design-2",
    versionNumber: 2,
    fileUrl: "/demo-mockups/polo-front.svg",
    thumbnailUrl: null,
    approvalStatus: "REVISION",
    designerNotes: "แก้สีเสื้อเป็นกรมท่าอ่อนลงหนึ่งเฉดตามที่คุยในไลน์",
    customerComment:
      "โลโก้หน้าอกใหญ่ไปนิดนึงค่ะ ขอลดสัก 15% แล้วเบอร์โทรด้านหลังขอตัวใหญ่ขึ้นหน่อย",
    approvedAt: null,
    createdAt: D("2026-08-19T16:44:00"),
    files: [
      {
        fileUrl: "/demo-mockups/polo-front.svg",
        thumbnailUrl: null,
        position: "FRONT",
        caption: null,
      },
      {
        fileUrl: "/demo-mockups/polo-back.svg",
        thumbnailUrl: null,
        position: "BACK",
        caption: null,
      },
    ],
  },
  {
    // เวอร์ชันยุคก่อนมี DesignVersionFile — `files` ว่าง ต้องถอยไปใช้รูปปก
    id: "demo-design-1",
    versionNumber: 1,
    fileUrl: "/demo-mockups/polo-front.svg",
    thumbnailUrl: null,
    approvalStatus: "REVISION",
    designerNotes: null,
    customerComment: "สีกรมท่าเข้มไปค่ะ ขอดูตัวอย่างสีที่อ่อนลง",
    approvedAt: null,
    createdAt: D("2026-08-17T11:02:00"),
    files: [],
  },
];

/** ไฟล์แนบชั้น 1 (ลูกค้าส่งมา) + ชั้น 3 (ไฟล์พิมพ์จริง) ของใบข้อมูลครบ */
const ATTACHMENTS_FULL: DemoAttachment[] = [
  {
    id: "demo-att-1",
    fileName: "logo-bkkmedical-2026-vector-original.ai",
    fileUrl: "/demo-files/logo-bkkmedical-2026-vector-original.ai",
    fileType: "application/postscript",
    fileSize: 4_812_000,
    category: "REFERENCE_IMAGE",
    uploadedById: null,
    createdAt: D("2026-08-15T09:12:00"),
  },
  {
    id: "demo-att-2",
    fileName: "logo-bkkmedical-2026.png",
    fileUrl: "/demo-mockups/ref-logo.svg",
    fileType: "image/png",
    fileSize: 268_400,
    category: "REFERENCE_IMAGE",
    uploadedById: "demo-user-1",
    createdAt: D("2026-08-15T09:14:00"),
  },
  {
    id: "demo-att-3",
    fileName: "ตารางไซซ์-ถ่ายจากไลน์.jpg",
    fileUrl: "/demo-mockups/ref-sizechart.svg",
    fileType: "image/jpeg",
    fileSize: 1_940_000,
    category: "REFERENCE_IMAGE",
    uploadedById: null,
    createdAt: D("2026-08-15T09:20:00"),
  },
  {
    id: "demo-att-4",
    fileName: "gangsheet-SO-2026-0391-back-29x29.pdf",
    fileUrl: "/demo-files/gangsheet-SO-2026-0391-back-29x29.pdf",
    fileType: "application/pdf",
    fileSize: 18_600_000,
    category: "PRINT_FILE",
    uploadedById: "demo-user-2",
    createdAt: D("2026-08-22T13:40:00"),
  },
  {
    id: "demo-att-5",
    fileName: "embroidery-bkk-logo-8cm.dst",
    fileUrl: "/demo-files/embroidery-bkk-logo-8cm.dst",
    fileType: "application/octet-stream",
    fileSize: 96_200,
    category: "PRINT_FILE",
    uploadedById: "demo-user-2",
    createdAt: D("2026-08-22T13:41:00"),
  },
];

/** ใบที่เพิ่งเปิด — ยังไม่มีม็อกอัพ มีแค่รูปที่ลูกค้าเพิ่งส่งมาในแชท */
const ATTACHMENTS_THIN: DemoAttachment[] = [
  {
    id: "demo-att-thin-1",
    fileName: "รูปที่ลูกค้าส่งมาในไลน์.jpg",
    fileUrl: "/demo-mockups/ref-logo.svg",
    fileType: "image/jpeg",
    fileSize: 820_000,
    category: "REFERENCE_IMAGE",
    uploadedById: null,
    createdAt: D("2026-08-29T18:02:00"),
  },
];

export function demoMockups(thin: boolean): DemoMockupVersion[] {
  return thin ? [] : MOCKUPS_FULL;
}

export function demoAttachments(thin: boolean): DemoAttachment[] {
  return thin ? ATTACHMENTS_THIN : ATTACHMENTS_FULL;
}

/** ไฟล์ดิบจากลูกค้า (ชั้น 1) — ของจริงแยกด้วย category เดียวกันนี้ */
export function demoRawFiles(thin: boolean): DemoAttachment[] {
  return demoAttachments(thin).filter((a) => a.category !== "PRINT_FILE");
}

/** ไฟล์พิมพ์จริง (ชั้น 3) — ห้ามหลุดถึงลูกค้า ของจริง gate ด้วย category นี้ */
export function demoPrintFiles(thin: boolean): DemoAttachment[] {
  return demoAttachments(thin).filter((a) => a.category === "PRINT_FILE");
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}
