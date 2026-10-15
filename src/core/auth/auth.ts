import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db } from "@/core/db/db";
import {
  sendDeleteAccountEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/shared/components/mail/mail.methods";
import { serverEnv } from "@/shared/config/env.server";
import { site } from "@/shared/config/site";
import { debugLog } from "@/shared/utils/lib/logger.utils";
import { resolveBetterAuthBaseUrl, resolveBetterAuthSecret } from "./auth.env";
import { resolveNewUserRole } from "./auth.roles";
import { ac, admin, customer, staff, user } from "./permissions";

const MAX_AGE = 60 * 60; // 1 hour

export const auth = betterAuth({
  secret: resolveBetterAuthSecret(),
  baseURL: resolveBetterAuthBaseUrl(),
  logger: {
    disabled: false,
    disableColors: false,
    level: "info",
    log: (level, message, ...args) => {
      debugLog(`[${level}] ${message}`, { ...args });
    },
  },
  appName: site.name,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "customer",
        returned: true,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, url, newEmail }) => {
        await sendEmailVerificationEmail({
          user: { ...user, email: newEmail },
          url,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendDeleteAccountEmail({ user, url });
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: MAX_AGE,
    },
  },
  rateLimit: {
    storage: "database",
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ user, url });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: false,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationEmail({ user, url });
    },
  },
  socialProviders: {
    github: {
      clientId: serverEnv.GITHUB_CLIENT_ID,
      clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/verify-email")) {
        const user = ctx.context.newSession?.user ?? {
          name: ctx?.body?.name,
          email: ctx?.body?.email,
        };

        if (user != null) {
          await sendWelcomeEmail({ user, url: ctx.path });
        }
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          return {
            data: {
              ...newUser,
              role: resolveNewUserRole(typeof newUser.role === "string" ? newUser.role : undefined),
            },
          };
        },
      },
    },
  },
  plugins: [
    nextCookies(),
    twoFactor(),
    adminPlugin({
      ac,
      roles: {
        admin,
        user,
        customer,
        staff,
      },
    }),
  ],
});
