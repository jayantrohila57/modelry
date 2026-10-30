"use client";

import { Edit, FolderOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition } from "react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage, getApiResponseData, getApiResponseMessage } from "@/core/api/api.client";
import { CHAT_ARCHIVED_THREADS_LIMIT, CHAT_RECENT_THREADS_LIMIT } from "@/module/chat/chat.data";
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
  const utils = apiClient.useUtils();

  const createThread = apiClient.chat.create.useMutation({
    onMutate: async () => {
      const previousList = utils.chat.list.getData({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT });
      const optimisticId = `optimistic-${Date.now()}`;

      utils.chat.list.setData({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT }, (current) => ({
        ...current,
        data: [
          {
            createdAt: new Date(),
            deletedAt: null,
            id: optimisticId,
            lastMessageAt: new Date(),
            model: null,
            summary: null,
            summaryUpdatedAt: null,
            summaryVersion: 0,
            title: "Untitled chat",
            titleSource: "auto" as const,
            updatedAt: new Date(),
            userId: "optimistic",
          },
          ...(current?.data ?? []),
        ].slice(0, CHAT_RECENT_THREADS_LIMIT),
        error: null,
        message: current?.message ?? "Threads retrieved successfully.",
        ok: true,
        status: "success",
      }));

      return { optimisticId, previousList };
    },
    onError: (error, _input, context) => {
      if (context?.previousList) {
        utils.chat.list.setData({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT }, context.previousList);
      }
      toast.error(getApiErrorMessage(error, "Failed to create a new chat."));
    },
    onSuccess: (response, _input, context) => {
      const thread = getApiResponseData(response);
      if (!thread) {
        return;
      }

      utils.chat.list.setData({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT }, (current) => ({
        ...current,
        data: [
          thread,
          ...(current?.data ?? []).filter((item) => item.id !== context?.optimisticId && item.id !== thread.id),
        ].slice(0, CHAT_RECENT_THREADS_LIMIT),
        error: null,
        message: current?.message ?? response.message,
        ok: true,
        status: "success",
      }));

      toast.success(getApiResponseMessage(response, "New chat created."));
      startTransition(() => {
        router.push(PATH.CHAT.THREAD(thread.id));
      });
    },
    onSettled: () => {
      void utils.chat.list.invalidate({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT });
      void utils.chat.list.invalidate({ archived: true, limit: CHAT_ARCHIVED_THREADS_LIMIT });
    },
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Main</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled={createThread.isPending} onClick={() => createThread.mutate({})}>
              <Edit className="size-4" />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === PATH.CHAT.ROOT}>
              <Link href={PATH.CHAT.ROOT}>
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
