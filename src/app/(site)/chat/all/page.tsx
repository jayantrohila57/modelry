import { ChatHistoryPage } from "@/module/chat/chat-history";

export const metadata = { title: "All chats | Modelry" };

export default function AllChatsPage({ searchParams }: { searchParams: Promise<{ offset?: string; q?: string }> }) {
  return <ChatHistoryPage archived={false} searchParams={searchParams} />;
}
