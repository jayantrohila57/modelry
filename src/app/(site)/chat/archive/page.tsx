import { ChatHistoryPage } from "@/module/chat/chat-history";

export const metadata = { title: "Archived chats | Modelry" };

export default function ArchivedChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; q?: string }>;
}) {
  return <ChatHistoryPage archived searchParams={searchParams} />;
}
