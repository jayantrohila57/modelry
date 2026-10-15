import { ArrowRight, FlaskConical, Layers, Microscope, Terminal } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "@/core/auth/auth.server";
import { AuthProviders } from "@/module/auth/auth.providers";
import Section from "@/shared/components/layout/section/section";
import Shell from "@/shared/components/layout/shell";
import { Button } from "@/shared/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PATH } from "@/shared/config/routes";
import { site, siteConfig } from "@/shared/config/site";

export const metadata = {
  title: site.name,
  description: site.description,
};

export default async function Home() {
  const session = await getServerSession();
  const isAuthenticated = !!session?.user;
  const pillars = [
    {
      title: "Experiment with models",
      description:
        "Swap models, tune reasoning, and run real prompts against live providers so you can see how different setups change the output.",
      icon: FlaskConical,
    },
    {
      title: "Observe behavior",
      description:
        "Follow streaming responses, token usage, and credit costs as the model works so you can understand what happens inside each turn.",
      icon: Microscope,
    },
    {
      title: "Learn by building",
      description:
        "Modelry is built for developers who want hands-on practice with auth, persistence, uploads, and the full loop of AI-powered software.",
      icon: Layers,
    },
    {
      title: "Ship with context",
      description:
        "Threads, attachments, and billing-aware limits mirror how production AI apps behave, not just a toy chat box.",
      icon: Terminal,
    },
  ];

  return (
    <Shell>
      <Shell.Section className="flex flex-col h-full w-full justify-center items-center">
        <Section badge="Interactive AI laboratory" title={siteConfig.tagline} description={site.description}>
          <div className="max-w-3xl flex flex-col justify-start items-start gap-4 mb-6">
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link href={PATH.CHAT.ROOT}>
                    Open the lab
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              ) : (
                <AuthProviders />
              )}

              <Button asChild variant="outline" size="lg">
                <Link href={PATH.PRICING.ROOT}>Plans & credits</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar) => (
              <Card key={pillar.title} className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg">{pillar.title}</CardTitle>
                  <CardAction>
                    <pillar.icon className="text-primary size-5" />
                  </CardAction>
                </CardHeader>

                <CardContent>
                  <p className="text-muted-foreground text-sm leading-6">{pillar.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      </Shell.Section>
    </Shell>
  );
}
