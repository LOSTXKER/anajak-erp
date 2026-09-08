import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

function renderTable(cellPadding?: "default" | "compact" | "responsive") {
  return renderToStaticMarkup(
    createElement(
      DataTable.Root,
      { cellPadding },
      createElement(
        DataTable.Head,
        null,
        createElement(
          "tr",
          null,
          createElement(DataTable.Th, null, "ลูกค้า"),
          createElement(DataTable.SortableTh, { onSort: () => {} }, "กำหนดส่ง"),
        ),
      ),
      createElement(
        DataTable.Body,
        null,
        createElement("tr", null, createElement(DataTable.Td, null, "ตัวอย่าง")),
      ),
    ),
  );
}

describe("DataTable horizontal spacing", () => {
  it.each([
    [undefined, "[--data-table-cell-px:1.5rem]"],
    ["default", "[--data-table-cell-px:1.5rem]"],
    ["compact", "[--data-table-cell-px:0.75rem]"],
    ["responsive", "[--data-table-cell-px:1rem] xl:[--data-table-cell-px:1.5rem]"],
  ] as const)("%s keeps headers and rows aligned without changing row height", (padding, expected) => {
    const html = renderTable(padding);

    expect(html).toContain(expected);
    // Padding for a sortable header belongs on its button; an extra th padding would double the inset.
    expect(html).toContain('aria-sort="none" class="p-0"');
    const paddedTags = [...html.matchAll(/<(th|button|td)\b[^>]*class="([^"]*)"/g)]
      .filter(([, , className]) => className.includes("px-[var(--data-table-cell-px,1.5rem)]"));
    expect(paddedTags.map(([, tag]) => tag)).toEqual(["th", "button", "td"]);
    expect(paddedTags[0][2]).toContain("py-3");
    expect(paddedTags[1][2]).toContain("py-3");
    expect(paddedTags[2][2]).toContain("py-4 text-sm");
    expect(html).not.toContain("cellPadding=");
  });

  it("preserves explicit cell padding overrides and borderless embedded tables", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable.Root, { bordered: false, cellPadding: "compact" },
        createElement(DataTable.Body, null,
          createElement("tr", null, createElement(DataTable.Td, { className: "px-0" }, "ตัวอย่าง")),
        ),
      ),
    );

    expect(html).not.toContain("card-surface");
    expect(html).toMatch(/<td[^>]+class="[^"]*px-0/);
    expect(html).not.toContain("px-[var(--data-table-cell-px,1.5rem)]");
    expect(html).toContain("py-4 text-sm");
  });
});
