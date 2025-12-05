# 🔧 Setup Guide - Anajak ERP v2

คู่มือการติดตั้งและเริ่มใช้งานโปรเจกต์อย่างละเอียด (ฉบับภาษาไทย)

## 📋 สิ่งที่ต้องเตรียม

- **Node.js** v18 หรือสูงกว่า ([ดาวน์โหลด](https://nodejs.org))
- **Git** ([ดาวน์โหลด](https://git-scm.com))
- **Text Editor:** VSCode แนะนำ ([ดาวน์โหลด](https://code.visualstudio.com))
- **บัญชี Supabase** (สมัครฟรีที่ [supabase.com](https://supabase.com))

---

## 🚀 ขั้นตอนที่ 1: ติดตั้งโปรเจกต์

### 1.1 Clone Repository

```bash
# Clone project (หรือ download ZIP)
git clone <repository-url>
cd anajaktshirt-superappv2

# ติดตั้ง dependencies
npm install
```

คาดว่าใช้เวลาประมาณ **1-2 นาที** (ขึ้นอยู่กับความเร็วอินเทอร์เน็ต)

### 1.2 ตรวจสอบการติดตั้ง

```bash
npm run dev
```

ถ้าเห็นข้อความนี้แสดงว่าติดตั้งสำเร็จ:
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
```

**กด Ctrl+C เพื่อหยุด** (ยังรันไม่ได้เพราะยังไม่ได้เชื่อม Database)

---

## 🗄️ ขั้นตอนที่ 2: สร้าง Supabase Database

### 2.1 สร้างโปรเจกต์ใน Supabase

1. เข้า [app.supabase.com](https://app.supabase.com)
2. สมัครบัญชี (ใช้ Gmail ก็ได้)
3. กด **"New Project"**
4. กรอกข้อมูล:
   - **Name:** `anajak-erp` (หรือชื่ออะไรก็ได้)
   - **Database Password:** ตั้งรหัสที่จำง่าย (เก็บไว้)
   - **Region:** เลือก `Southeast Asia (Singapore)` (ใกล้ที่สุด)
   - **Pricing Plan:** เลือก **Free** (เพียงพอสำหรับพัฒนา)
5. กด **"Create new project"**
6. รอประมาณ **2 นาที** (Supabase กำลังสร้าง Database ให้)

### 2.2 รัน SQL Migration

1. เปิด Supabase Dashboard
2. ซ้ายมือ เลือก **SQL Editor** (ไอคอนรูป `</>`)
3. กด **"+ New query"**
4. เปิดไฟล์ `supabase/migrations/20241205000001_phase1_core_schema.sql` ในโปรเจกต์
5. **Copy ทั้งหมด** แล้ว **Paste** ลงใน SQL Editor
6. กด **"Run"** (มุมล่างขวา)

✅ ถ้าเห็นข้อความ `Success. No rows returned` แสดงว่าสำเร็จ!

### 2.3 ตรวจสอบว่าตารางถูกสร้าง

1. ซ้ายมือ เลือก **Table Editor**
2. ควรเห็นตาราง:
   - `user_profiles`
   - `customers`
   - `products`
   - `orders`
   - `order_items`
   - ... (และอีกหลายตาราง)

---

## 🔑 ขั้นตอนที่ 3: เชื่อมต่อ Database

### 3.1 หา API Keys

1. เปิด Supabase Dashboard
2. ซ้ายมือ เลือก **Settings** (ไอคอนเฟือง)
3. เลือก **API**
4. คุณจะเห็น:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (ยาวมาก)

⚠️ **อย่าปิดหน้านี้ก่อน** (จะใช้คัดลอกในขั้นตอนถัดไป)

### 3.2 สร้างไฟล์ Environment Variables

ใน Terminal:

```bash
# สร้างไฟล์ .env.local จาก template
cp env.template .env.local
```

เปิดไฟล์ `.env.local` ด้วย Text Editor แล้วแก้:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co    # 👈 ใส่ Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...             # 👈 ใส่ anon key
```

**บันทึกไฟล์** (Ctrl+S)

---

## ✅ ขั้นตอนที่ 4: ทดสอบรันโปรเจกต์

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### ✅ ถ้าสำเร็จ คุณจะเห็น:

- Dashboard สีขาว/เทาสวยๆ
- ตัวเลขสถิติ (Total Orders, In Production, etc.)
- ข้อความ "Waiting for Database Connection..."

**🎉 ยินดีด้วย! โปรเจกต์พร้อมทำงานแล้ว**

### ❌ ถ้า Error:

#### Error: "Invalid Supabase URL"
➜ กลับไปเช็คไฟล์ `.env.local` ว่าคัดลอก URL ถูกต้องหรือไม่

#### Error: หน้าจอขาวเปล่า หรือ Blank
➜ เปิด Developer Console (กด F12) ดูว่ามี Error อะไร

#### Error: "Connection refused"
➜ ตรวจสอบว่า Supabase Project สร้างเสร็จแล้ว (ไม่ใช่สถานะ Paused)

---

## 📚 ขั้นตอนถัดไป

### 🎯 Phase 1: พัฒนา Order & Sales Module

ตอนนี้โปรเจกต์พร้อมแล้ว คุณสามารถเริ่มทำ:

1. **หน้า Customer Management** (เพิ่ม/แก้ไข/ลบลูกค้า)
2. **หน้า Product Catalog** (แสดงรายการสินค้า)
3. **หน้า Create Order** (สร้างออเดอร์ใหม่)
4. **Pricing Engine** (คำนวณราคาอัตโนมัติ)

ดูแผนงานละเอียดที่: `docs/ERP-FLOW-REDESIGN.md`

---

## 🆘 ติดปัญหา?

1. **เช็ค Terminal** มี Error อะไรไหม?
2. **เช็ค Browser Console** (F12 > Console) มี Error สีแดงไหม?
3. **เช็ค `.env.local`** ว่ามีไฟล์และกรอก API Key ครบหรือไม่?
4. **ลองรีสตาร์ท Server** (Ctrl+C แล้วรัน `npm run dev` ใหม่)

---

## 🎓 Tips สำหรับมือใหม่

- **VSCode Extensions ที่แนะนำ:**
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
  - Prettier (Code Formatter)

- **คำสั่งที่ใช้บ่อย:**
  ```bash
  npm run dev          # รัน development server
  npm run build        # build production
  npm run lint         # ตรวจสอบโค้ด
  ```

---

**Happy Coding! 🚀**

