import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import {
  getAiSettingStatus,
  upsertAiSettingForUser,
} from "@/features/settings/ai-settings.service";

// `apiKey` is write-only and never returned. Empty string clears the stored
// key (revert to env fallback); omitting it leaves the key untouched.
const putSchema = z.object({
  apiKey: z.string().max(400).optional(),
  baseUrl: z
    .union([z.string().url(), z.literal("")])
    .nullable()
    .optional(),
  model: z.string().trim().max(120).nullable().optional(),
});

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const status = await getAiSettingStatus(userId);
    return apiOk({ ai: status });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const body = putSchema.parse(await req.json());
    const status = await upsertAiSettingForUser(userId, {
      apiKey: body.apiKey,
      baseUrl: body.baseUrl === "" ? null : body.baseUrl,
      model: body.model,
    });
    return apiOk({ ai: status });
  } catch (err) {
    return handleApiError(err);
  }
}
