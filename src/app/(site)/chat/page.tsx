import { redirect } from "next/navigation";
import { getServerSession } from "@/core/auth/auth.server";
import { getSignInDestination } from "@/module/auth/auth.callback";
import { ChatWorkspace } from "@/module/chat/chat.workspace";
import { PATH } from "@/shared/config/routes";

export const metadata = {
  title: "Lab",
  description: "Experiment with language models in the Modelry laboratory.",
};

export default async function ChatLandingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newChatKey } = await searchParams;
  const { session, user } = await getServerSession();

  if (!session || !user) {
    redirect(getSignInDestination(PATH.CHAT.ROOT));
  }

  return <ChatWorkspace key={newChatKey ?? "landing"} mode="landing" userId={user.id} />;
}
