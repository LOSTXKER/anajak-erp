/* ให้ด่านตรวจ (tsx) โหลดไฟล์ .css ของ CSS Module ได้ — คืนชื่อคลาสตามที่ขอ
   ใช้เฉพาะตอนรัน verify:* ที่เรนเดอร์ component จริงนอก Next (ไม่แตะโค้ดแอป) */
require.extensions[".css"] = (module) => {
  module.exports = new Proxy(
    {},
    { get: (_target, key) => (key === "__esModule" ? false : typeof key === "string" ? key : undefined) },
  );
};
