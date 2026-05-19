"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "todo" | "active" | "done";

export interface Step {
  label: string;
  state: StepState;
}

// Horizontal 4-step indicator used at the top of the generate page. Pure
// presentational — caller decides which step is active/done.
export function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li
            key={s.label + i}
            className={cn(
              "flex items-center",
              !isLast && "flex-1",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-mono transition-colors",
                  s.state === "done" &&
                    "border-primary bg-primary text-primary-foreground",
                  s.state === "active" &&
                    "border-primary bg-background text-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_18%,transparent)]",
                  s.state === "todo" &&
                    "border-border bg-background text-muted-foreground",
                )}
              >
                {s.state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  s.state === "todo" && "text-muted-foreground",
                  s.state !== "todo" && "text-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-3 h-px flex-1 transition-colors",
                  s.state === "done" ? "bg-primary/60" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
