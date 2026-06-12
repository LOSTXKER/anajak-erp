-- FLOW-REDESIGN ก้อน 4 ชิ้น 1: เปลี่ยน URL ไฟล์ใน DB จาก Supabase public URL
-- เป็น proxy URL ถาวร `/api/files/<bucket>/<path>` (ดูเหตุผลใน src/lib/file-urls.ts)
--
-- data migration ล้วน — ไม่แตะ schema · host-agnostic (จับที่ marker /storage/v1/object/public/)
-- URL นอกระบบ/ค่าขยะ (เช่น products.image_url ที่อาจกรอกมือ) ไม่เข้าเงื่อนไข WHERE = ไม่ถูกแตะ
-- ย้อนกลับได้: replace '/api/files/' ด้วย '<SUPABASE_URL>/storage/v1/object/public/'

-- ===== คอลัมน์เดี่ยว (TEXT) =====

UPDATE users
SET avatar_url = regexp_replace(avatar_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE avatar_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE brand_profiles
SET logo_url = regexp_replace(logo_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE logo_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE order_item_products
SET pattern_file_url = regexp_replace(pattern_file_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE pattern_file_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE order_item_prints
SET design_image_url = regexp_replace(design_image_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE design_image_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE patterns
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE patterns
SET thumbnail_url = regexp_replace(thumbnail_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE thumbnail_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE quotations
SET pdf_url = regexp_replace(pdf_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE pdf_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE products
SET image_url = regexp_replace(image_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE image_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE attachments
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE design_versions
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE design_versions
SET thumbnail_url = regexp_replace(thumbnail_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE thumbnail_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE payments
SET evidence_url = regexp_replace(evidence_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE evidence_url ~ '^https?://[^/]+/storage/v1/object/public/';

UPDATE wht_certificates
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/', '/api/files/')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/public/';

-- ===== คอลัมน์ array (TEXT[]) — แปลงรายตัว รักษาลำดับเดิม =====

UPDATE products
SET images = (
  SELECT coalesce(
    array_agg(regexp_replace(u, '^https?://[^/]+/storage/v1/object/public/', '/api/files/') ORDER BY ord),
    '{}'
  )
  FROM unnest(images) WITH ORDINALITY AS t(u, ord)
)
WHERE EXISTS (
  SELECT 1 FROM unnest(images) u
  WHERE u ~ '^https?://[^/]+/storage/v1/object/public/'
);

UPDATE goods_receipts
SET photo_urls = (
  SELECT coalesce(
    array_agg(regexp_replace(u, '^https?://[^/]+/storage/v1/object/public/', '/api/files/') ORDER BY ord),
    '{}'
  )
  FROM unnest(photo_urls) WITH ORDINALITY AS t(u, ord)
)
WHERE EXISTS (
  SELECT 1 FROM unnest(photo_urls) u
  WHERE u ~ '^https?://[^/]+/storage/v1/object/public/'
);

UPDATE qc_defects
SET photo_urls = (
  SELECT coalesce(
    array_agg(regexp_replace(u, '^https?://[^/]+/storage/v1/object/public/', '/api/files/') ORDER BY ord),
    '{}'
  )
  FROM unnest(photo_urls) WITH ORDINALITY AS t(u, ord)
)
WHERE EXISTS (
  SELECT 1 FROM unnest(photo_urls) u
  WHERE u ~ '^https?://[^/]+/storage/v1/object/public/'
);
