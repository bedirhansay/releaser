"use client";

import { Badge } from "@/components/ui/badge";
import type { RiskFinding } from "@/types/release";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<RiskFinding["kind"], string> = {
  auth: "Auth",
  database: "Database",
  payment: "Payment",
  config: "Config",
};

const SEVERITY_STYLES: Record<RiskFinding["severity"], string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function RiskList({ risks }: { risks: RiskFinding[] }) {
  if (!risks.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Riskli bir değişiklik tespit edilmedi.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {risks.map((r) => (
        <li
          key={`${r.kind}-${r.summary}`}
          className="rounded-md border border-border/60 bg-card/40 p-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline">{KIND_LABEL[r.kind]}</Badge>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide",
                SEVERITY_STYLES[r.severity],
              )}
            >
              {r.severity}
            </span>
          </div>
          <p className="mt-1.5 text-foreground">{r.summary}</p>
          {r.evidence.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {r.evidence.join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
