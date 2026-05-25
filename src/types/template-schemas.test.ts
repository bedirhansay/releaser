import { describe, expect, it } from "vitest";
import {
  parseTemplateSections,
  templateSectionsSchema,
} from "./template-schemas";

describe("templateSectionsSchema", () => {
  it("accepts a valid ordered section list", () => {
    const result = templateSectionsSchema.safeParse([
      { id: "a", heading: "Features", instruction: "List new features." },
      { id: "b", heading: "Fixes", instruction: "List bug fixes." },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects an empty list", () => {
    expect(templateSectionsSchema.safeParse([]).success).toBe(false);
  });

  it("rejects sections missing heading or instruction", () => {
    expect(
      templateSectionsSchema.safeParse([{ id: "a", heading: "", instruction: "x" }])
        .success,
    ).toBe(false);
  });
});

describe("parseTemplateSections", () => {
  it("returns typed sections for valid JSON", () => {
    const sections = parseTemplateSections([
      { id: "a", heading: "H", instruction: "I" },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("H");
  });

  it("returns [] for malformed input instead of throwing", () => {
    expect(parseTemplateSections(null)).toEqual([]);
    expect(parseTemplateSections({ nope: true })).toEqual([]);
    expect(parseTemplateSections([{ id: "a" }])).toEqual([]);
  });
});
