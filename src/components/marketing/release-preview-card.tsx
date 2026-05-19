import { cn } from "@/lib/utils";

// Hand-built mock of what Releaser produces. Static SVG-feel rendering — no
// real data dependency — used in the hero and "how it works" sections.
export function ReleasePreviewCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-2xl",
        "backdrop-blur supports-[backdrop-filter]:bg-card/70",
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          releaser ▸ web-app · main…release/2026.05
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
          oluşturuldu
        </span>
      </div>

      {/* Body — markdown-ish preview */}
      <div className="grid gap-4 px-5 py-5 text-sm">
        <div>
          <div className="font-serif text-xl italic leading-tight text-foreground">
            Auth sıkılaştırma &amp; daha hızlı commit alımı
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            27 pull request içinde 142 commit, 11 maddede özetlendi.
          </p>
        </div>

        <ul className="space-y-2.5">
          <Entry
            kind="features"
            title="Bitbucket workspace seçici eklendi"
            refs={["#412", "#418"]}
          />
          <Entry
            kind="fixes"
            title="Rotate sonrası session cookie yenilenmiyordu"
            refs={["#427"]}
          />
          <Entry
            kind="perf"
            title="Compare endpoint cache p95'i 380ms düşürdü"
            refs={["a91b3c2", "#431"]}
          />
          <Entry
            kind="breaking"
            title="Eski /v1/releases endpoint kaldırıldı"
            refs={["#420"]}
          />
        </ul>

        {/* Risk strip */}
        <div className="mt-1 rounded-md border border-primary/30 bg-primary/[0.06] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="eyebrow text-primary">Risk</span>
            <span className="text-foreground/70">
              auth · yüksek — session rotation{" "}
              <span className="font-mono">src/auth/session.ts</span>&apos;e
              dokunuyor
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  features: "bg-emerald-500/80",
  fixes: "bg-amber-500/80",
  perf: "bg-sky-500/80",
  breaking: "bg-rose-500/80",
};
const KIND_LABEL: Record<string, string> = {
  features: "feat",
  fixes: "fix",
  perf: "perf",
  breaking: "break",
};

function Entry({
  kind,
  title,
  refs,
}: {
  kind: keyof typeof KIND_COLOR;
  title: string;
  refs: string[];
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          KIND_COLOR[kind],
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[kind]}
          </span>
          <span className="text-foreground">{title}</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {refs.join(" · ")}
        </div>
      </div>
    </li>
  );
}
