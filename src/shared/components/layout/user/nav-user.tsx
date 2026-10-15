"use client";

import { ChevronsUpDown, CreditCard, Sparkles, UserIcon } from "lucide-react";
import Link from "next/link";

import { apiClient, getApiResponseData } from "@/core/api/api.client";
import { useSession } from "@/core/auth/auth.client";
import { SignOutDropdownMenuItem } from "@/module/auth/auth.sign-out-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { PATH } from "@/shared/config/routes";
import { useSettingsDialog } from "../../provider/global-modal.provider";
import { SidebarMenuButton } from "../../ui/sidebar";

export function UserDropdown() {
  const { openSettings } = useSettingsDialog();
  const { data: session } = useSession();
  const viewerQuery = apiClient.viewer.session.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const viewer = getApiResponseData(viewerQuery.data);
  const user = session?.user;
  const fallbackName = session?.user?.name
    ?.split(" ")
    ?.map((name: string) => name?.[0])
    ?.join("");
  const hasPaidPlan = Boolean(viewer?.billing?.hasPaidPlan);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-lg ">
            <AvatarImage className="rounded-lg" src={user?.image ?? "/avatar.png"} alt={user?.name ?? ""} />
            <AvatarFallback className="rounded-lg">{fallbackName}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.name ?? ""}</span>
            <span className="truncate text-xs">{user?.email ?? ""}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={"bottom"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
              <AvatarFallback className="rounded-lg">{fallbackName}</AvatarFallback>
            </Avatar>
            <div className="hidden flex-1 text-left text-sm leading-tight md:grid">
              <span className="truncate font-medium">{user?.name}</span>
              <span className="truncate text-xs">{user?.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href={PATH.PRICING.ROOT}>
              <Sparkles />
              {hasPaidPlan ? "Manage Plan" : "View Plans"}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => openSettings("subscription")}>
            <CreditCard />
            Subscription & Billing
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => openSettings("account")}>
            <UserIcon />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <SignOutDropdownMenuItem className="cursor-pointer" />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
