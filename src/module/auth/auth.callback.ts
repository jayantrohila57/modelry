import type { Route } from "next";
import { PATH } from "@/shared/config/routes";

const APP_ORIGIN = "https://modelry.invalid";

export function getSafePostSignInCallback(value?: string | string[]): Route {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return PATH.CHAT.ROOT;

  try {
    const callback = new URL(candidate, APP_ORIGIN);
    if (callback.origin !== APP_ORIGIN) return PATH.CHAT.ROOT;
    return `${callback.pathname}${callback.search}${callback.hash}` as Route;
  } catch {
    return PATH.CHAT.ROOT;
  }
}

export function getSignInDestination(returnTo: string) {
  const callback = getSafePostSignInCallback(returnTo);
  return `${PATH.AUTH.SIGN_IN}?callbackUrl=${encodeURIComponent(callback)}` as const;
}
