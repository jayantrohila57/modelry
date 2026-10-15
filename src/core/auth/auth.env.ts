import "server-only";

import { serverEnv } from "@/shared/config/env.server";

const MIN_SECRET_LENGTH = 32;

/** Dev-only fallback so `next dev` works without env; never used when NODE_ENV is production. */
const DEV_AUTH_SECRET = "local-dev-only-set-better-auth-secret-in-env";

export function resolveBetterAuthSecret(): string {
  const secret = serverEnv.BETTER_AUTH_SECRET.trim();

  if (secret.length >= MIN_SECRET_LENGTH) {
    return secret;
  }

  if (serverEnv.NODE_ENV === "production") {
    throw new Error(
      `BETTER_AUTH_SECRET is required for production (min ${MIN_SECRET_LENGTH} characters). Copy .env.example to .env.local and set a secret, e.g. \`openssl rand -base64 32\`.`,
    );
  }

  return DEV_AUTH_SECRET;
}

export function resolveBetterAuthBaseUrl(): string {
  const fromEnv = serverEnv.BETTER_AUTH_URL.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (serverEnv.VERCEL_URL) {
    return `https://${serverEnv.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
