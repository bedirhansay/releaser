import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  GitAuthError,
  GitNotFoundError,
  GitProviderError,
} from "@/core/git/errors";
import { ForbiddenError, UnauthorizedError } from "./require-session";
import { RateLimitError } from "./rate-limit";

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function apiError(
  message: string,
  status = 400,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: message, details },
    { status, headers },
  );
}

/**
 * Single translation point from thrown errors to HTTP responses. Route
 * handlers stay one-liners; behaviour is uniform across the surface.
 *
 * In production, unknown 5xx errors return a generic message — the detail
 * stays in the server log to avoid leaking internals. Auth/quota/validation
 * errors keep their text since users need it to course-correct.
 */
export function handleApiError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    return apiError("Invalid request", 422, err.flatten());
  }
  if (err instanceof UnauthorizedError) {
    return apiError(err.message, 401);
  }
  if (err instanceof ForbiddenError) {
    return apiError(err.message, 403);
  }
  if (err instanceof RateLimitError) {
    return apiError(err.message, 429, undefined, {
      "Retry-After": String(err.retryAfterSec),
    });
  }
  if (err instanceof GitAuthError) {
    return apiError(err.message, 401);
  }
  if (err instanceof GitNotFoundError) {
    return apiError(err.message, 404);
  }
  if (err instanceof GitProviderError) {
    return apiError(err.message, err.status ?? 502);
  }

  // OpenAI SDK errors carry a numeric status; surface auth/quota issues with
  // a clearer message and the right HTTP code so the UI can react properly.
  const aiStatus = (err as { status?: number })?.status;
  if (aiStatus === 401) {
    return apiError(
      `AI provider rejected the request: ${msg(err)}`,
      502,
    );
  }
  if (aiStatus === 429) {
    return apiError(
      `AI provider out of credits or rate-limited: ${msg(err)}`,
      429,
    );
  }

  // Anything else is a true unknown. Log it server-side; return a generic
  // message in production so we don't leak stack traces or internal paths.
  console.error("[api] unhandled error", err);
  const isProd = process.env.NODE_ENV === "production";
  return apiError(
    isProd ? "Internal error — please try again." : msg(err),
    500,
  );
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}
