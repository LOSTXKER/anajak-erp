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

/* กฎที่บังคับเฉพาะไฟล์ .tsx (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไรไม่เป็นมาตรฐาน")
   จงใจไม่บังคับกับ .ts เพราะ src/components/ui/tokens.ts คือที่ที่ "ประกาศ" สูตร
   พวกนี้ — ถ้าบังคับด้วย ตัวนิยามเองจะผิดกฎตัวเอง (control-size.ts ก็ยกเว้นด้วยเหตุผลเดียวกัน) */
const tsxOnlyRules = [
  // กล่องลอย 15 จุดเคยเขียนขอบ/พื้น/มุมโค้งเพิ่มเองข้าง .overlay-surface แล้วเขียนไม่ตรงกัน
  // 5 สูตร: มุม lg/xl/2xl ปนกัน · บางจุดมีขอบ บางจุดไม่มี · โหมดมืดคนละเฉด
  {
    selector:
      "Literal[value=/overlay-surface[^\"]*(bg-white|border-slate|rounded-)|(bg-white|border-slate|rounded-)[^\"]*overlay-surface/]",
    message:
      "ห้ามใส่ขอบ/พื้น/มุมโค้งซ้ำให้กล่องลอย — ใช้ OVERLAY_PANEL จาก @/components/ui/tokens (.overlay-surface ให้ครบแล้ว)",
  },
  // วงแหวนโฟกัสเคยมี 8 สูตร ทั้งที่มีแค่ 4 ความหมาย — ต่างกันแค่ความเข้ม/ระยะเว้น
  // โดยไม่มีเหตุผล ทำให้ "โฟกัสอยู่ตรงไหน" ดูไม่เท่ากันทั้งเว็บ
  {
    selector:
      "Literal[value=/(focus|focus-visible):ring-(blue|red|amber|yellow|green|slate|orange)-[0-9]/]",
    message:
      "ห้ามเขียนวงแหวนโฟกัสเอง — ใช้ FOCUS_FIELD (ช่องกรอก) · FOCUS_BUTTON (ปุ่ม/แถวที่กดได้) · FOCUS_INSET (เต็มพื้นที่ เช่นหัวตาราง) · FOCUS_FIELD_INVALID (ช่องกรอกผิด) จาก @/components/ui/tokens",
  },
  {
    selector:
      "TemplateElement[value.raw=/(focus|focus-visible):ring-(blue|red|amber|yellow|green|slate|orange)-[0-9]/]",
    message:
      "ห้ามเขียนวงแหวนโฟกัสเอง — ใช้ FOCUS_FIELD / FOCUS_BUTTON / FOCUS_INSET / FOCUS_FIELD_INVALID จาก @/components/ui/tokens",
  },
  // ความสูง control — เดิมบังคับเฉพาะ src/components/ui/** ทำให้แถบบนก๊อปสูตร
  // "h-11 … sm:h-9" มาเขียนเองได้โดยไม่มีอะไรเตือน (audit 2026-08-01 จับได้)
  // ตอนนี้ครอบทั้ง src/**/*.tsx — ตัวนิยามอยู่ใน control-size.ts (เป็น .ts จึงไม่โดนกฎตัวเอง)
  {
    selector: "Literal[value=/(h-11|min-h-11)[^\"]*sm:(min-)?h-[89]/]",
    message:
      "ห้ามเขียนความสูง control เอง — import CONTROL_H / CONTROL_H_SM / CONTROL_MIN_H จาก @/components/ui/control-size",
  },
  {
    selector: "TemplateElement[value.raw=/(h-11|min-h-11)[^`]*sm:(min-)?h-[89]/]",
    message:
      "ห้ามเขียนความสูง control เอง — import CONTROL_H / CONTROL_H_SM / CONTROL_MIN_H จาก @/components/ui/control-size",
  },
  // ตัวหมุนรอโหลดเคยมี 11 แบบ (7 ขนาด + 2 จุดปั่นวงกลมด้วยขอบ CSS คนละหน้าตากับที่เหลือ)
  // ใน <Button> ไม่ต้องสั่งขนาด (Button บังคับไอคอน 15px ให้แล้ว) — ที่ดักคือ "สั่งขนาดเอง"
  {
    selector: "Literal[value=/animate-spin[^\"]*\\b(h|w|size)-|\\b(h|w|size)-[^\"]*animate-spin/]",
    message:
      "ห้ามสั่งขนาดตัวหมุนเอง — ใช้ <Spinner size=\"sm|md|lg|xl\" /> จาก @/components/ui/spinner (ในปุ่มไม่ต้องใส่ขนาดเลย)",
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
    // ⚠️ flat config "แทนที่" กฎชื่อเดียวกันทั้งก้อน ไม่ได้รวมให้ — ทุก block ที่ประกาศ
    // no-restricted-syntax ซ้ำต้องกระจาย uiLanguageRules เข้าไปด้วย ไม่งั้นด่านเดิมหายเงียบๆ
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...uiLanguageRules, ...tsxOnlyRules],
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
