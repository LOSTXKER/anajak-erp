import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync(
  new URL("./dtf-batch-dialog.tsx", import.meta.url),
  "utf8",
);

describe("DTF batch V2 UI contract", () => {
  it("render action จาก server availableCommands และแสดง blocked reason", () => {
    expect(dialogSource).toContain("run.availableCommands.includes(command)");
    expect(dialogSource).toContain("run.blockedReason");
    expect(dialogSource).toContain('role="status"');
    expect(dialogSource).toMatch(/runHasCommand\(\s*run,\s*"markPrinted",?\s*\)/);
    expect(dialogSource).toMatch(/runHasCommand\(\s*run,\s*"cancel",?\s*\)/);
    expect(dialogSource).toMatch(/runHasCommand\(\s*run,\s*"complete",?\s*\)/);
  });

  it("ส่ง commandId คงเดิมเมื่อ retry และ revision ของทุก item ทั้ง mark/cancel", () => {
    expect(dialogSource).toContain("new Map<string, string>()");
    expect(dialogSource).toContain("lifecycleCommandIds.get(key)");
    expect(dialogSource).toContain("item.expectedRevision");
    expect(dialogSource).toMatch(
      /lifecycleCommandId\(\s*run\.id,\s*"cancel",\s*revisionItems,?\s*\)/,
    );
    expect(dialogSource).toMatch(
      /lifecycleCommandId\(\s*run\.id,\s*"markPrinted",\s*revisionItems,?\s*\)/,
    );
    expect(dialogSource.match(/items: revisionItems/g)).toHaveLength(2);
    expect(dialogSource).not.toContain("markPrinted.mutate({ runId: run.id })");
    expect(dialogSource).not.toContain("cancel.mutate({ runId: run.id })");
  });
});
