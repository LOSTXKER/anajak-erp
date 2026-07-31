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

// กฎภาษาของ UI ที่ใช้ทั้งโปรเจกต์ — แยกเป็นตัวแปรเพราะ flat config ของ eslint
// "แทนที่" กฎชื่อเดียวกันทั้งก้อนเมื่อประกาศซ้ำใน block หลัง ไม่ได้รวมให้
// (เคยพลาดมาแล้ว: พอเพิ่มกฎเฉพาะ ui/** ด่าน text-[Npx]/shadow-[/ระยะครึ่งขั้น
//  หายไปจากโฟลเดอร์นั้นเงียบๆ — ทดสอบเจอตอนแกล้งใส่โค้ดผิดกฎ)
const uiLanguageRules = [
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
        // ห้ามเขียนเงาเอง — เงามี 3 ระดับตามว่าของชิ้นนั้นลอยแค่ไหน (เบสเคาะ 2026-07-31)
        // ก่อนหน้านี้หลุดไป 10 แบบคนละค่ากันทั้งที่ทำหน้าที่เดียวกัน
        {
          selector: "Literal[value=/shadow-\\[/]",
          message:
            "ห้ามเขียนเงาเอง — ใช้ card-surface (นั่งกับที่) · card-surface-hover (ยกตอนชี้) · overlay-surface (ลอยจริง) · hairline-ring (เส้นบาง)",
        },
        {
          selector: "TemplateElement[value.raw=/shadow-\\[/]",
          message:
            "ห้ามเขียนเงาเอง — ใช้ card-surface (นั่งกับที่) · card-surface-hover (ยกตอนชี้) · overlay-surface (ลอยจริง) · hairline-ring (เส้นบาง)",
        },
        // ระยะขอบในกล่องและระยะห่างระหว่างของ ห้ามใช้ครึ่งขั้น — ต้นเหตุที่ของสองชิ้น
        // ดู "เกือบตรงกันแต่ไม่ตรง" · ขั้นที่ใช้ได้: gap 1.5/2/3/4/6 · p 2/3/4/5/6
        // (จงใจไม่ดัก px-/py- ครึ่งขั้น — พวกนั้นใช้จูนความสูงของปุ่ม/ช่องกรอก คนละเรื่องกัน)
        {
          selector:
            "Literal[value=/(^|[^-\\w])(p-(1|2|3)|gap-(2|3))\\.5([^\\w.]|$)/]",
          message:
            "ห้ามใช้ระยะครึ่งขั้น — gap ใช้ 1.5/2/3/4/6 · p ใช้ 2/3/4/5/6 (ยกเว้น gap-1.5 สำหรับไอคอนชิดข้อความ)",
        },
];

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
      "no-restricted-syntax": ["error", ...uiLanguageRules],
    },
  },
  {
    // ห้ามเขียนสูตรความสูง control เองในของกลาง (เบสเคาะ 2026-08-01 "แก้ที่รากได้มั้ย")
    // สูตร "h-11 ... sm:h-9" เคยถูกก๊อปซ้ำใน 6 component / 22 ไฟล์ พอสร้างของใหม่ก็ลอกกันมา
    // และลอกผิดตระกูลได้ — ตัวเลือกช่วงวันที่เคยลอกสไตล์ "ช่องกรอก" มาทำปุ่มเปิดเมนู
    // จนสูง/อักษร/น้ำหนักเพี้ยนจากปุ่มที่ยืนข้างกัน
    //
    // บังคับเฉพาะ src/components/ui/** = ที่ที่ "สร้าง control ใหม่" ตรงเจตนาของกฎ
    // ปุ่มไอคอนที่หน้าต่างๆ เขียน markup เองยังไม่โดน — นั่นเป็นหนี้อีกก้อน
    // (ควรเปลี่ยนไปใช้ <Button> แทน · บันทึกไว้ใน PROGRESS แล้ว)
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...uiLanguageRules,
        {
          selector: "Literal[value=/h-11[^\"]*sm:h-[89]/]",
          message:
            "ห้ามเขียนความสูง control เอง — import CONTROL_H / CONTROL_H_SM จาก ./control-size",
        },
        {
          selector: "TemplateElement[value.raw=/h-11[^`]*sm:h-[89]/]",
          message:
            "ห้ามเขียนความสูง control เอง — import CONTROL_H / CONTROL_H_SM จาก ./control-size",
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
