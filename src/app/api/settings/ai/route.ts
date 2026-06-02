import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import {
  getAiSettingStatus,
  upsertAiSettingForOrg,
} from "@/features/settings/ai-settings.service";
import { isPublicHttpUrl } from "@/shared/net/ssrf";

// `apiKey` is write-only and never returned. Empty string clears the stored
// key (revert to env fallback); omitting it leaves the key untouched.
const putSchema = z.object({
  apiKey: z.string().max(400).optional(),
  // SSRF guard: the server POSTs to this URL with the org's key, so reject
  // private/loopback hosts (cloud metadata, localhost, RFC1918) unless the
  // operator opts in via AI_ALLOW_PRIVATE_BASEURL.
  baseUrl: z
    .union([
      z
        .string()
        .url()
        .refine(isPublicHttpUrl, "baseUrl must be a public http(s) URL"),
      z.literal(""),
    ])
    .nullable()
    .optional(),
  model: z.string().trim().max(120).nullable().optional(),
});

export async function GET() {
  try {
    const ctx = await requireSession();
    const status = await getAiSettingStatus(ctx.orgId);
    return apiOk({ ai: status });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const body = putSchema.parse(await req.json());
    const status = await upsertAiSettingForOrg(ctx.orgId, {
      apiKey: body.apiKey,
      baseUrl: body.baseUrl === "" ? null : body.baseUrl,
      model: body.model,
    });
    return apiOk({ ai: status });
  } catch (err) {
    return handleApiError(err);
  }
}
