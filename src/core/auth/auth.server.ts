import { headers } from "next/headers";
import { cache } from "react";
import { debugLog } from "@/shared/utils/lib/logger.utils";
import { auth } from "./auth";
import { normalizeRole } from "./auth.roles";

export const getServerSession = cache(async () => {
  const data = await auth.api.getSession({
    headers: await headers(),
  });

  const normalizedUser = data?.user
    ? {
        ...data.user,
        role: normalizeRole(data.user.role),
      }
    : data?.user;

  return {
    ...data,
    user: normalizedUser,
  };
});

type Permission = "create" | "list" | "set-role" | "ban" | "impersonate" | "delete" | "set-password" | "get" | "update";

export const getServerUserPermission = async (permission: Permission[]) => {
  const has = await auth.api.userHasPermission({
    headers: await headers(),
    body: {
      permissions: {
        user: permission,
      },
    },
  });
  if (has.error) {
    debugLog("USER:HAS_PERMISSION:ERROR", has.error);
    return false;
  }

  return Boolean(has.success);
};

export const getServerAccounts = cache(async () => {
  const data = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  return data;
});

export const getServerSessions = cache(async () => {
  const data = await auth.api.listSessions({
    headers: await headers(),
  });
  return data;
});

export type ServerSessionType = typeof auth.$Infer.Session;
