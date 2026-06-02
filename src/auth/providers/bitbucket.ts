import type { OAuthConfig } from "next-auth/providers";

// Auth.js v5 doesn't ship a built-in Bitbucket provider, but Bitbucket Cloud
// speaks plain OAuth2. We model the bits Auth.js needs.
//
// Setup (Workspace settings → OAuth consumers):
//   Callback URL: <APP_URL>/api/auth/callback/bitbucket
//   Permissions:  Account (read), Repositories (read)
// We only request `account repository` — email is fetched best-effort from
// /2.0/user/emails and tolerated if the consumer doesn't grant it, so the
// `email` scope is intentionally NOT requested (keeps consumer setup minimal).
export interface BitbucketProfile {
  uuid: string;
  username: string;
  display_name: string;
  account_id: string;
  links?: { avatar?: { href?: string } };
  // Augmented client-side from /2.0/user/emails (Bitbucket doesn't return email
  // in the profile payload).
  email?: string | null;
}

export function Bitbucket(options: {
  clientId?: string;
  clientSecret?: string;
}): OAuthConfig<BitbucketProfile> {
  return {
    id: "bitbucket",
    name: "Bitbucket",
    type: "oauth",
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorization: {
      url: "https://bitbucket.org/site/oauth2/authorize",
      params: { scope: "account repository" },
    },
    token: "https://bitbucket.org/site/oauth2/access_token",
    userinfo: {
      url: "https://api.bitbucket.org/2.0/user",
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const headers = {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        };
        const [userRes, emailsRes] = await Promise.all([
          fetch("https://api.bitbucket.org/2.0/user", { headers }),
          fetch("https://api.bitbucket.org/2.0/user/emails", { headers }),
        ]);
        if (!userRes.ok) {
          throw new Error(`Bitbucket /user failed: ${userRes.status}`);
        }
        const user = (await userRes.json()) as BitbucketProfile;
        if (emailsRes.ok) {
          const body = (await emailsRes.json()) as {
            values?: Array<{ email: string; is_primary?: boolean; is_confirmed?: boolean }>;
          };
          const primary =
            body.values?.find((e) => e.is_primary && e.is_confirmed) ??
            body.values?.[0];
          user.email = primary?.email ?? null;
        }
        return user;
      },
    },
    profile(profile) {
      return {
        id: profile.uuid,
        name: profile.display_name ?? profile.username,
        email: profile.email ?? null,
        image: profile.links?.avatar?.href ?? null,
      };
    },
  };
}
