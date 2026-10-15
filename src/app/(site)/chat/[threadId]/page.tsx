import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";
import { apiServer } from "@/core/api/api.server";
import { getServerSession } from "@/core/auth/auth.server";
import { ChatWorkspace } from "@/module/chat/chat.workspace";
import type { PersistedChatMessage } from "@/module/chat/chat-message.utils";
import { PATH } from "@/shared/config/routes";

export const metadata = {
  title: "Experiment",
  description: "Continue a Modelry experiment and inspect model behavior.",
};

export default async function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const { session } = await getServerSession();

  if (!session) {
    redirect(PATH.AUTH.SIGN_IN);
  }

  try {
    const response = await apiServer.chat.get({ threadId });

    if (!response.ok || !response.data) {
      notFound();
    }

    return (
      <ChatWorkspace
        initialMessages={response.data.messages as PersistedChatMessage[]}
        mode="thread"
        thread={{
          id: response.data.thread.id,
          isArchived: response.data.isArchived,
          lastMessageAt: response.data.thread.lastMessageAt,
          model: response.data.thread.model,
          title: response.data.thread.title,
          titleSource: response.data.thread.titleSource,
        }}
      />
    );
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }

    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      notFound();
    }

    throw error;
  }
}
