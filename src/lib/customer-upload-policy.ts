/** กติกาไฟล์ลูกค้าชุดเดียวสำหรับตัวเลือกไฟล์และด่าน server */
export const CUSTOMER_UPLOAD_MAX_MB = 25;
export const CUSTOMER_UPLOAD_MAX_BYTES = CUSTOMER_UPLOAD_MAX_MB * 1024 * 1024;
export const CUSTOMER_UPLOAD_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff",
  "pdf", "ai", "psd", "eps", "zip", "rar", "7z",
] as const;
export const CUSTOMER_UPLOAD_ACCEPT = CUSTOMER_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(",");
