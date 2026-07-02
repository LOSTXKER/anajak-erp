// ช่องทางบันทึกการคุยกับลูกค้า (Gate B7) — ค่าตาม comment ใน schema CommunicationLog
// แหล่งเดียวทั้ง dialog บันทึก + timeline แสดงผล (กันป้าย enum ดิบโผล่หน้าจอ)

export const COMM_CHANNELS: { value: string; label: string }[] = [
  { value: "LINE", label: "LINE" },
  { value: "PHONE", label: "โทรศัพท์" },
  { value: "EMAIL", label: "อีเมล" },
  { value: "IN_PERSON", label: "เจอหน้า/หน้าร้าน" },
  { value: "OTHER", label: "อื่นๆ" },
];

export function commChannelLabel(channel: string): string {
  return COMM_CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}
