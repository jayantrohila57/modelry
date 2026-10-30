import { redirect } from "next/navigation";
import { getServerSession } from "@/core/auth/auth.server";
import { getSafePostSignInCallback } from "@/module/auth/auth.callback";
import { AuthProviders } from "@/module/auth/auth.providers";
import Section from "@/shared/components/layout/section/section";
import Shell from "@/shared/components/layout/shell";

export const metadata = {
  title: "Sign in | Modelry",
  description: "Sign in to continue to the Modelry laboratory.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const [{ callbackUrl }, { user }] = await Promise.all([searchParams, getServerSession()]);
  const callback = getSafePostSignInCallback(callbackUrl);

  if (user) redirect(callback);

  return (
    <Shell>
      <Shell.Section className="flex h-full w-full flex-col items-center justify-center">
        <Section
          badge="Welcome back"
          description="Sign in to access your experiments, conversations, and assets."
          title="Open the laboratory"
        >
          <div className="flex justify-center">
            <AuthProviders callbackURL={callback} />
          </div>
        </Section>
      </Shell.Section>
    </Shell>
  );
}
