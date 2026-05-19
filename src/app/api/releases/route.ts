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

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const releases = await listReleasesForUser(userId);
    return apiOk({ releases });
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
