# แนวหน้าตา Anajak ERP

ใช้ **น้ำเงิน Anajak + Prompt** ตามทิศที่เบสเลือก; ให้ข้อมูลและทางลงมือเด่นตามงาน. ใช้ [ui-guidance](../bestos-brain/global-skills/ui-guidance/SKILL.md) ทุกงาน UI; สัญญาพฤติกรรม/สิทธิ์/public/print อยู่ [SPEC.md](SPEC.md) และขอบเขตที่อนุมัติอยู่ [ROADMAP.md](ROADMAP.md)

## แหล่งจริง
- [globals.css](src/app/globals.css): สี ฟอนต์ ลำดับอักษร พื้น เงา มุม และ animation; [layout](src/app/layout.tsx) โหลดฟอนต์
- [tokens](src/components/ui/tokens.ts) และ [control-size](src/components/ui/control-size.ts): ผิว/interaction/focus/เป้ากด; ปรับร่วมกันและตรวจ Light/Dark
- [PageShell](src/components/page-shell.tsx) / [PageHeader](src/components/page-header.tsx): โครงและบริบท; [Section](src/components/ui/section.tsx) / [Field](src/components/ui/field.tsx) / [ActionZone](src/components/ui/action-zone.tsx): ข้อมูล คำช่วย และคำสั่งใกล้จุดใช้
- [UI primitives](src/components/ui/), [สถานะ](src/lib/status-config.ts), [สิทธิ์](src/lib/permissions.ts), [รายการใน URL](src/hooks/use-list-page-state.ts): ค้นของเดิมก่อนขยาย; component ไม่สร้างกฎธุรกิจซ้ำ
- [Mockup](src/components/mockup/), [Public](src/components/public/public-page.tsx), [Print](src/components/print/print-document.tsx): ใช้ส่วนกลางของแต่ละงาน; กระดาษมีข้อจำกัดต่างจากหน้าจอ

## ใช้และปรับทิศ
คงคำช่วยที่ใช้ตัดสินใจ ลงมือ หรือแก้ผิดตรงจุดใช้ ลดข้อความซ้ำและกรอบที่แย่งสายตา. ความกว้าง/ความแน่น/ตารางหรือการ์ดเลือกตามภารกิจ; จำนวนปุ่ม สี ชิป หรือความยาวข้อความไม่พิสูจน์ UX

ทิศที่ยังไม่เคาะใช้ preview เล็กที่สุดจากงานจริงเพื่อรับ feedback; เพิ่มทางเลือกเมื่อมีข้อแลกที่ต่างกันและคงการทดลองให้ย้อนกลับได้. ทิศที่อนุมัติแล้วทำต่อในขอบเขตได้ ไม่สร้าง `/proto` หรือบังคับจำนวนแบบทุกงาน

ก่อนรับงาน เปิดจอที่เปลี่ยนและลองทางสำเร็จ/ทางติดขัดตาม SPEC; ตรวจว่าตาไปถูกจุด กดแล้วเกิดอะไร และไปต่ออย่างไร. ผล/จุดค้างอยู่ ROADMAP ไม่ใช้ภาพสวยหรือผลนับคลาสแทนการลองงาน
