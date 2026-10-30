import { clearThreadDraftSnapshot, createThreadDraftKey } from "./thread-draft-store";

export function getNewChatDestination() {
  clearThreadDraftSnapshot(createThreadDraftKey(null));
  return `/chat?new=${Date.now()}` as const;
}

export function createChatWorkspaceKey(threadId: string | null | undefined, isArchived: boolean) {
  return `${createThreadDraftKey(threadId)}:${isArchived ? "archived" : "active"}`;
}

type ThreadActivity = { id: string; isPinned?: boolean; lastMessageAt: Date };

export function groupThreadsByActivity<T extends ThreadActivity>(threads: T[], now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const groups = [
    { label: "Today", threads: [] as T[] },
    { label: "Yesterday", threads: [] as T[] },
    { label: "Previous 7 Days", threads: [] as T[] },
    { label: "Older", threads: [] as T[] },
  ];
  const pinned = threads.filter((thread) => thread.isPinned);

  for (const thread of threads) {
    if (thread.isPinned) continue;
    const date = thread.lastMessageAt;
    const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const ageInDays = Math.floor((today - day) / 86_400_000);
    const index = ageInDays <= 0 ? 0 : ageInDays === 1 ? 1 : ageInDays <= 7 ? 2 : 3;
    groups[index]?.threads.push(thread);
  }

  return [
    ...(pinned.length ? [{ label: "Pinned", threads: pinned }] : []),
    ...groups.filter((group) => group.threads.length > 0),
  ];
}
