# Anajak Print -- Features & Flows

> ระบบ ERP สำหรับโรงงานสกรีนเสื้อ -- ทำลายข้อจำกัด Minimum Order ด้วยระบบจัดการที่ดีพอจะรับทุก Order ได้อย่างมีกำไร

---

## สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [Order Management -- การจัดการออเดอร์](#1-order-management--การจัดการออเดอร์)
3. [Production Management -- การจัดการผลิต](#2-production-management--การจัดการผลิต)
4. [Design & Revision Management -- จัดการงานออกแบบและแก้ไข](#3-design--revision-management--จัดการงานออกแบบและแก้ไข)
5. [Outsource Management -- จัดการงาน Outsource](#4-outsource-management--จัดการงาน-outsource)
6. [Billing & Invoice -- ระบบเปิดบิล](#5-billing--invoice--ระบบเปิดบิล)
7. [CRM -- Customer Relationship Management](#6-crm--customer-relationship-management)
8. [Fraud Prevention & Audit -- ป้องกันทุจริต](#7-fraud-prevention--audit--ป้องกันทุจริต)
9. [Analytics & Statistics -- ระบบสถิติ](#8-analytics--statistics--ระบบสถิติ)
10. [Customer Portal -- ส่วนของลูกค้า](#9-customer-portal--ส่วนของลูกค้า)
11. [Anajak Stock API Integration](#10-anajak-stock-api-integration)

---

## ภาพรวมระบบ

Anajak Print ประกอบด้วย 8 โมดูลหลัก + Customer Portal + Stock API Integration

```mermaid
graph TB
    subgraph clients [Clients]
        WebApp["Web App -- PWA"]
        Portal["Customer Portal"]
    end

    subgraph modules [Anajak Print Modules]
        Order["1. Order Management"]
        Production["2. Production Management"]
        Design["3. Design and Revision"]
        Outsource["4. Outsource Management"]
        Billing["5. Billing and Invoice"]
        CRM["6. CRM"]
        Fraud["7. Fraud Prevention"]
        Analytics["8. Analytics"]
    end

    subgraph external [External]
        Stock["Anajak Stock API"]
        LINE["LINE OA"]
    end

    clients --> modules
    Order --> Design
    Order --> Production
    Order --> Billing
    Production --> Outsource
    Production --> Stock
    Billing --> Fraud
    CRM --> Analytics
    Order --> LINE
```

### Flow หลักทั้งระบบ (End-to-End)

```mermaid
graph LR
    A["ลูกค้าติดต่อ"] --> B["เปิด Inquiry"]
    B --> C["ทำใบเสนอราคา"]
    C --> D["ลูกค้าอนุมัติราคา"]
    D --> E["ออกแบบลาย"]
    E --> F["ลูกค้าอนุมัติแบบ"]
    F --> G["วางบิลมัดจำ"]
    G --> H["เข้าสู่การผลิต"]
    H --> I["QC ตรวจสอบ"]
    I --> J["แพคสินค้า"]
    J --> K["วางบิลส่วนที่เหลือ"]
    K --> L["จัดส่ง"]
    L --> M["เสร็จสิ้น"]
```

---

## 1. Order Management -- การจัดการออเดอร์

หัวใจหลักของระบบ -- รองรับตั้งแต่ 1 ตัว ไม่มีขั้นต่ำ

### Features

- **สร้างออเดอร์** -- รับรายละเอียดครบ: แบบเสื้อ, ไซส์, สี, จำนวน, วัสดุ, ตำแหน่งสกรีน, ประเภทสกรีน
- **Order Status Tracking** -- ติดตามสถานะแบบ real-time ตั้งแต่ Inquiry จนส่งมอบ
- **Revision Management** -- ลูกค้าแก้ไขได้ มี version history ทุกครั้งที่แก้ มี log ว่าใครแก้อะไร เมื่อไหร่
- **Deadline Tracking** -- กำหนดวันส่ง แจ้งเตือนอัตโนมัติเมื่อใกล้ครบกำหนด
- **แนบไฟล์** -- แนบ mockup/proof ให้ลูกค้าดูก่อนผลิต
- **Customer Approval** -- ลูกค้าอนุมัติแบบผ่าน portal/link ลดปัญหา "ไม่ได้สั่งแบบนี้"

### Order Status Flow

```mermaid
stateDiagram-v2
    [*] --> Inquiry: ลูกค้าติดต่อเข้ามา
    Inquiry --> Quotation: ลูกค้าสนใจ
    Quotation --> DesignPhase: อนุมัติราคา+จ่ายมัดจำ
    DesignPhase --> DesignRevision: ลูกค้าขอแก้
    DesignRevision --> DesignPhase: แก้เสร็จส่งให้ดูใหม่
    DesignPhase --> DesignApproved: ลูกค้าอนุมัติแบบ
    DesignApproved --> Production: เริ่มผลิต
    Production --> QualityCheck: ผลิตเสร็จ
    QualityCheck --> Production: QC_ไม่ผ่าน_ผลิตใหม่
    QualityCheck --> Packing: QC_ผ่าน
    Packing --> Shipping: แพคเสร็จ+จ่ายครบ
    Shipping --> Completed: ส่งถึงลูกค้า
    Completed --> [*]

    Inquiry --> Cancelled: ลูกค้ายกเลิก
    Quotation --> Cancelled: ลูกค้ายกเลิก
```

### สถานะออเดอร์ทั้งหมด

| สถานะ | คำอธิบาย | ใครรับผิดชอบ |
|-------|----------|-------------|
| Inquiry | ลูกค้าติดต่อเข้ามา ยังไม่ได้เสนอราคา | ฝ่ายขาย |
| Quotation | ส่งใบเสนอราคาแล้ว รอลูกค้าตอบ | ฝ่ายขาย |
| Design Phase | กำลังออกแบบลาย | ดีไซเนอร์ |
| Design Approved | ลูกค้าอนุมัติแบบแล้ว | - |
| Production | กำลังผลิต | ฝ่ายผลิต |
| Quality Check | ตรวจสอบคุณภาพ | QC |
| Packing | แพคสินค้า | ฝ่ายแพค |
| Shipping | จัดส่งแล้ว | ฝ่ายจัดส่ง |
| Completed | ส่งถึงลูกค้าแล้ว | - |
| Cancelled | ยกเลิก | - |

---

## 2. Production Management -- การจัดการผลิต

แยก production เป็น work steps ย่อย แต่ละ step track ได้อิสระ

### Features

- **Production Board** -- Kanban-style ดูภาพรวมงานทั้งหมด
- **Production Steps** -- แยกขั้นตอนย่อย assign คนทำ track เวลาจริง
- **Custom Step Templates** -- สร้าง template สำหรับงานแต่ละประเภท (เสื้อยืด, เสื้อโปโล, ถุงผ้า)
- **Capacity Planning** -- คำนวณว่าวันนี้รับงานได้อีกกี่ตัว
- **Cost Calculation** -- คำนวณต้นทุนจริงต่อชิ้น (วัสดุ + แรงงาน + overhead)
- **QC Checkpoint** -- จุดตรวจสอบคุณภาพที่ทุก step สำคัญ
- **เชื่อม Anajak Stock** -- เบิกวัสดุอัตโนมัติเมื่อเริ่มผลิต

### Production Steps (ขั้นตอนการผลิต)

| Step | รายละเอียด | หมายเหตุ |
|------|-----------|---------|
| Pattern Making (แพทเทิร์น) | สร้างแพทเทิร์น ตัดผ้า | สามารถ outsource ได้ |
| Screen Printing (สกรีน) | เตรียมบล็อก ผสมสี สกรีน อบแห้ง | งานหลักของโรงงาน |
| Tagging (ป้ายแท็ก) | เย็บป้ายแบรนด์ ป้ายไซส์ ป้ายดูแลรักษา | สามารถ outsource ได้ |
| Packaging (ถุงแพค) | พับ ใส่ถุง ติดสติ๊กเกอร์ | - |
| Other (อื่นๆ) | ปัก เย็บพิเศษ ฯลฯ | custom steps ได้ |

### Production Flow

```mermaid
graph TD
    Start["Order Approved"] --> CheckStock{"เช็ควัสดุ\nใน Stock"}
    CheckStock -->|มีพอ| Deduct["เบิกวัสดุจาก\nAnajak Stock"]
    CheckStock -->|ไม่พอ| PO["สั่งซื้อวัสดุ"]
    PO --> Deduct

    Deduct --> Pattern["Step 1: Pattern Making\nทำแพทเทิร์น+ตัดผ้า"]

    Pattern --> NeedOutsource{"ต้อง\nOutsource?"}
    NeedOutsource -->|ใช่| SendOut["ส่งงาน Outsource\n(ปัก/พิมพ์พิเศษ)"]
    NeedOutsource -->|ไม่| Screen

    Pattern --> Screen["Step 2: Screen Printing\nสกรีนลาย"]
    SendOut --> Merge["รับงานกลับ"]
    Screen --> Merge

    Merge --> Tag["Step 3: Tagging\nเย็บป้าย"]
    Tag --> QC{"QC\nตรวจสอบ"}
    QC -->|ไม่ผ่าน| Fix["แก้ไข/ทำใหม่"]
    Fix --> QC
    QC -->|ผ่าน| Pack["Step 4: Packaging\nแพคสินค้า"]
    Pack --> Done["พร้อมจัดส่ง"]
```

---

## 3. Design & Revision Management -- จัดการงานออกแบบและแก้ไข

Module สำคัญสำหรับรองรับ "ความเรื่องมากของลูกค้า"

### Features

- **Design File Management** -- เก็บไฟล์ต้นฉบับ (AI, PSD, PNG) ทุก version
- **Version Control** -- ทุกครั้งที่แก้ = version ใหม่ เปรียบเทียบ version ได้
- **Approval Workflow** -- ส่งแบบให้ลูกค้าอนุมัติผ่าน link (ไม่ต้อง login)
  - ลูกค้ากดอนุมัติ = มี digital signature + timestamp เป็นหลักฐาน
  - ลูกค้าขอแก้ = comment ได้บน mockup โดยตรง
- **Revision Tracking** -- บันทึกทุกการแก้ไข ใครขอแก้ แก้อะไร เมื่อไหร่
- **Revision Limit/Cost** -- ตั้งจำนวนแก้ฟรีได้ (เช่น 3 ครั้ง) เกินแล้วคิดเงินเพิ่ม
- **Mockup Generator** -- preview ลายบนเสื้อก่อนผลิตจริง
- **Asset Library** -- เก็บ logo, font, สีประจำแบรนด์ของลูกค้า ใช้ซ้ำได้

### Design Approval Flow

```mermaid
sequenceDiagram
    participant Sales as ฝ่ายขาย
    participant Designer as ดีไซเนอร์
    participant System as ระบบ
    participant Customer as ลูกค้า

    Sales->>Designer: ส่ง brief งานออกแบบ
    Designer->>System: อัปโหลดแบบ v1
    System->>Customer: ส่ง link ดูแบบ (LINE/Email)

    alt ลูกค้าอนุมัติ
        Customer->>System: กดอนุมัติ (บันทึก signature+timestamp)
        System->>Sales: แจ้ง "แบบอนุมัติแล้ว"
        System->>Designer: แจ้ง "แบบอนุมัติแล้ว"
    else ลูกค้าขอแก้ (ครั้งที่ 1-3 ฟรี)
        Customer->>System: comment ขอแก้บน mockup
        System->>Designer: แจ้ง "ลูกค้าขอแก้ revision #2"
        Designer->>System: อัปโหลดแบบ v2
        System->>Customer: ส่ง link ดูแบบใหม่
    else ลูกค้าขอแก้ (ครั้งที่ 4+ คิดเงิน)
        Customer->>System: comment ขอแก้
        System->>Sales: แจ้ง "เกินจำนวนแก้ฟรี -- ต้องเก็บเงินเพิ่ม"
        Sales->>Customer: แจ้งค่าแก้ไขเพิ่ม
        Customer->>Sales: ตกลงจ่าย
        Sales->>Designer: ดำเนินการแก้
    end
```

### Revision History ตัวอย่าง

| Version | วันที่ | ผู้ขอแก้ | รายละเอียด | สถานะ |
|---------|-------|---------|-----------|-------|
| v1 | 12 ก.พ. 26 | - | แบบแรกตาม brief | ลูกค้าขอแก้ |
| v2 | 13 ก.พ. 26 | ลูกค้า | เปลี่ยนสีโลโก้เป็นน้ำเงิน | ลูกค้าขอแก้ |
| v3 | 14 ก.พ. 26 | ลูกค้า | ขยายโลโก้ใหญ่ขึ้น 20% | อนุมัติ |

---

## 4. Outsource Management -- จัดการงาน Outsource

รองรับงานที่ไม่มีเครื่องหรือคนทำ ส่งให้ vendor ภายนอก

### Features

- **Vendor Registry** -- ทะเบียน vendor ทุกเจ้า + ราคา + ความสามารถ + rating
- **Outsource Work Order** -- สร้างใบสั่งงาน outsource จาก production step ใดก็ได้
- **Status Tracking** -- track สถานะงาน outsource ตลอด
- **Cost Tracking** -- บันทึกต้นทุน outsource ต่อชิ้น
- **Quality History** -- บันทึกประวัติคุณภาพงานของแต่ละ vendor
- **Auto-suggest** -- แนะนำ vendor ที่เหมาะสมตาม type of work + ราคา + rating

### Outsource Flow

```mermaid
stateDiagram-v2
    [*] --> CreateWO: สร้างใบสั่งงาน Outsource
    CreateWO --> SelectVendor: เลือก Vendor
    SelectVendor --> SendOut: ส่งงานออก
    SendOut --> InProgress: Vendor รับงาน
    InProgress --> ReceiveBack: งานเสร็จ รับกลับ
    ReceiveBack --> QCCheck: ตรวจสอบคุณภาพ
    QCCheck --> Approved: ผ่าน
    QCCheck --> Rejected: ไม่ผ่าน
    Rejected --> SendOut: ส่งซ่อม/ทำใหม่
    Approved --> ReturnToProduction: กลับเข้าสายการผลิต
    ReturnToProduction --> [*]
```

### Vendor Rating

| เกณฑ์ | คะแนน | คำอธิบาย |
|------|-------|---------|
| คุณภาพ | 1-5 | QC ผ่านกี่ % |
| ความตรงเวลา | 1-5 | ส่งทันตามกำหนดกี่ % |
| ราคา | 1-5 | เทียบกับ vendor อื่น |
| การสื่อสาร | 1-5 | ตอบไว แก้ไขง่าย |

---

## 5. Billing & Invoice -- ระบบเปิดบิล

### Features

- **Quotation (ใบเสนอราคา)** -- คำนวณต้นทุนอัตโนมัติจาก production steps + margin
- **Invoice (ใบแจ้งหนี้)** -- รองรับ deposit (มัดจำ) + แบ่งจ่ายหลายงวด
- **Receipt (ใบเสร็จรับเงิน)** -- ออกเมื่อรับเงินครบ
- **Payment Tracking** -- ติดตามสถานะ: จ่ายแล้ว / ค้างชำระ / เกินกำหนด
- **Payment Terms** -- ตั้งเงื่อนไขได้ (50/50, 30/70, จ่ายครบก่อนส่ง ฯลฯ)
- **Overdue Alert** -- แจ้งเตือนบิลค้างชำระอัตโนมัติ
- **Credit Note / Debit Note** -- กรณีแก้ไขราคาหลังออกบิล
- **Export PDF** -- ดาวน์โหลด/พิมพ์ได้

### Billing Flow

```mermaid
graph TD
    Q["ใบเสนอราคา\nQuotation"] --> Approve{"ลูกค้า\nอนุมัติ?"}
    Approve -->|ไม่| Revise["แก้ไขราคา"]
    Revise --> Q
    Approve -->|ใช่| Deposit["เปิดบิลมัดจำ 50%\nDeposit Invoice"]
    Deposit --> PayDeposit{"ลูกค้า\nจ่ายมัดจำ?"}
    PayDeposit -->|จ่ายแล้ว| StartProd["เริ่มผลิต"]
    PayDeposit -->|ยังไม่จ่าย| Remind["แจ้งเตือนอัตโนมัติ"]
    Remind --> PayDeposit
    StartProd --> ProdDone["ผลิตเสร็จ"]
    ProdDone --> FinalBill["เปิดบิลส่วนที่เหลือ 50%\nFinal Invoice"]
    FinalBill --> PayFinal{"ลูกค้า\nจ่ายครบ?"}
    PayFinal -->|จ่ายแล้ว| Receipt["ออกใบเสร็จ\nReceipt"]
    PayFinal -->|ยังไม่จ่าย| RemindFinal["แจ้งเตือน"]
    RemindFinal --> PayFinal
    Receipt --> Ship["จัดส่ง"]
```

### เอกสารทางการเงิน

| เอกสาร | เมื่อไหร่ | หมายเหตุ |
|--------|----------|---------|
| Quotation (QT) | ลูกค้าสนใจ ต้องการราคา | แก้ไขได้จนกว่าจะอนุมัติ |
| Deposit Invoice (INV-D) | ลูกค้าอนุมัติราคา | มัดจำก่อนเริ่มงาน |
| Final Invoice (INV-F) | ผลิตเสร็จ | เก็บส่วนที่เหลือก่อนส่ง |
| Receipt (REC) | รับเงินครบ | หลักฐานการรับเงิน |
| Credit Note (CN) | ต้องลดราคา/คืนเงิน | ต้องมี approval |
| Debit Note (DN) | ต้องเก็บเงินเพิ่ม | เช่น ค่าแก้ไขเพิ่มเติม |

---

## 6. CRM -- Customer Relationship Management

แก้ปัญหา "ไม่รู้ว่าลูกค้าเราคือใคร ต้องการอะไร"

### Features

- **Customer Profile** -- ข้อมูลครบ: ชื่อ, บริษัท, ที่อยู่, โทร, LINE, social media, ประเภทธุรกิจ
- **Brand Profile** -- เก็บข้อมูลแบรนด์ของลูกค้า: logo, สี, font, style ที่ชอบ
- **Order History** -- ประวัติสั่งซื้อทั้งหมด + สรุปยอดรวม
- **Communication Log** -- บันทึกทุกการสื่อสาร (LINE, โทร, อีเมล) ไม่มีหล่นหาย
- **Customer Tags/Segments** -- แบ่งกลุ่มลูกค้า (VIP, ขาประจำ, รายใหญ่, รายย่อย)
- **Customer Scoring (RFM)** -- ให้คะแนนอัตโนมัติตาม Recency / Frequency / Monetary
- **Follow-up Reminders** -- แจ้งเตือนติดตามลูกค้า เช่น "ลูกค้า A ไม่สั่งมา 3 เดือนแล้ว"
- **Preference Tracking** -- จดจำ preference ของลูกค้า (ชอบผ้าอะไร สีอะไร สไตล์ไหน)

### Customer Lifecycle Flow

```mermaid
graph LR
    A["ลูกค้าใหม่\nNew Lead"] --> B["ติดต่อครั้งแรก\nFirst Contact"]
    B --> C["เสนอราคา\nQuotation"]
    C --> D["สั่งซื้อครั้งแรก\nFirst Order"]
    D --> E["ลูกค้าขาประจำ\nRepeat Customer"]
    E --> F["ลูกค้า VIP\nHigh Value"]
    E --> G["ลูกค้าหายไป\nInactive"]
    G --> H["Follow-up\nRe-engage"]
    H --> E
```

### RFM Scoring

| ระดับ | Recency (ล่าสุด) | Frequency (ความถี่) | Monetary (ยอดเงิน) | ความหมาย |
|------|-----------------|-------------------|------------------|---------|
| 5 | สั่งภายใน 1 เดือน | 10+ ครั้ง/ปี | 100,000+ บาท/ปี | Champion |
| 4 | สั่งภายใน 3 เดือน | 5-9 ครั้ง/ปี | 50,000-99,999 | Loyal |
| 3 | สั่งภายใน 6 เดือน | 3-4 ครั้ง/ปี | 20,000-49,999 | Potential |
| 2 | สั่งภายใน 12 เดือน | 1-2 ครั้ง/ปี | 5,000-19,999 | At Risk |
| 1 | ไม่สั่งเกิน 12 เดือน | 0 ครั้ง | < 5,000 | Lost |

---

## 7. Fraud Prevention & Audit -- ป้องกันทุจริต

ป้องกันการทุจริตของพนักงาน โดยเฉพาะเรื่องการเงิน

### Features

#### Audit Trail (บันทึกทุก action)
- ทุก action ในระบบถูกบันทึก: ใคร ทำอะไร เมื่อไหร่ ค่าเก่า/ค่าใหม่
- บิลที่ออกแล้ว void ได้แต่ลบไม่ได้ (immutable records)
- ทุกการแก้ไขข้อมูลสำคัญ ต้องกรอกเหตุผลบังคับ
- บันทึก login/logout ทุกครั้ง + IP address

#### Role-Based Access Control (RBAC)

| Role | เห็นอะไร | ทำอะไรได้ |
|------|---------|----------|
| Owner | ทุกอย่าง | ทุกอย่าง + อนุมัติ + ดู audit log |
| Manager | Production + รายงานการเงิน | จัดการ production + อนุมัติส่วนลด |
| Accountant | Billing + การเงิน | เปิดบิล (แก้ไขต้องได้รับอนุมัติ) |
| Production Staff | เฉพาะงานที่ assign | อัปเดตสถานะงานที่รับผิดชอบ |
| Designer | เฉพาะงานออกแบบ | อัปโหลดแบบ + จัดการ design files |
| Sales | ลูกค้า + ออเดอร์ | สร้างออเดอร์ + เสนอราคา |

#### Financial Approval Workflow

```mermaid
graph TD
    Action["พนักงานทำ action ทางการเงิน"]
    Action --> Check{"ประเภท\naction?"}

    Check -->|ส่วนลด ≤ 10%| Auto["อนุมัติอัตโนมัติ"]
    Check -->|ส่วนลด > 10%| NeedApproval["ต้อง Manager อนุมัติ"]
    Check -->|ยกเลิกบิล| TwoLevel["ต้อง 2 คนอนุมัติ\nManager + Owner"]
    Check -->|แก้ไขราคาหลัง confirm| ReasonRequired["ต้องกรอกเหตุผล\n+ Manager อนุมัติ"]

    NeedApproval --> Approved{"อนุมัติ?"}
    TwoLevel --> Approved
    ReasonRequired --> Approved

    Approved -->|ใช่| Execute["ดำเนินการ + บันทึก audit log"]
    Approved -->|ไม่| Reject["ปฏิเสธ + บันทึก audit log"]
```

#### Anomaly Detection Alerts (แจ้งเตือนความผิดปกติ)

| เหตุการณ์ | เงื่อนไข | แจ้งเตือนใคร |
|----------|---------|-------------|
| ส่วนลดผิดปกติ | ส่วนลดเกิน X% ที่ตั้งไว้ | Owner, Manager |
| ยกเลิกบิลบ่อย | ยกเลิก > 3 บิล/สัปดาห์ โดยคนเดียวกัน | Owner |
| แก้ไขราคาบ่อย | แก้ราคา > 5 ครั้ง/สัปดาห์ | Owner, Manager |
| วัสดุสิ้นเปลืองเกิน | ใช้วัสดุเกินค่าเฉลี่ย 30% | Manager |
| Login ผิดปกติ | Login จาก IP ใหม่ / เวลาผิดปกติ | Owner |

---

## 8. Analytics & Statistics -- ระบบสถิติ

### Dashboards

#### Sales Dashboard
- ยอดขายรวม / ยอดเดือนนี้ / เทียบเดือนก่อน / แนวโน้ม
- รายได้ต่อประเภทงาน (เสื้อยืด, โปโล, ถุงผ้า)
- Average Order Value
- Conversion Rate (Inquiry -> Order)

#### Customer Dashboard
- ลูกค้าใหม่ vs ลูกค้าเก่า
- Top 10 ลูกค้า (ยอดสั่งสูงสุด)
- RFM Analysis
- Customer Retention Rate
- ลูกค้าที่หายไป (ต้อง follow-up)

#### Production Dashboard
- งานค้างรอผลิต / กำลังผลิต / เสร็จแล้ว
- Utilization Rate (กำลังการผลิตที่ใช้ vs ทั้งหมด)
- Lead Time เฉลี่ย (สั่งจนส่ง)
- QC Pass Rate
- Outsource Ratio

#### Financial Dashboard
- รายรับ-รายจ่าย / กำไรขั้นต้น
- บิลค้างชำระ + aging report
- Cash Flow รายเดือน
- ต้นทุนจริง vs ราคาขาย (margin %)

#### Outsource Dashboard
- ต้นทุน outsource รวม / ต่อ vendor
- Vendor Performance Ranking
- สัดส่วนงาน in-house vs outsource

### Reports (Export PDF / Excel)

| รายงาน | รายละเอียด |
|--------|-----------|
| รายงานลูกค้า | ใครสั่งบ่อย, ใครสั่งเยอะ, ใครหายไป, ลูกค้าใหม่ |
| รายงานสินค้า | ประเภทงานขายดี, ไซส์นิยม, สีนิยม |
| รายงานผลิต | ต้นทุนจริง vs ราคาขาย, production efficiency |
| รายงานการเงิน | Profit margin, outstanding payments, monthly P&L |
| รายงาน Outsource | ต้นทุน, คุณภาพ, ความตรงเวลาของแต่ละ vendor |

---

## 9. Customer Portal -- ส่วนของลูกค้า

Portal แยกให้ลูกค้า login เข้ามาดูสถานะเอง ลด workload ฝ่ายขาย

### Features

- **ดูสถานะออเดอร์** -- real-time ไม่ต้องทัก LINE ถาม
- **อนุมัติ/ขอแก้แบบ** -- ดู mockup + comment + กดอนุมัติได้เลย
- **ดูเอกสาร** -- ดาวน์โหลด Quotation, Invoice, Receipt เป็น PDF
- **ดูประวัติออเดอร์** -- ออเดอร์ทั้งหมดที่เคยสั่ง
- **แจ้งเตือน LINE OA** -- แจ้งเมื่อแบบเสร็จ/ผลิตเสร็จ/ส่งแล้ว

### Customer Portal Flow

```mermaid
graph TD
    Login["ลูกค้า Login\n(LINE / Email)"] --> Dashboard["Customer Dashboard"]
    Dashboard --> Orders["ดูออเดอร์ทั้งหมด"]
    Dashboard --> ActiveOrder["ดูออเดอร์ปัจจุบัน"]
    Dashboard --> Docs["ดาวน์โหลดเอกสาร"]

    ActiveOrder --> Status["ดูสถานะ real-time\nInquiry > Design > Production > Ship"]
    ActiveOrder --> Design["ดูแบบ/Mockup"]
    Design --> Approve{"อนุมัติ?"}
    Approve -->|ใช่| Confirmed["บันทึก approval\n+ signature + timestamp"]
    Approve -->|ขอแก้| Comment["Comment จุดที่ต้องแก้"]
    Comment --> Notify["แจ้งดีไซเนอร์อัตโนมัติ"]
```

---

## 10. Anajak Stock API Integration

เชื่อมระบบสต๊อคกับ Anajak Stock ผ่าน API

### Integration Points

| จุดเชื่อมต่อ | ทิศทาง | เมื่อไหร่ |
|-------------|--------|----------|
| ดึงรายการวัสดุ | Stock -> Print | เมื่อสร้างออเดอร์ (เช็คว่ามีวัสดุพอไหม) |
| เบิกวัสดุ | Print -> Stock | เมื่อเริ่มผลิต (หักสต๊อคอัตโนมัติ) |
| แจ้งเตือนวัสดุใกล้หมด | Stock -> Print | เมื่อต่ำกว่า minimum |
| คำนวณต้นทุนวัสดุ | Stock -> Print | ดึงราคาทุนจาก Stock มาคำนวณ |
| เพิ่มสินค้าสำเร็จรูป | Print -> Stock | เมื่อผลิตเสร็จ sync กลับ Stock |

### Integration Flow

```mermaid
sequenceDiagram
    participant Print as Anajak Print
    participant Stock as Anajak Stock API

    Note over Print: เริ่มผลิต Order #1234

    Print->>Stock: GET /products?type=material
    Stock-->>Print: รายการวัสดุ + จำนวนคงเหลือ

    Print->>Print: คำนวณวัสดุที่ต้องใช้

    alt วัสดุพอ
        Print->>Stock: POST /stock-out (เบิกผ้า 50 ม., สี 2 กก.)
        Stock-->>Print: สำเร็จ -- สต๊อคคงเหลือ
        Print->>Print: เริ่มผลิต
    else วัสดุไม่พอ
        Print->>Print: แจ้งเตือน "วัสดุไม่พอ ต้องสั่งซื้อ"
        Print->>Stock: POST /purchase-request (สร้างใบขอซื้อ)
        Stock-->>Print: PR สร้างแล้ว
    end

    Note over Print: ผลิตเสร็จ

    Print->>Stock: POST /stock-in (เพิ่มเสื้อสำเร็จรูป 100 ตัว)
    Stock-->>Print: สำเร็จ
```

---

## สรุปความเชื่อมโยงทั้งระบบ

```mermaid
graph TB
    subgraph customerFacing [Customer-Facing]
        Portal["Customer Portal"]
        LINE["LINE OA Notify"]
    end

    subgraph salesFlow [Sales Flow]
        CRM["CRM\nรู้จักลูกค้า"]
        Order["Order Management\nรับออเดอร์"]
        Billing["Billing\nเปิดบิล"]
    end

    subgraph productionFlow [Production Flow]
        Design["Design Management\nออกแบบ+แก้ไข"]
        Production["Production\nสายการผลิต"]
        Outsource["Outsource\nส่งงานนอก"]
        Stock["Anajak Stock\nวัสดุ+สต๊อค"]
    end

    subgraph management [Management]
        Analytics["Analytics\nสถิติ+รายงาน"]
        Fraud["Fraud Prevention\nป้องกันทุจริต"]
    end

    CRM --> Order
    Order --> Design
    Order --> Billing
    Design --> Production
    Production --> Outsource
    Production --> Stock
    Billing --> Fraud

    Portal --> Order
    Portal --> Design
    Order --> LINE

    CRM --> Analytics
    Order --> Analytics
    Billing --> Analytics
    Production --> Analytics
    Fraud --> Analytics
```
