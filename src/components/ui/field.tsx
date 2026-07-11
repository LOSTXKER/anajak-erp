"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FieldState = "default" | "invalid" | "valid";

interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: React.AriaAttributes["aria-required"];
}

export interface FieldProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: React.ReactNode;
  children: React.ReactElement<FieldControlProps>;
  id?: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  state?: FieldState;
  visuallyHiddenLabel?: boolean;
}

function joinIds(...ids: Array<string | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export function Field({
  label,
  children,
  id,
  description,
  error,
  required = false,
  state = "default",
  visuallyHiddenLabel = false,
  className,
  ...props
}: FieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? children.props.id ?? `field-${generatedId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const invalid = state === "invalid" || Boolean(error);
  const describedBy = joinIds(
    children.props["aria-describedby"],
    descriptionId,
    errorId,
  );

  const control = React.cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-errormessage": errorId ?? children.props["aria-errormessage"],
    "aria-invalid": invalid || children.props["aria-invalid"] || undefined,
    "aria-required": required || children.props["aria-required"] || undefined,
  });

  return (
    <div
      className={cn("space-y-2", className)}
      data-field-state={invalid ? "invalid" : state}
      {...props}
    >
      <Label htmlFor={controlId} className={cn(visuallyHiddenLabel && "sr-only")}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-red-700 dark:text-red-400">
              *
            </span>
            <span className="sr-only"> (จำเป็น)</span>
          </>
        )}
      </Label>
      {control}
      {description && (
        <p id={descriptionId} className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs leading-relaxed text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
