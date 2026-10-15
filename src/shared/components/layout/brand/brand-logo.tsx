import { Layers } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { site, siteConfig } from "@/shared/config/site";
import { cn } from "@/shared/utils/lib/utils";

const sizeStyles = {
  sm: {
    mark: "size-7 rounded-md",
    icon: "size-3.5",
    title: "text-sm font-semibold",
    tagline: "text-[10px]",
  },
  md: {
    mark: "size-8 rounded-lg",
    icon: "size-4",
    title: "text-base font-semibold",
    tagline: "text-xs",
  },
  lg: {
    mark: "size-10 rounded-xl",
    icon: "size-5",
    title: "text-2xl font-semibold tracking-tight",
    tagline: "text-sm",
  },
} as const;

type BrandLogoProps = {
  className?: string;
  href?: Route | string;
  showTagline?: boolean;
  size?: keyof typeof sizeStyles;
};

export function BrandLogo({ className, href, showTagline = false, size = "md" }: BrandLogoProps) {
  const styles = sizeStyles[size];

  const content = (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-[#152238] text-white shadow-sm dark:bg-[#1e3a5f]",
          styles.mark,
        )}
        aria-hidden
      >
        <Layers className={cn(styles.icon, "stroke-[2.25]")} />
      </div>
      <div className="grid min-w-0 flex-1 text-left leading-tight">
        <span className={cn("truncate", styles.title)}>{site.name}</span>
        {showTagline ? (
          <span className={cn("truncate font-normal text-muted-foreground", styles.tagline)}>{siteConfig.tagline}</span>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href as Route} className="transition-opacity hover:opacity-90" aria-label={site.name}>
        {content}
      </Link>
    );
  }

  return content;
}
