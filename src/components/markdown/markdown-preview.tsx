"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

export function MarkdownPreview({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-zinc max-w-none dark:prose-invert",
        "prose-headings:tracking-tight prose-pre:bg-muted prose-code:before:hidden prose-code:after:hidden",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
