import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
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
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "prisma/migrations/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
