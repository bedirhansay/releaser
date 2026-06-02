"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Repository } from "@/core/git/types";

interface Props {
  value: string | null;
  onChange: (fullName: string) => void;
  repos: Repository[];
  isLoading?: boolean;
  /**
   * Present when the listing call failed. We never render this text — the repo
   * listing endpoints are best-effort (Bitbucket removed listing entirely and
   * returns 410, GitHub can 401), so on error the combobox degrades instead of
   * dumping a raw 410/JSON blob into the dropdown.
   */
  error?: string | null;
  placeholder?: string;
  /**
   * When set, the combobox is "manual-first": on a listing error or an empty
   * list it silently swaps to owner/repo text inputs with a muted hint, and it
   * always offers an "elle gir" escape hatch. Used by the standalone release
   * wizard where listing is unreliable. Left off, the component keeps its
   * plain picker behaviour (callers like the project form supply their own
   * manual toggle).
   */
  manualFallback?: boolean;
}

/** Split an "owner/repo" string; returns null if it isn't a clean pair. */
function splitFullName(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, "");
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  const owner = trimmed.slice(0, slash).trim();
  const repo = trimmed.slice(slash + 1).trim();
  if (!owner || !repo || repo.includes("/")) return null;
  return { owner, repo };
}

function ManualRepoEntry({
  value,
  onChange,
  hint,
  onUseList,
}: {
  value: string | null;
  onChange: (fullName: string) => void;
  hint: string;
  onUseList?: () => void;
}) {
  const parts = value ? splitFullName(value) : null;
  const [owner, setOwner] = useState(parts?.owner ?? "");
  const [repo, setRepo] = useState(parts?.repo ?? "");

  const emit = (nextOwner: string, nextRepo: string) => {
    const o = nextOwner.trim();
    const r = nextRepo.trim();
    // Only emit a usable selection once both halves are present, so the parent
    // never derives a half-filled "owner/" value.
    onChange(o && r ? `${o}/${r}` : "");
  };

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            emit(e.target.value, repo);
          }}
          placeholder="owner"
          aria-label="Repo sahibi"
          className="min-w-0"
        />
        <Input
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            emit(owner, e.target.value);
          }}
          placeholder="repo"
          aria-label="Repo adı"
          className="min-w-0"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>{hint}</span>
        {onUseList && (
          <button
            type="button"
            onClick={onUseList}
            className="underline underline-offset-2 hover:text-foreground"
          >
            listeden seç
          </button>
        )}
      </div>
    </div>
  );
}

export function RepoCombobox({
  value,
  onChange,
  repos,
  isLoading,
  error,
  placeholder = "Repo seç",
  manualFallback = false,
}: Props) {
  const [open, setOpen] = useState(false);
  // User explicitly chose manual entry from a working list ("elle gir").
  const [manual, setManual] = useState(false);

  // Listing is best-effort. In manual-first mode, an error or an empty list
  // means the picker is useless — switch to owner/repo inputs automatically.
  const listEmpty = !isLoading && !error && repos.length === 0;
  const showManual = manualFallback && (manual || !!error || listEmpty);

  if (showManual) {
    const hint = error
      ? "Repo listesi alınamadı — repoyu elle gir."
      : listEmpty
        ? "Liste boş — elle girebilirsin"
        : "Repoyu elle gir (owner / repo).";
    return (
      <ManualRepoEntry
        value={value}
        onChange={onChange}
        hint={hint}
        // Offer a way back to the list only when the list is actually usable.
        onUseList={
          manual && !error && !listEmpty ? () => setManual(false) : undefined
        }
      />
    );
  }

  const selected = repos.find((r) => r.fullName === value) ?? null;
  // Fall back to the raw value so an already-selected repo still shows while
  // the list is loading or when it isn't in the accessible set (e.g. editing).
  const label = selected?.fullName ?? value;

  return (
    <div className={manualFallback ? "grid gap-1.5" : undefined}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(props) => (
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
              {...props}
            >
              <span className="truncate">{label ?? placeholder}</span>
              {isLoading ? (
                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
              ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          )}
        />
        <PopoverContent
          className="w-[var(--trigger-width)] min-w-[320px] p-0"
          align="start"
        >
          <Command shouldFilter>
            <CommandInput placeholder="Repolarda ara…" />
            <CommandList className="max-h-72">
              {/* We deliberately never render `error` here. A failed listing
                  shows an empty state; the parent surfaces a graceful path. */}
              <CommandEmpty>
                {isLoading ? "Yükleniyor…" : "Repo bulunamadı."}
              </CommandEmpty>
              <CommandGroup>
                {repos.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.fullName}
                    onSelect={(picked) => {
                      onChange(picked);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <div className="flex w-full items-center">
                      <span className="truncate font-medium">
                        {r.fullName}
                      </span>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === r.fullName ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                    {r.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {r.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {manualFallback && (
        <div className="text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setManual(true)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            elle gir
          </button>
        </div>
      )}
    </div>
  );
}
