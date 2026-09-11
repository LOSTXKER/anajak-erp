"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FOCUS_INSET, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { useProtoFlag, useProtoVariant } from "./use-proto-variant";

export type ProtoVariant<K extends string> = {
  key: K;
  label: string;
  tradeoff?: string;
};

type Props<K extends string> = {
  title: string;
  /** The first variant is the current UI; "all" is reserved for comparison. */
  variants: readonly ProtoVariant<K>[];
  render: (variant: K) => ReactNode;
  controls?: ReactNode;
  mobile?: { width: number; height: number };
  desktopHeight?: number;
};

const ALL = "all" as const;

export function ProtoCompare<K extends string>(props: Props<K>) {
  return (
    <Suspense fallback={null}>
      <Compare {...props} />
    </Suspense>
  );
}

function Compare<K extends string>({
  title,
  variants,
  render,
  controls,
  mobile = { width: 390, height: 780 },
  desktopHeight = 720,
}: Props<K>) {
  const keys = variants.map((variant) => variant.key);
  const [focus, setFocus] = useProtoVariant<K | typeof ALL>(
    "v",
    [ALL, ...keys],
    ALL,
  );
  const [isFrame] = useProtoFlag("frame");
  const search = useSearchParams().toString();
  const first = variants[0];

  if (!first) {
    return <p role="status">ยังไม่มีแบบให้เปรียบเทียบ</p>;
  }

  // Each iframe renders only the real component, at its own viewport width.
  if (isFrame) {
    const key = focus === ALL ? first.key : focus;
    return (
      <div data-proto-preview data-proto-key={key} className="min-w-0 w-full">
        {render(key)}
      </div>
    );
  }

  const frameSrc = (key: K) => {
    const query = new URLSearchParams(search);
    query.set("v", key);
    query.set("frame", "1");
    return `?${query.toString()}`;
  };
  const shown = focus === ALL
    ? variants
    : variants.filter((variant) => variant.key === focus);

  return (
    <main
      data-proto-variants={keys.join(",")}
      className="min-h-screen min-w-0 w-full max-w-full bg-background px-4 py-6 text-foreground"
    >
      <h1 className="break-words text-lg font-semibold">{title}</h1>
      <nav aria-label="เลือกแบบที่ต้องการดู" className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={focus === ALL ? "default" : "outline"}
          aria-pressed={focus === ALL}
          onClick={() => setFocus(ALL)}
        >
          ดูทั้งหมด
        </Button>
        {variants.map((variant) => (
          <Button
            key={variant.key}
            type="button"
            variant={focus === variant.key ? "default" : "outline"}
            aria-pressed={focus === variant.key}
            aria-label={`ขยายดู ${variant.label}`}
            className="max-w-full whitespace-normal break-words"
            onClick={() => setFocus(variant.key)}
          >
            {variant.label}
          </Button>
        ))}
      </nav>
      {controls && <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">{controls}</div>}

      <section
        aria-label="เปรียบเทียบจอมือถือ เลื่อนซ้ายขวาเพื่อดูทุกแบบ"
        className="mt-5 flex min-w-0 max-w-full snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain pb-3"
      >
        {shown.map((variant) => (
          <figure key={variant.key} data-proto-key={variant.key} className="min-w-0 shrink-0 snap-start" style={{ width: mobile.width }}>
            <iframe
              title={`${variant.label} · จอมือถือ`}
              src={frameSrc(variant.key)}
              width={mobile.width}
              height={mobile.height}
              className={cn("block border border-border bg-background", RADIUS.surface, FOCUS_INSET)}
            />
            <Caption variant={variant} />
          </figure>
        ))}
      </section>

      <section aria-label="เปรียบเทียบจอคอมพิวเตอร์" className="mt-6 hidden min-w-0 space-y-6 lg:block">
        {shown.map((variant) => (
          <figure key={variant.key} data-proto-key={variant.key} className="min-w-0">
            <iframe
              title={`${variant.label} · จอคอมพิวเตอร์`}
              src={frameSrc(variant.key)}
              width="100%"
              height={desktopHeight}
              className={cn("block w-full border border-border bg-background", RADIUS.surface, FOCUS_INSET)}
            />
            <Caption variant={variant} />
          </figure>
        ))}
      </section>
    </main>
  );
}

function Caption({ variant }: { variant: ProtoVariant<string> }) {
  return (
    <figcaption className="mt-2 break-words text-sm">
      <span className="font-semibold">{variant.label}</span>
      {variant.tradeoff && <span className="text-muted-foreground"> · {variant.tradeoff}</span>}
    </figcaption>
  );
}
