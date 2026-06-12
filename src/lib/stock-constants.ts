/**
 * ค่าคงที่ฝั่ง Stock ที่ ERP ต้องรู้ — ที่เดียวทั้งระบบ (client/server import ได้)
 *
 * DEFAULT_STOCK_LOCATION ต้องตรงกับรหัส location จริงในแอป Anajak Stock
 * (ตอนนี้โรงงานมีคลังเดียว: ANJ-WH01 "Anajak Office" → location "MAIN")
 * ถ้าฝั่ง Stock เปลี่ยน/เพิ่ม location ต้องอัปเดตที่นี่ — ทางถาวรจดเป็นหนี้ไว้:
 * ให้ Stock auto-pick location เมื่อ ERP ไม่ระบุ (ดู PROGRESS.md)
 */
export const DEFAULT_STOCK_LOCATION = "MAIN";
