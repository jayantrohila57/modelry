export type DraftAttachmentSnapshot = {
  id: string;
  filename: string;
  mediaType: string;
  type: "file";
  url: string;
};

export type ThreadDraftSnapshot = {
  text: string;
  attachments: DraftAttachmentSnapshot[];
  droppedAttachmentCount?: number;
};

type PersistedDraft = {
  version: 1;
  text: string;
  attachmentCount: number;
};
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DRAFT_TEXT_MAX_LENGTH = 100_000;
const draftStore = new Map<string, ThreadDraftSnapshot>();

function cloneSnapshot(snapshot: ThreadDraftSnapshot): ThreadDraftSnapshot {
  return {
    attachments: snapshot.attachments.map((attachment) => ({ ...attachment })),
    ...(snapshot.droppedAttachmentCount === undefined
      ? {}
      : { droppedAttachmentCount: snapshot.droppedAttachmentCount }),
    text: snapshot.text,
  };
}

export function createThreadDraftKey(threadId: string | null | undefined, userId?: string | null) {
  const userScope = encodeURIComponent(userId?.trim() || "anonymous");
  const threadScope = encodeURIComponent(threadId?.trim() || "landing");
  return `modelry:chat-draft:v1:${userScope}:${threadScope}`;
}

function getBrowserStorage(): DraftStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPersistedThreadDraftSnapshot(
  threadKey: string,
  storage: DraftStorage | undefined = getBrowserStorage(),
) {
  try {
    const storedValue = storage?.getItem(threadKey);
    if (!storedValue) return undefined;

    const parsed = JSON.parse(storedValue) as Partial<PersistedDraft>;
    if (parsed.version !== 1 || typeof parsed.text !== "string" || !Number.isInteger(parsed.attachmentCount)) {
      storage?.removeItem(threadKey);
      return undefined;
    }

    const droppedAttachmentCount = Math.max(0, Number(parsed.attachmentCount));
    return {
      attachments: [],
      droppedAttachmentCount: droppedAttachmentCount || undefined,
      text: parsed.text,
    } satisfies ThreadDraftSnapshot;
  } catch {
    return undefined;
  }
}

export function getThreadDraftSnapshot(threadKey: string, storage: DraftStorage | undefined = getBrowserStorage()) {
  const snapshot = draftStore.get(threadKey);
  return snapshot ? cloneSnapshot(snapshot) : readPersistedThreadDraftSnapshot(threadKey, storage);
}

export function saveThreadDraftSnapshot(
  threadKey: string,
  snapshot: ThreadDraftSnapshot,
  storage: DraftStorage | undefined = getBrowserStorage(),
) {
  const safeSnapshot = cloneSnapshot(snapshot);
  draftStore.set(threadKey, safeSnapshot);

  if (safeSnapshot.text.length > DRAFT_TEXT_MAX_LENGTH) return;

  try {
    const persisted: PersistedDraft = {
      version: 1,
      text: safeSnapshot.text,
      attachmentCount: safeSnapshot.attachments.length || safeSnapshot.droppedAttachmentCount || 0,
    };
    storage?.setItem(threadKey, JSON.stringify(persisted));
  } catch {
    // Keep the current page's in-memory draft when browser storage is unavailable or full.
  }
}

export function clearThreadDraftSnapshot(threadKey: string, storage: DraftStorage | undefined = getBrowserStorage()) {
  draftStore.delete(threadKey);
  try {
    storage?.removeItem(threadKey);
  } catch {
    // The next successful write will replace the stale browser value.
  }
}
