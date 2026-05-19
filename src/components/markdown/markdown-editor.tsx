"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";

// Monaco ships ~MB of code-splittable JS; lazy-load on the client only.
const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

interface Props {
  value: string;
  onChange: (next: string) => void;
  height?: string | number;
}

export function MarkdownEditor({ value, onChange, height = "100%" }: Props) {
  const { resolvedTheme } = useTheme();
  return (
    <Editor
      language="markdown"
      theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      height={height}
      options={{
        minimap: { enabled: false },
        wordWrap: "on",
        fontSize: 13,
        lineNumbers: "off",
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
      }}
    />
  );
}
