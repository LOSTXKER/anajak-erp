# 🔗 Supabase Setup Guide

## ขั้นตอนที่ 1: คัดลอก DATABASE_URL จาก Supabase

1. ไปที่ Supabase Dashboard
2. เลือก Project ที่สร้างไว้
3. ไปที่ **Settings** > **Database**
4. หาส่วน **Connection String**
5. เลือกแท็บ **"URI"**
6. คัดลอก URL ทั้งหมด

## ขั้นตอนที่ 2: อัปเดต .env.local

แก้ไขไฟล์ `.env.local` ในโปรเจกต์:

```env
# แทนที่ DATABASE_URL เดิม
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxxx.supabase.co:5432/postgres"

# เก็บ Supabase URLs ไว้สำหรับอนาคต (ถ้าจะใช้ Auth/Storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **แทนที่:**
- `YOUR_PASSWORD` = รหัสผ่าน Database ที่ตั้งตอนสร้าง Project
- `xxxxxx` = Project Reference จาก URL

## ขั้นตอนที่ 3: Push Schema ไป Supabase

เลือก **1 ใน 2 วิธี**:

### วิธีที่ 1: ใช้ Prisma Migrate (แนะนำ)
```bash
npx prisma migrate dev --name init
```

### วิธีที่ 2: ใช้ SQL โดยตรง
1. ไปที่ Supabase Dashboard
2. เลือก **SQL Editor** (ซ้ายมือ)
3. คัดลอกเนื้อหาจาก `supabase/migrations/20241205000001_phase1_core_schema.sql`
4. Paste และกด **Run**

## ขั้นตอนที่ 4: ทดสอบ Connection

```bash
# ทดสอบ connection
npm run test:db

# หรือเปิด Prisma Studio
npx prisma studio
```

## ขั้นตอนที่ 5: รันโปรเจกต์

```bash
npm run dev
```

เปิดเบราว์เซอร์:
- http://localhost:3000/customers
- http://localhost:3000/products

ลองเพิ่มข้อมูลทดสอบ!

---

## 🆘 แก้ปัญหา

### Error: "Can't reach database server"
- เช็คว่า DATABASE_URL ถูกต้อง
- เช็คว่าใส่รหัสผ่านถูกต้อง
- เช็คว่า Supabase Project ไม่ถูก Pause

### Error: "Table does not exist"
- ยังไม่ได้รัน migration
- ใช้คำสั่ง `npx prisma db push` เพื่อ sync schema

---

## ✅ เมื่อตั้งค่าเสร็จ

คุณจะสามารถ:
- ✅ เพิ่ม/แก้ไข/ลบ ลูกค้าได้
- ✅ เพิ่ม/แก้ไข/ลบ สินค้าได้
- ✅ ดูข้อมูลใน Prisma Studio
- ✅ ดูข้อมูลใน Supabase Dashboard > Table Editor

