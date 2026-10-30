"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";

const GitHubSignIn = dynamic(() => import("./auth.github-sign-in").then((mod) => mod.GitHubSignIn), {
  loading: () => <Skeleton className="h-10 w-full rounded-full" />,
});

export function AuthProviders({ callbackURL }: { callbackURL?: string }) {
  return (
    <Suspense>
      <GitHubSignIn callbackURL={callbackURL} />
    </Suspense>
  );
}
