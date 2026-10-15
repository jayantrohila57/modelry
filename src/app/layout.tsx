import "@/shared/styles/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TRPCReactProvider } from "@/core/api/api.client";
import { ThemeProvider } from "@/core/theme/theme.provider";
import { GlobalModalProvider } from "@/shared/components/provider/global-modal.provider";
import { Toaster } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { site } from "@/shared/config/site";
import { cn } from "@/shared/utils/lib/utils";
import { className, viewport } from "@/shared/utils/methods/font";

export { viewport };

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(className)}>
      <body suppressHydrationWarning className={className}>
        <TRPCReactProvider>
          <ThemeProvider>
            <TooltipProvider>
              <GlobalModalProvider>{children}</GlobalModalProvider>
            </TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
