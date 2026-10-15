import { adminClient, inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { normalizeRole } from "./auth.roles";
import { ac, admin, customer, staff, user } from "./permissions";

export const {
  $Infer,
  signIn,
  signUp,
  signOut,
  twoFactor,
  useSession,
  listSessions,
  getSession,
  updateUser,
  changeEmail,
  resetPassword,
  revokeSession,
  changePassword,
  revokeOtherSessions,
  sendVerificationEmail,
  requestPasswordReset,
} = createAuthClient({
  plugins: [
    nextCookies(),
    adminClient({
      ac,
      roles: {
        admin,
        user,
        customer,
        staff,
      },
    }),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/auth/2fa";
      },
    }),
    inferAdditionalFields<typeof auth>(),
  ],
});

export const getClientSession = async () => {
  const session = await getSession();
  if (session?.data?.user) {
    return {
      ...session,
      data: {
        ...session.data,
        user: {
          ...session.data.user,
          role: normalizeRole(session.data.user.role),
        },
      },
    };
  }
  return session;
};

export type ClientSessionType = typeof $Infer.Session;
