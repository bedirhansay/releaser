import { describe, expect, it } from "vitest";
import { buildTemplateMarkdown } from "./markdown";

describe("buildTemplateMarkdown", () => {
  it("renders title, meta line, and sections in order", () => {
    const md = buildTemplateMarkdown({
      title: "finsel v2026-05-22",
      projectName: "finsel",
      windowLabel: "son 20 PR",
      sections: [
        { heading: "Features", content: "- Yeni filtreleme" },
        { heading: "Bug Fixes", content: "- Dosya adı düzeltildi" },
      ],
    });

    expect(md).toContain("# finsel v2026-05-22");
    expect(md).toContain("_finsel · son 20 PR_");
    // Order preserved: Features heading appears before Bug Fixes.
    expect(md.indexOf("## Features")).toBeLessThan(md.indexOf("## Bug Fixes"));
    expect(md).toContain("- Yeni filtreleme");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("falls back to a placeholder for empty section content", () => {
    const md = buildTemplateMarkdown({
      title: "R",
      projectName: "p",
      windowLabel: "w",
      sections: [{ heading: "Empty", content: "   " }],
    });
    expect(md).toContain("## Empty");
    expect(md).toContain("_—_");
  });

  it("handles a template with no sections", () => {
    const md = buildTemplateMarkdown({
      title: "R",
      projectName: "p",
      windowLabel: "w",
      sections: [],
    });
    expect(md).toContain("# R");
    expect(md).not.toContain("##");
  });
});
