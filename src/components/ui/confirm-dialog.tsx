"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// มาตรฐานแทน window.confirm / window.prompt ทั้งระบบ (P1.0 — lint ห้ามใช้ของเดิมแล้ว)
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "ยกเลิกออเดอร์นี้?", destructive: true }))) return;
//
//   const promptText = usePromptText();
//   const reason = await promptText({ title: "เหตุผลที่ยกเลิก", required: true });
//   if (reason === null) return; // ผู้ใช้กดปิด

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  description?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  destructive?: boolean;
}

type PendingRequest =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

const ConfirmContext = React.createContext<{
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  promptText: (options: PromptOptions) => Promise<string | null>;
} | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingRequest | null>(null);
  const [inputValue, setInputValue] = React.useState("");

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ kind: "confirm", options, resolve });
    });
  }, []);

  const promptText = React.useCallback((options: PromptOptions) => {
    setInputValue("");
    return new Promise<string | null>((resolve) => {
      setPending({ kind: "prompt", options, resolve });
    });
  }, []);

  const close = React.useCallback(
    (result: boolean) => {
      if (!pending) return;
      if (pending.kind === "confirm") {
        pending.resolve(result);
      } else {
        pending.resolve(result ? inputValue.trim() : null);
      }
      setPending(null);
    },
    [pending, inputValue]
  );

  const options = pending?.options;
  const promptInvalid =
    pending?.kind === "prompt" &&
    (pending.options.required ?? true) &&
    inputValue.trim() === "";

  const value = React.useMemo(() => ({ confirm, promptText }), [confirm, promptText]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && close(false)}>
        <DialogContent className="max-w-sm">
          {options && (
            <>
              <DialogHeader>
                <DialogTitle>{options.title}</DialogTitle>
                {options.description && (
                  <DialogDescription className="whitespace-pre-line">
                    {options.description}
                  </DialogDescription>
                )}
              </DialogHeader>

              {pending?.kind === "prompt" && (
                <Textarea
                  autoFocus
                  rows={3}
                  value={inputValue}
                  placeholder={pending.options.placeholder}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              )}

              {/* มือถือ: ปุ่มเต็มแถวซ้อนกัน (เป้านิ้วโต) · จอใหญ่: ชิดขวาตามปกติ */}
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => close(false)}
                >
                  {options.cancelText ?? "ยกเลิก"}
                </Button>
                <Button
                  variant={options.destructive ? "destructive" : "default"}
                  className="w-full sm:w-auto"
                  disabled={promptInvalid}
                  onClick={() => close(true)}
                >
                  {options.confirmText ?? "ยืนยัน"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

function useConfirmContext() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("ต้องครอบ <ConfirmDialogProvider> ก่อนใช้ useConfirm/usePromptText");
  }
  return ctx;
}

export function useConfirm() {
  return useConfirmContext().confirm;
}

export function usePromptText() {
  return useConfirmContext().promptText;
}
