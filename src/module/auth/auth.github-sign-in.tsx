"use client";

import { Github, Loader } from "lucide-react";
// import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { signIn } from "@/core/auth/auth.client";
import { SUPPORTED_OAUTH_PROVIDER_DETAILS } from "@/core/auth/auth.providers";
import { getSafePostSignInCallback } from "@/module/auth/auth.callback";
import { Button } from "@/shared/components/ui/button";
import { PATH } from "@/shared/config/routes";
import { debugError } from "@/shared/utils/lib/logger.utils";

export function GitHubSignIn({ callbackURL = PATH.CHAT.ROOT }: { callbackURL?: string }) {
  const [isLoading, startTransition] = useTransition();
  // const router = useRouter();

  const handleSignIn = () => {
    startTransition(async () => {
      const toastId = toast.loading("Signing in...");
      try {
        await signIn.social({
          provider: "github",
          callbackURL: getSafePostSignInCallback(callbackURL),
        });
        toast.success("Signed in successfully", { id: toastId });
      } catch (error) {
        debugError("SIGNIN ERROR GOOGLE", error);
        toast.error("Something went wrong", { id: toastId });
      } finally {
        toast.dismiss(toastId);
        // router.push(PATH.CHAT.ROOT);
      }
    });
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      className="flex px-8  items-center gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80"
    >
      {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
      {isLoading ? "Connecting…" : SUPPORTED_OAUTH_PROVIDER_DETAILS.github.name}
    </Button>
  );
}
