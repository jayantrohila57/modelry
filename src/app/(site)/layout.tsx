import type { ReactNode } from "react";
import { HydrateClient } from "@/core/api/api.server";
import Shell from "@/shared/components/layout/shell";
import { AppSidebar } from "@/shared/components/layout/sidebar/sidebar";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <HydrateClient>
      <Shell>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Shell.Main>{children}</Shell.Main>
          </SidebarInset>
        </SidebarProvider>
      </Shell>
    </HydrateClient>
  );
}
