/**
 * หน้าเต็มจอของหน้าลอง "หรี่สี" — ไม่มีของหน้าเทียบปน
 * เป็น server component ที่อ่าน searchParams ตรง ๆ เพื่อให้เปิดลิงก์ `?v=flat`
 * แล้วเห็นแบบที่กดมาตั้งแต่เฟรมแรก ไม่ใช่เห็น "ตอนนี้" แว้บหนึ่งก่อน
 */

import { QUIET_LEVELS, type QuietLevel } from "../_levels-data";
import { QuietStyle } from "../_levels";
import { QuietScreen } from "../_screen";

const VALUES = QUIET_LEVELS.map((level) => level.value);

export default async function QuietProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const level = (VALUES.find((item) => item === pick("v")) ?? "current") as QuietLevel;
  const plainNumbers = pick("plain") === "1";

  return (
    <>
      <QuietStyle />
      <div
        data-quiet={level}
        data-nums={plainNumbers ? "plain" : undefined}
        className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8"
      >
        <QuietScreen />
      </div>
    </>
  );
}
