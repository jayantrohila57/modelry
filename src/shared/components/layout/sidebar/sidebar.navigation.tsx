"use client";

import { Edit, FolderOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getNewChatDestination } from "@/module/chat/chat.navigation";
import { PATH } from "@/shared/config/routes";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../ui/sidebar";

export function NavMain() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Main</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => router.push(getNewChatDestination())}>
              <Edit className="size-4" />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === PATH.CHAT.ROOT || pathname === PATH.CHAT.ALL}>
              <Link href={PATH.CHAT.ALL}>
                <MessageCircle className="size-4" />
                <span>All Chats</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith(PATH.ASSETS.ROOT)}>
              <Link href={PATH.ASSETS.ROOT}>
                <FolderOpen className="size-4" />
                <span>Assets</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
