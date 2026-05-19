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
import { cn } from "@/lib/utils";
import type { Repository } from "@/core/git/types";

interface Props {
  value: string | null;
  onChange: (fullName: string) => void;
  repos: Repository[];
  isLoading?: boolean;
  error?: string | null;
  placeholder?: string;
}

export function RepoCombobox({
  value,
  onChange,
  repos,
  isLoading,
  error,
  placeholder = "Repo seç",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = repos.find((r) => r.fullName === value) ?? null;

  return (
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
            <span className="truncate">
              {selected ? selected.fullName : placeholder}
            </span>
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
            {error ? (
              <div className="p-3 text-sm text-destructive">{error}</div>
            ) : (
              <>
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
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
