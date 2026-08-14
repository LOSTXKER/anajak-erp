"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MENU_ITEM,
  MENU_SEPARATOR,
  OVERLAY_PANEL,
  RADIUS,
} from "@/components/ui/tokens";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";

interface ProductRowActionsProps {
  productIndex: number;
  totalProducts: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  mode?: "inline" | "menu";
}

export function ProductRowActions({
  productIndex,
  totalProducts,
  onMove,
  onRemove,
  mode = "inline",
}: ProductRowActionsProps) {
  const [announcement, setAnnouncement] = useState("");
  const canMoveUp = productIndex > 0;
  const canMoveDown = productIndex < totalProducts - 1;
  const productNumber = productIndex + 1;

  const handleMove = (direction: -1 | 1) => {
    if ((direction === -1 && !canMoveUp) || (direction === 1 && !canMoveDown)) return;
    const nextNumber = direction === -1 ? productIndex : productIndex + 2;
    onMove(direction);
    setAnnouncement(`ย้ายสินค้าไปลำดับ ${nextNumber} แล้ว`);
  };

  const removeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onRemove}
      aria-label={`ลบสินค้า ${productNumber}`}
      className="text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
    >
      <Trash2 />
    </Button>
  );

  if (mode === "menu") {
    if (totalProducts === 1) return removeButton;

    return (
      <>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`จัดการสินค้า ${productNumber}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(OVERLAY_PANEL, "z-50 min-w-44 p-1")}
            >
              <DropdownMenu.Item
                disabled={!canMoveUp}
                onSelect={() => handleMove(-1)}
                className={cn(MENU_ITEM, CONTROL_MIN_H, RADIUS.item)}
              >
                <span className="flex items-center gap-2 [&_svg]:size-4">
                  <ArrowUp />เลื่อนขึ้น
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={!canMoveDown}
                onSelect={() => handleMove(1)}
                className={cn(MENU_ITEM, CONTROL_MIN_H, RADIUS.item)}
              >
                <span className="flex items-center gap-2 [&_svg]:size-4">
                  <ArrowDown />เลื่อนลง
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={MENU_SEPARATOR} />
              <DropdownMenu.Item
                onSelect={onRemove}
                className={cn(
                  MENU_ITEM,
                  CONTROL_MIN_H,
                  RADIUS.item,
                  "text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-800 dark:text-red-300 dark:data-[highlighted]:bg-red-950/40 dark:data-[highlighted]:text-red-200",
                )}
              >
                <span className="flex items-center gap-2 [&_svg]:size-4">
                  <Trash2 />ลบสินค้า
                </span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <span className="sr-only" aria-live="polite">{announcement}</span>
      </>
    );
  }

  return (
    <div
      className="flex items-center"
      role="group"
      aria-label={`จัดการสินค้า ${productNumber}`}
    >
      {totalProducts > 1 && (
        <>
          <div className="flex items-center" role="group" aria-label="จัดลำดับสินค้า">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleMove(-1)}
              disabled={!canMoveUp}
              aria-label={`เลื่อนสินค้า ${productNumber} ขึ้น`}
              className="w-11 px-0 sm:w-auto sm:px-3"
            >
              <ArrowUp />
              <span className="hidden sm:inline">ขึ้น</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleMove(1)}
              disabled={!canMoveDown}
              aria-label={`เลื่อนสินค้า ${productNumber} ลง`}
              className="w-11 px-0 sm:w-auto sm:px-3"
            >
              <ArrowDown />
              <span className="hidden sm:inline">ลง</span>
            </Button>
          </div>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-divider" />
        </>
      )}
      {removeButton}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
