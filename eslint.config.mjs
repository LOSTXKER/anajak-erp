import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const jsxA11yErrors = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([rule, setting]) => [
    rule,
    Array.isArray(setting) ? ["error", ...setting.slice(1)] : "error",
  ]),
);

// จุดชวนทบทวนตาม ui-guidance; ชื่อคลาสอย่างเดียวตัดสินคุณภาพของหน้าจอไม่ได้
// แยกไว้ใช้ซ้ำ เพราะ flat config แทนที่กฎชื่อเดียวกันทั้งก้อนเมื่อประกาศใน block หลัง
const uiLanguageRules = [
        {
          selector: "Literal[value=/text-\\[[0-9.]+px\\]/]",
          message:
            "ทบทวนขนาดตัวอักษรนี้กับลำดับการอ่านและจอมือถือ ตาม ui-guidance; ใช้บันไดใน globals.css เมื่อเหมาะกับบริบท",
        },
        {
          selector: "TemplateElement[value.raw=/text-\\[[0-9.]+px\\]/]",
          message:
            "ทบทวนขนาดตัวอักษรนี้กับลำดับการอ่านและจอมือถือ ตาม ui-guidance; ใช้บันไดใน globals.css เมื่อเหมาะกับบริบท",
        },
        // เงาควรช่วยแยกชั้นหรือชี้ส่วนที่ลงมือได้; เทียบกับพื้นจริงก่อนเลือกสูตร
        {
          selector: "Literal[value=/shadow-\\[/]",
          message:
            "ทบทวนว่าเงานี้ช่วยแยกชั้นหรือเน้นงานที่สำคัญ ตาม ui-guidance; พิจารณา card-surface/overlay-surface หากทำหน้าที่เดียวกัน",
        },
        {
          selector: "TemplateElement[value.raw=/shadow-\\[/]",
          message:
            "ทบทวนว่าเงานี้ช่วยแยกชั้นหรือเน้นงานที่สำคัญ ตาม ui-guidance; พิจารณา card-surface/overlay-surface หากทำหน้าที่เดียวกัน",
        },
        // ระยะตัดสินจากการใช้งานบน layout จริง
        // ขนาดเป้ากด/contrast/focus ยังคงตรวจจาก primitive และ verify:ui
];

// ทบทวนจุดนำรูปแบบไปใช้ใน .tsx; นิยาม token และขนาดใน .ts มีหน้าที่อีกอย่าง
const tsxOnlyRules = [
  // การปรับพื้นหรือกรอบกล่องลอยควรตรวจร่วมกับเนื้อหาและทั้งสองธีม
  {
    selector:
      "Literal[value=/overlay-surface[^\"]*(bg-white|border-slate|rounded-)|(bg-white|border-slate|rounded-)[^\"]*overlay-surface/]",
    message:
      "ทบทวนพื้นและกรอบกล่องลอยที่ปรับเพิ่ม ตาม ui-guidance; ตรวจ contrast และขอบเขตที่อ่านชัดทั้งสองธีม โดยเทียบกับ OVERLAY_PANEL",
  },
  // รูปแบบโฟกัสปรับได้ โดยต้องมองเห็นตำแหน่งคีย์บอร์ดชัดบนพื้นจริง
  {
    selector:
      "Literal[value=/(focus|focus-visible):ring-(blue|red|amber|yellow|green|slate|orange)-[0-9]/]",
    message:
      "ทบทวนโฟกัสนี้ว่ามองเห็นชัดและไม่ถูกตัด ตาม ui-guidance; พิจารณา FOCUS_FIELD/FOCUS_BUTTON/FOCUS_INSET/FOCUS_FIELD_INVALID หากตรงกับการใช้งาน",
  },
  {
    selector:
      "TemplateElement[value.raw=/(focus|focus-visible):ring-(blue|red|amber|yellow|green|slate|orange)-[0-9]/]",
    message:
      "ทบทวนโฟกัสนี้ว่ามองเห็นชัดและไม่ถูกตัด ตาม ui-guidance; พิจารณา FOCUS_FIELD/FOCUS_BUTTON/FOCUS_INSET/FOCUS_FIELD_INVALID หากตรงกับการใช้งาน",
  },
  // ความสูงเลือกตามเนื้อหาและอุปกรณ์; ขนาดเป้ากดขั้นต่ำยังตรวจแยกจากคำแนะนำนี้
  {
    selector: "Literal[value=/(h-11|min-h-11)[^\"]*sm:(min-)?h-[89]/]",
    message:
      "ทบทวนความสูงนี้กับข้อความและขนาดเป้ากดบนมือถือ ตาม ui-guidance; พิจารณา CONTROL_H/CONTROL_H_SM/CONTROL_MIN_H หากเหมาะกับบริบท",
  },
  {
    selector: "TemplateElement[value.raw=/(h-11|min-h-11)[^`]*sm:(min-)?h-[89]/]",
    message:
      "ทบทวนความสูงนี้กับข้อความและขนาดเป้ากดบนมือถือ ตาม ui-guidance; พิจารณา CONTROL_H/CONTROL_H_SM/CONTROL_MIN_H หากเหมาะกับบริบท",
  },
  // กล่องสีอาจใช้สื่อสถานะหรือจัดองค์ประกอบ; ทบทวนความหมายและระดับการเน้นจากงานจริง
  {
    selector:
      "Literal[value=/rounded-(lg|xl|2xl)[^\"]*(?<![:\\w-])border-(red|amber|yellow|green|blue)-[0-9]+[^\"]*(?<![:\\w-])bg-(red|amber|yellow|green|blue)-[0-9]+|(?<![:\\w-])border-(red|amber|yellow|green|blue)-[0-9]+[^\"]*(?<![:\\w-])bg-(red|amber|yellow|green|blue)-[0-9]+[^\"]*rounded-(lg|xl|2xl)/]",
    message:
      "ทบทวนว่ากล่องสีนี้สื่อสถานะและเหตุที่ต้องลงมือชัด ตาม ui-guidance; ใช้ Alert เมื่อควรประกาศข้อความเตือน หรือ TINT เมื่อเพียงต้องการชุดสี",
  },
  // ขอบประควรมีหน้าที่ที่เข้าใจได้จากเนื้อหา ไม่อาศัยรูปแบบเส้นอย่างเดียว
  {
    // (ไม่ดักเส้นคั่นด้านเดียว border-t/b/l/r — คนละเรื่องกับ "กล่องขอบประ")
    selector:
      "Literal[value=/^(?!.*border-[tblr]\\b).*(border-dashed[^\"]*border-slate-[0-9]+|border-slate-[0-9]+[^\"]*border-dashed)/]",
    message:
      "ทบทวนความหมายและความชัดของขอบประทั้งสองธีม ตาม ui-guidance; พิจารณา DASHED หากทำหน้าที่เดียวกัน",
  },
  // ตัวหมุนควรมีขนาดพอให้เห็นและมีสถานะที่ผู้ใช้เข้าใจว่ากำลังรออะไร
  {
    selector: "Literal[value=/animate-spin[^\"]*\\b(h|w|size)-|\\b(h|w|size)-[^\"]*animate-spin/]",
    message:
      "ทบทวนขนาดตัวหมุนและข้อความระหว่างรอ ตาม ui-guidance; พิจารณา Spinner หากตรงกับพื้นที่และสถานะนี้",
  },
  // สีเพิ่มใช้ได้เมื่อช่วยงานและมีความหมายสม่ำเสมอ; ตรวจร่วมกับพื้นและสีสถานะที่มีอยู่
  {
    selector:
      "Literal[value=/\\b(?:bg|text|border|ring|divide|from|via|to|fill|stroke|shadow|outline|accent|caret|decoration|placeholder)-(?:gray|zinc|neutral|stone|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
    message:
      "ทบทวนสีนี้กับความหมาย ลำดับการเน้น และ contrast ทั้งสองธีม ตาม ui-guidance; พิจารณา semantic token หากมีความหมายตรงกัน",
  },
  {
    selector:
      "TemplateElement[value.raw=/\\b(?:bg|text|border|ring|divide|from|via|to|fill|stroke|shadow|outline|accent|caret|decoration|placeholder)-(?:gray|zinc|neutral|stone|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
    message:
      "ทบทวนสีนี้กับความหมาย ลำดับการเน้น และ contrast ทั้งสองธีม ตาม ui-guidance; พิจารณา semantic token หากมีความหมายตรงกัน",
  },
];

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
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
      // การเลือกขนาด/เงาเป็นคำแนะนำให้ทบทวนตาม ui-guidance; ไม่ตัดสินการใช้งานจากชื่อคลาส
      "no-restricted-syntax": ["warn", ...uiLanguageRules],
    },
  },
  {
    // ⚠️ flat config "แทนที่" กฎชื่อเดียวกันทั้งก้อน ไม่ได้รวมให้ — ทุก block ที่ประกาศ
    // no-restricted-syntax ซ้ำต้องกระจาย uiLanguageRules เข้าไปด้วย ไม่งั้นด่านเดิมหายเงียบๆ
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["warn", ...uiLanguageRules, ...tsxOnlyRules],
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
