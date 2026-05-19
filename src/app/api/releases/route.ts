import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import {
  listReleasesForUser,
  saveRelease,
} from "@/features/releases/releases.service";
import { generatedReleaseSchema } from "@/types/release-schemas";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  /** Cursor encoded as `<isoDate>|<id>`. */
  cursor: z.string().optional(),
});

const postSchema = z.object({
  provider: providerSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
  title: z.string().min(1),
  markdown: z.string().min(1),
  release: generatedReleaseSchema,
});

export async function GET(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const { limit, search, cursor } = listQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const page = await listReleasesForUser(userId, {
      limit,
      search,
      cursor: decoded,
    });
    return apiOk(page);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const body = postSchema.parse(await req.json());
    const saved = await saveRelease(userId, body);
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
