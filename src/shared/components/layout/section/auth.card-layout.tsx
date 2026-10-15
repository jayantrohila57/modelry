import { Copyright } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/shared/components/layout/brand/brand-logo";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PATH } from "@/shared/config/routes";
import { site } from "@/shared/config/site";
import { cn } from "@/shared/utils/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Separator } from "../../ui/separator";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 my-auto">{children}</CardContent>
      <CardFooter className="flex flex-col items-start justify-start mt-auto">
        <span>
          By Signing in, you agree to our
          <Link
            href={PATH.AUTH.ROOT as Route}
            className="text-primary hover:text-primary/80 underline underline-offset-4"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href={PATH.SITE.ROOT as Route}
            className="text-primary hover:text-primary/80 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}

export function AuthFooterNote({ hint, action, href }: { hint: string; action: string; href: string }) {
  return (
    <p className="text-muted-foreground flex flex-row items-center justify-center gap-2 text-center text-sm">
      {hint}
      <Link href={href as Route} className="text-primary hover:text-primary/80 underline underline-offset-4">
        {action}
      </Link>
    </p>
  );
}

export function AppBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <BrandLogo showTagline size="sm" className="justify-center" />
      <p className="text-muted-foreground text-center text-xs">
        <Copyright className="mr-1 inline-block h-3 w-3" />
        {`Copyright ${new Date().getFullYear()} ${site.name}. All rights reserved.`}
      </p>
    </div>
  );
}
