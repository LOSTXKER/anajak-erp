# Anajak ERP v2.0

ระบบ ERP ครบวงจรสำหรับโรงงานผลิตเสื้อและงานสกรีน พัฒนาด้วย Next.js + Supabase

## 🚀 Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS + Shadcn/UI
- **State Management:** Zustand + TanStack Query
- **Icons:** Lucide React

## 📁 Project Structure

```
anajaktshirt-superappv2/
├── docs/                        # เอกสารแผนงาน ERP
│   └── ERP-FLOW-REDESIGN.md    # แผนแม่บทระบบ ERP (ครบถ้วน)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Dashboard หน้าแรก
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   └── ui/                # Shadcn UI components
│   ├── features/              # Feature modules (Order, Production, etc.)
│   ├── lib/
│   │   └── supabase/          # Supabase client config
│   ├── services/              # API services
│   ├── store/                 # Zustand stores
│   ├── types/
│   │   └── database.ts        # Database type definitions
│   └── middleware.ts          # Auth middleware
├── supabase/
│   └── migrations/            # SQL migration files
│       └── 20241205000001_phase1_core_schema.sql
└── env.template               # Environment variables template
```

## 🛠️ การติดตั้ง (Setup)

### 1. Clone Repository

```bash
git clone <repository-url>
cd anajaktshirt-superappv2
npm install
```

### 2. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) สร้างบัญชี (ฟรี)
2. สร้างโปรเจกต์ใหม่ เลือก Region `Southeast Asia (Singapore)`
3. รอสร้างเสร็จประมาณ 1-2 นาที

### 3. รัน Database Migration

1. เปิด Supabase Dashboard > **SQL Editor**
2. คัดลอกเนื้อหาจากไฟล์ `supabase/migrations/20241205000001_phase1_core_schema.sql`
3. Paste และกด **Run** (ระบบจะสร้างตารางทั้งหมดให้อัตโนมัติ)

### 4. ตั้งค่า Environment Variables

1. Copy `env.template` เป็น `.env.local`
   ```bash
   cp env.template .env.local
   ```

2. เปิด Supabase Dashboard > **Settings** > **API**
3. คัดลอก **Project URL** และ **anon public key** ใส่ใน `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. รันโปรเจกต์

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000) 🎉

## 📋 Development Roadmap

ดูแผนการพัฒนาฉบับเต็มได้ที่ `docs/ERP-FLOW-REDESIGN.md`

### ✅ Phase 0: Setup (เสร็จแล้ว)
- [x] Project initialization
- [x] Database schema design
- [x] Supabase integration
- [x] UI library setup

### 🔄 Phase 1: Order & Sales (กำลังทำ - 3-4 สัปดาห์)
- [ ] Customer Management (เพิ่ม/แก้ไขลูกค้า)
- [ ] Product Catalog (แค็ตตาล็อกสินค้า)
- [ ] Order Creation (สร้างออเดอร์)
- [ ] Pricing Engine (คำนวณราคาอัตโนมัติ)
- [ ] Quotation System (ใบเสนอราคา)

### 📅 Phase 2-8 (ดูใน docs/)
- Phase 2: Design & Approval
- Phase 3-5: Production Management
- Phase 6: Testing & Go-Live
- Phase 7: Enterprise (HR, Finance, WMS)
- Phase 8: Smart Factory (Gantt, Kiosk, Fleet)

## 📚 เอกสารเพิ่มเติม

- **แผนแม่บท ERP:** `docs/ERP-FLOW-REDESIGN.md`
- **Database Schema:** `supabase/migrations/`
- **Component Library:** [Shadcn/UI Docs](https://ui.shadcn.com)
- **Supabase Docs:** [docs.supabase.com](https://supabase.com/docs)

## 🤝 การมีส่วนร่วม

โปรเจกต์นี้อยู่ในช่วงพัฒนาเบื้องต้น หากต้องการมีส่วนร่วม:
1. Fork repository
2. สร้าง feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. เปิด Pull Request

## 📞 ติดต่อ

สำหรับข้อสงสัยหรือข้อเสนอแนะ กรุณาเปิด Issue ใน GitHub

---

**สร้างด้วย ❤️ สำหรับอุตสาหกรรม Garment & Screen Printing ในไทย**
