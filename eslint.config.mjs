import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const jsxA11yErrors = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([rule, setting]) => [
    rule,
    Array.isArray(setting) ? ["error", ...setting.slice(1)] : "error",
  ]),
);

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // UX0: เคลียร์หนี้ a11y เดิมครบแล้ว — violation ใหม่ต้องหยุด CI ทันที
      ...jsxA11yErrors,
      // Deprecated และรายงานซ้ำกับ label-has-associated-control ทุกจุด
      "jsx-a11y/label-has-for": "off",
      // ห้าม window.prompt/confirm/alert — ใช้ useConfirm/usePromptText จาก
      // @/components/ui/confirm-dialog (P1.0 กวาดของเก่าหมดแล้ว ยกเป็น error)
      "no-alert": "error",
      // catch เงียบ = กลืน error — อย่างน้อยต้องมี comment อธิบายว่าทำไมกลืนได้
      "no-empty": "error",
      // rule ชุด React Compiler (react-hooks v7) เจอ pattern เก่าในหน้า UI ที่
      // P1.0 จะ redesign อยู่แล้ว — คง warn ไว้เป็นลิสต์หนี้ ห้ามเพิ่มใหม่ · P1.0 ยกเป็น error
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // ห้ามสั่งขนาดตัวอักษรเป็น px ดิบ — ใช้บันได 8 ขั้นใน globals.css เท่านั้น
      // (เบสเคาะ 2026-07-31: ก่อนหน้านี้หลุดไป 24 ขนาด มีครึ่งพิกเซล 5 แบบ จนหน้าเว็บดูเบี้ยว)
      // ยกเว้นเอกสารสั่งพิมพ์กับจอโรงงาน — ดู override ข้างล่าง
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/text-\\[[0-9.]+px\\]/]",
          message:
            "ห้ามสั่งขนาดตัวอักษรเป็น px ดิบ — ใช้ text-2xs/xs/sm/base/lg/xl/2xl/3xl (บันไดใน globals.css)",
        },
        {
          selector: "TemplateElement[value.raw=/text-\\[[0-9.]+px\\]/]",
          message:
            "ห้ามสั่งขนาดตัวอักษรเป็น px ดิบ — ใช้ text-2xs/xs/sm/base/lg/xl/2xl/3xl (บันไดใน globals.css)",
        },
      ],
    },
  },
  {
    // เอกสารสั่งพิมพ์ = ขนาดล็อกกับกระดาษ A4 · จอโรงงาน = ตั้งใจใหญ่ให้อ่านระยะไกล
    // ทั้งสองไม่อยู่ในบันไดของหน้าจอทำงาน จึงสั่ง px ตรงได้
    files: [
      "src/components/print/**",
      "src/app/(print)/**",
      "src/app/factory/**",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", "prisma/migrations/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
