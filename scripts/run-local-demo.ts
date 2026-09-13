import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import {
  DEMO_DATABASE_TARGET,
  DEMO_RESET_TOKEN,
  validateDemoDatabaseUrl,
} from "../src/lib/demo-seed-plan";

const CONTAINER_NAME = "anajak-postgres";

function readContainerEnv(name: "POSTGRES_USER" | "POSTGRES_PASSWORD") {
  const value = execFileSync("docker", ["exec", CONTAINER_NAME, "printenv", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  if (!value) throw new Error(`ไม่พบ ${name} ใน Docker ${CONTAINER_NAME}`);
  return value;
}

function buildLocalDemoDatabaseUrl() {
  const username = encodeURIComponent(readContainerEnv("POSTGRES_USER"));
  const password = encodeURIComponent(readContainerEnv("POSTGRES_PASSWORD"));
  const databaseUrl =
    `postgresql://${username}:${password}` +
    `@${DEMO_DATABASE_TARGET.hostname}:${DEMO_DATABASE_TARGET.port}` +
    `/${DEMO_DATABASE_TARGET.database}?schema=public`;
  validateDemoDatabaseUrl(databaseUrl);
  return databaseUrl;
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "dev" && mode !== "reset") {
    throw new Error("ใช้คำสั่งนี้ผ่าน npm run dev:demo หรือ npm run db:seed:demo เท่านั้น");
  }

  const root = process.cwd();
  const databaseUrl = buildLocalDemoDatabaseUrl();
  const command = path.join(root, "node_modules", ".bin", mode === "dev" ? "next" : "tsx");
  const args = mode === "dev" ? ["dev"] : ["prisma/seed-demo.ts", "--reset"];
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      ANAJAK_ERP_DEMO_MODE: "1",
      ANAJAK_STOCK_API_URL: "",
      ANAJAK_STOCK_API_KEY: "",
      ...(mode === "reset" ? { DEMO_SEED_RESET_TOKEN: DEMO_RESET_TOKEN } : {}),
    },
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => child.kill(signal));
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
