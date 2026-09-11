import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtoCompare } from "./proto-compare";

const location = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.search) }));
(globalThis as Record<string, unknown>).React = React;

const variants = [{ key: "current", label: "ปัจจุบัน" }, { key: "a", label: "เอกสารโปร่ง" }, { key: "b", label: "พื้นที่ทำงาน" }] as const;
beforeEach(() => { location.search = ""; });
function html(render = (variant: string) => React.createElement("p", null, variant)) {
  return renderToStaticMarkup(React.createElement(ProtoCompare, { title: "เลือกโครงงาน", variants, render }));
}

describe("ProtoCompare frame contract", () => {
  it("shows every variant and carries the selected surface and scenario into both viewport frames", () => {
    location.search = "surface=work-order&case=pair&edge=1";
    const result = html();
    expect(result).toContain('data-proto-variants="current,a,b"');
    const frames = [...result.matchAll(/<iframe[^>]+src="([^"]+)"/g)];
    expect(frames).toHaveLength(6);
    expect(frames.map(([, source]) => new URLSearchParams(source.replaceAll("&amp;", "&").slice(1)).get("v"))).toEqual(["current", "a", "b", "current", "a", "b"]);
    for (const [, source] of frames) {
      const query = new URLSearchParams(source.replaceAll("&amp;", "&").slice(1));
      expect(query.get("surface")).toBe("work-order");
      expect(query.get("case")).toBe("pair");
      expect(query.get("edge")).toBe("1");
      expect(query.get("frame")).toBe("1");
    }
  });

  it("focuses one variant while keeping the overview controls", () => {
    location.search = "v=b&surface=desk";
    const result = html();
    expect(result.match(/<iframe/g)).toHaveLength(2);
    expect(result).toContain("ดูทั้งหมด");
    expect(result).toContain('title="พื้นที่ทำงาน · จอมือถือ"');
    expect(result).toContain('title="พื้นที่ทำงาน · จอคอมพิวเตอร์"');
  });

  it("renders just the requested real component in frame mode and never nests another frame", () => {
    location.search = "frame=1&v=b";
    const render = vi.fn((variant: string) => React.createElement("p", null, variant));
    const result = html(render);
    expect(render).toHaveBeenCalledExactlyOnceWith("b");
    expect(result).toContain("data-proto-preview=");
    expect(result).toContain('data-proto-key="b"');
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("<nav");
  });

  it("falls back to the current component for an invalid frame variant", () => {
    location.search = "frame=1&v=removed";
    expect(html()).toContain('data-proto-key="current"');
  });
});
