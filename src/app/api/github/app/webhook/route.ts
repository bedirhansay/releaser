import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  deleteInstallationById,
  markInstallationSuspended,
} from "@/features/github-app/github-app.service";

// GitHub App webhook. Handles installation lifecycle so our records stay in
// sync when a user uninstalls / suspends the App from GitHub's side.
//
// Signature: GitHub signs the raw body with HMAC-SHA256 using the App's webhook
// secret, sent as `x-hub-signature-256: sha256=<hex>`. We verify with a
// constant-time compare before trusting anything.

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  let payload: {
    action?: string;
    installation?: { id?: number };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const installationId = payload.installation?.id;
  if (event === "installation" && installationId) {
    switch (payload.action) {
      case "deleted":
        await deleteInstallationById(installationId);
        break;
      case "suspend":
        await markInstallationSuspended(installationId, true);
        break;
      case "unsuspend":
        await markInstallationSuspended(installationId, false);
        break;
    }
  }

  return NextResponse.json({ ok: true });
}
