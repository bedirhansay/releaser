import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import {
  listReleasesForOrg,
  saveRelease,
} from "@/features/releases/releases.service";
import { generatedReleaseSchema } from "@/types/release-schemas";
import { MAX_MARKDOWN_LEN, MAX_TEXT_LEN } from "@/shared/api/limits";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  /** Comma-separated tag filter, e.g. `tags=backend,frontend` (OR match). */
  tags: z.string().trim().min(1).max(200).optional(),
  /** Cursor encoded as `<isoDate>|<id>`. */
  cursor: z.string().optional(),
});

const tagSchema = z.string().trim().min(1).max(32);

// Bounded variant of the saved-release payload for the write path (the read
// schema stays lenient/unbounded for legacy rows). Caps the verbatim text
// fields so a client can't persist arbitrarily large rows.
const ingestReleaseSchema = generatedReleaseSchema.extend({
  title: z.string().max(MAX_TEXT_LEN),
  summary: z.string().max(MAX_TEXT_LEN),
  markdown: z.string().max(MAX_MARKDOWN_LEN),
});

const postSchema = z.object({
  provider: providerSchema,
  owner: z.string().min(1).max(200),
  repo: z.string().min(1).max(200),
  base: z.string().min(1).max(200),
  head: z.string().min(1).max(200),
  title: z.string().min(1).max(MAX_TEXT_LEN),
  markdown: z.string().min(1).max(MAX_MARKDOWN_LEN),
  tags: z.array(tagSchema).max(20).optional(),
  release: ingestReleaseSchema,
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSession();
    const { limit, search, tags, cursor } = listQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const page = await listReleasesForOrg(ctx, {
      limit,
      search,
      tags: tags?.split(",").map((t) => t.trim()).filter(Boolean),
      cursor: decoded,
    });
    return apiOk(page);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    const body = postSchema.parse(await req.json());
    const saved = await saveRelease(ctx, body);
    return apiOk({ release: { id: saved.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | undefined {
  const [iso, id] = raw.split("|");
  if (!iso || !id) return undefined;
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return undefined;
  return { createdAt, id };
}
