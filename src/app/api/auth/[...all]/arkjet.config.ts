import { findIp } from "@arcjet/ip";
import arcjet, {
  type BotOptions,
  type EmailOptions,
  protectSignup,
  type SlidingWindowRateLimitOptions,
  shield,
  slidingWindow,
} from "@arcjet/next";
import { getServerSession } from "@/core/auth/auth.server";
import { serverEnv } from "@/shared/config/env.server";

const aj = arcjet({
  key: serverEnv.ARKJET_API_KEY,
  log: {
    debug: serverEnv.USE_DEBUG_LOGS ? console.debug : () => null,
    info: serverEnv.USE_DEBUG_LOGS ? console.info : () => null,
    warn: serverEnv.USE_DEBUG_LOGS ? console.warn : () => null,
    error: serverEnv.USE_DEBUG_LOGS ? console.error : () => null,
  },
  characteristics: ["userIdOrIp"],
  rules: [shield({ mode: "LIVE" })],
});

const botSettings = {
  mode: "LIVE",
  allow: ["STRIPE_WEBHOOK"],
} satisfies BotOptions;

const restrictiveRateLimitSettings = {
  mode: "LIVE",
  max: 10,
  interval: "10m",
} satisfies SlidingWindowRateLimitOptions<[]>;

const laxRateLimitSettings = {
  mode: "LIVE",
  max: 60,
  interval: "1m",
} satisfies SlidingWindowRateLimitOptions<[]>;

const emailSettings = {
  mode: "LIVE",
  deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
} satisfies EmailOptions;

async function safeJson(request: Request) {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}

export async function checkArcjet(request: Request) {
  if (serverEnv.NODE_ENV === "development") {
    return { isAllowed: () => true, isDenied: () => false, reason: null };
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const session = await getServerSession();
  const userIdOrIp = (session?.user?.id ?? findIp(request)) || "127.0.0.1";

  // ✅ Only protect sign-in & sign-up routes
  const isSignin = path.endsWith("/auth/sign-in");
  const isSignup = path.endsWith("/auth/sign-up");

  if (isSignin || isSignup) {
    const body = await safeJson(request);
    if (body && typeof body.email === "string") {
      // Email/password login -> rate limit + email check
      return aj
        .withRule(
          protectSignup({
            email: emailSettings,
            bots: botSettings,
            rateLimit: restrictiveRateLimitSettings,
          }),
        )
        .protect(request, { email: body.email, userIdOrIp });
    } else {
      // OAuth or social login -> only light rate limit
      return aj.withRule(slidingWindow(laxRateLimitSettings)).protect(request, { userIdOrIp });
    }
  }

  const isAiChat = path.startsWith("/api/ai/chat");
  const isUpload = path.startsWith("/api/media/upload");
  const isApiMutation = path.startsWith("/api/v1");

  if (isAiChat || isUpload || isApiMutation) {
    return aj.withRule(slidingWindow(restrictiveRateLimitSettings)).protect(request, { userIdOrIp });
  }

  return { isAllowed: () => true, isDenied: () => false, reason: null };
}

// async function checkArcjet(request: Request) {
//   const body = await request?.json()
//   const session = await getServerSession()
//   const userIdOrIp = (session?.user?.id ?? findIp(request)) || '127.0.0.1'
//   console.log({
//     body,
//     session,
//     userIdOrIp
//   })
//   if (request && request.url.endsWith('/auth/sign-in')) {
//     if (
//       body &&
//       typeof body === 'object' &&
//       'email' in body &&
//       typeof body.email === 'string'
//     ) {
//       return aj
//         .withRule(
//           protectSignup({
//             email: emailSettings,
//             bots: botSettings,
//             rateLimit: restrictiveRateLimitSettings
//           })
//         )
//         .protect(request, { email: body.email, userIdOrIp })
//     } else {
//       return aj
//         .withRule(detectBot(botSettings))
//         .withRule(slidingWindow(restrictiveRateLimitSettings))
//         .protect(request, { userIdOrIp })
//     }
//   }

//   return aj
//     .withRule(detectBot(botSettings))
//     .withRule(slidingWindow(laxRateLimitSettings))
//     .protect(request, { userIdOrIp })
// }
