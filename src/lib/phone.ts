// เบอร์โทรเก็บเป็นตัวเลขล้วนทุกทางเข้า — กันซ้ำพลาด/ค้นไม่เจอเพราะคนพิมพ์ มี/ไม่มีขีด เว้นวรรค
// (audit ข้อ 5: เดิม normalize อยู่แค่ใน CustomerPicker — หน้า /customers เก็บเบอร์ดิบ)
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}
