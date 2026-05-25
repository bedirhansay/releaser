"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Quick-add labels the user named explicitly. These are *suggestions* — the
// input is fully free-form, so any string can be added.
const SUGGESTED_TAGS = ["backend", "frontend"] as const;

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Hard cap mirrored on the server (`normalizeTags`). */
  max?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Free-form tag editor: type a label and press Enter/comma to add it, click ×
 * to remove. Tags are lower-cased + de-duped to match the server's
 * `normalizeTags`, so what you see here is what gets persisted.
 */
export function TagInput({
  value,
  onChange,
  max = 20,
  placeholder = "Etiket yaz, Enter'a bas…",
  className,
  disabled,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      // Backspace on an empty field pops the last tag — fast keyboard editing.
      removeTag(value[value.length - 1]);
    }
  };

  const atCap = value.length >= max;
  const remainingSuggestions = SUGGESTED_TAGS.filter(
    (t) => !value.includes(t),
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`${tag} etiketini kaldır`}
                className="grid h-3.5 w-3.5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        <Input
          value={draft}
          disabled={disabled || atCap}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={atCap ? `En fazla ${max} etiket` : placeholder}
          className="h-7 w-auto min-w-[10rem] flex-1 border-dashed"
          aria-label="Yeni etiket"
        />
      </div>

      {!disabled && remainingSuggestions.length > 0 && !atCap && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Hızlı ekle:</span>
          {remainingSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="inline-flex items-center gap-1 rounded-4xl border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
