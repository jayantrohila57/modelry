import { TRPCError } from "@trpc/server";
import type { UIMessage } from "ai";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/core/db/db";
import { chatAttachment, chatMessage, chatMessageAsset, chatThread, usageEvent } from "@/core/db/db.schema";
import { extractPlainTextFromMessage } from "@/module/ai/ai.tokens";
import { normalizeChatMessageParts, type PersistedChatMessage } from "./chat-message.utils";

const THREAD_CONTEXT_MESSAGE_LIMIT = 12;
const THREAD_SUMMARY_TRIGGER_COUNT = 18;
const THREAD_SUMMARY_MAX_CHARS = 4000;
export const CHAT_MESSAGE_PAGE_SIZE = 50;

function createId() {
  return crypto.randomUUID();
}

export function deriveThreadTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled chat";
  return normalized.slice(0, 80);
}

export function buildThreadSearchCondition(searchPattern: string) {
  const matchingMessageThreads = db
    .select({ threadId: chatMessage.threadId })
    .from(chatMessage)
    .where(ilike(chatMessage.content, searchPattern));

  return or(ilike(chatThread.title, searchPattern), inArray(chatThread.id, matchingMessageThreads))!;
}

export function buildArchivedThreadDeleteCondition(userId: string, threadId: string) {
  return and(eq(chatThread.id, threadId), eq(chatThread.userId, userId), isNotNull(chatThread.deletedAt))!;
}

function buildDeterministicThreadSummary(messages: Array<Pick<PersistedChatMessage, "content" | "role">>) {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim().length > 0)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n")
    .slice(0, THREAD_SUMMARY_MAX_CHARS)
    .trim();
}

export function buildCutoffSafeThreadSummary(
  messages: Array<Pick<PersistedChatMessage, "content" | "role" | "status">>,
) {
  const eligibleMessages = messages.filter(
    (message) =>
      ["completed", "cancelled", "streaming"].includes(message.status) &&
      (message.role === "user" || message.role === "assistant"),
  );
  const omittedMessages = eligibleMessages.slice(0, -THREAD_CONTEXT_MESSAGE_LIMIT);

  if (omittedMessages.length === 0) return null;

  return buildDeterministicThreadSummary(omittedMessages) || null;
}

async function getThreadUsageTotals(threadId: string) {
  const [totals] = await db
    .select({
      completionTokens: sql<number>`coalesce(sum(${chatMessage.completionTokens}), 0)`,
      creditCost: sql<number>`coalesce(sum(${chatMessage.creditCost}), 0)`,
      promptTokens: sql<number>`coalesce(sum(${chatMessage.promptTokens}), 0)`,
      reasoningTokens: sql<number>`coalesce(sum(${chatMessage.reasoningTokens}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${chatMessage.totalTokens}), 0)`,
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId));

  return {
    completionTokens: Number(totals?.completionTokens ?? 0),
    creditCost: Number(totals?.creditCost ?? 0),
    promptTokens: Number(totals?.promptTokens ?? 0),
    reasoningTokens: Number(totals?.reasoningTokens ?? 0),
    totalTokens: Number(totals?.totalTokens ?? 0),
  };
}

async function getOwnedThread(userId: string, threadId: string) {
  return db.query.chatThread.findFirst({
    where: and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)),
  });
}

async function requireOwnedThread(userId: string, threadId: string, options?: { allowArchived?: boolean }) {
  const thread = await getOwnedThread(userId, threadId);

  if (!thread) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chat thread not found" });
  }

  if (!options?.allowArchived && thread.deletedAt) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This chat is archived. Restore it before sending new messages.",
    });
  }

  return thread;
}

async function listThreadMessages(threadId: string) {
  return db.query.chatMessage.findMany({
    where: eq(chatMessage.threadId, threadId),
    orderBy: [asc(chatMessage.createdAt), asc(chatMessage.id)],
  });
}

async function attachThreadMessageAssets(
  userId: string,
  threadId: string,
  messages: Awaited<ReturnType<typeof listThreadMessages>>,
) {
  if (messages.length === 0) return messages;
  const messageIds = messages.map((message) => message.id);
  const [legacyAttachments, linkedAssets] = await Promise.all([
    db
      .select({
        id: chatAttachment.id,
        messageId: chatAttachment.messageId,
        name: chatAttachment.name,
        mimeType: chatAttachment.mimeType,
      })
      .from(chatAttachment)
      .where(
        and(
          eq(chatAttachment.threadId, threadId),
          eq(chatAttachment.userId, userId),
          inArray(chatAttachment.messageId, messageIds),
        ),
      ),
    db
      .select({
        id: chatAttachment.id,
        messageId: chatMessageAsset.messageId,
        name: chatAttachment.name,
        mimeType: chatAttachment.mimeType,
      })
      .from(chatMessageAsset)
      .innerJoin(
        chatAttachment,
        and(eq(chatAttachment.id, chatMessageAsset.assetId), eq(chatAttachment.userId, chatMessageAsset.userId)),
      )
      .where(
        and(
          eq(chatMessageAsset.threadId, threadId),
          eq(chatMessageAsset.userId, userId),
          inArray(chatMessageAsset.messageId, messageIds),
        ),
      ),
  ]);
  const attachmentsByMessage = new Map<string, Array<{ id: string; name: string; mimeType: string }>>();
  for (const attachment of [...legacyAttachments, ...linkedAssets]) {
    if (!attachment.messageId) continue;
    const current = attachmentsByMessage.get(attachment.messageId) ?? [];
    current.push({ id: attachment.id, name: attachment.name, mimeType: attachment.mimeType });
    attachmentsByMessage.set(attachment.messageId, current);
  }

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }));
}

function toAssistantContextMessage(message: (typeof chatMessage)["$inferSelect"], replacementContent?: string) {
  const storedParts = (Array.isArray(message.parts) ? message.parts : []).filter(
    (part) => part && typeof part === "object" && part.type !== "file",
  );

  return {
    id: message.clientMessageId ?? message.id,
    role: (message.role === "tool" ? "assistant" : message.role) as UIMessage["role"],
    parts:
      replacementContent !== undefined
        ? [...storedParts.filter((part) => part.type !== "text"), { type: "text" as const, text: replacementContent }]
        : storedParts.length > 0
          ? storedParts
          : message.content
            ? [{ type: "text" as const, text: message.content }]
            : [],
  } satisfies UIMessage;
}

async function refreshThreadSummary(threadId: string) {
  const thread = await db.query.chatThread.findFirst({
    where: eq(chatThread.id, threadId),
  });

  if (!thread) {
    return null;
  }

  const messages = await listThreadMessages(threadId);
  const eligibleMessages = messages.filter(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      message.status !== "failed" &&
      message.content.trim().length > 0,
  );

  if (eligibleMessages.length <= THREAD_SUMMARY_TRIGGER_COUNT) {
    return thread;
  }

  const messagesToSummarize = eligibleMessages.slice(
    0,
    Math.max(0, eligibleMessages.length - THREAD_CONTEXT_MESSAGE_LIMIT),
  );
  const nextSummary = buildDeterministicThreadSummary(messagesToSummarize);

  if (!nextSummary || nextSummary === thread.summary) {
    return thread;
  }

  await db
    .update(chatThread)
    .set({
      summary: nextSummary,
      summaryUpdatedAt: new Date(),
      summaryVersion: Number(thread.summaryVersion ?? 0) + 1,
    })
    .where(eq(chatThread.id, threadId));

  return db.query.chatThread.findFirst({
    where: eq(chatThread.id, threadId),
  });
}

export async function listThreads(
  userId: string,
  input?: { archived?: boolean; limit?: number; offset?: number; search?: string },
) {
  const archived = input?.archived ?? false;
  const limit = input?.limit ?? 50;
  const search = input?.search?.trim();
  const searchPattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;

  return db.query.chatThread.findMany({
    where: and(
      eq(chatThread.userId, userId),
      archived ? isNotNull(chatThread.deletedAt) : isNull(chatThread.deletedAt),
      searchPattern ? buildThreadSearchCondition(searchPattern) : undefined,
    ),
    orderBy: [desc(chatThread.isPinned), desc(chatThread.lastMessageAt)],
    limit,
    offset: input?.offset ?? 0,
  });
}

export async function setThreadPinned(input: { userId: string; threadId: string; isPinned: boolean }) {
  await requireOwnedThread(input.userId, input.threadId);
  await db
    .update(chatThread)
    .set({ isPinned: input.isPinned })
    .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, input.userId)));
  return requireOwnedThread(input.userId, input.threadId);
}

export async function createThread(input: { userId: string; title?: string; model?: string }) {
  const id = createId();
  const title = input.title?.trim() || "Untitled chat";

  await db.insert(chatThread).values({
    id,
    userId: input.userId,
    title,
    titleSource: input.title?.trim() ? "manual" : "auto",
    model: input.model,
  });

  return requireOwnedThread(input.userId, id, { allowArchived: true });
}

export async function getThread(userId: string, threadId: string) {
  const thread = await requireOwnedThread(userId, threadId, { allowArchived: true });
  const recentMessages = await db.query.chatMessage.findMany({
    where: eq(chatMessage.threadId, threadId),
    orderBy: [desc(chatMessage.createdAt), desc(chatMessage.id)],
    limit: CHAT_MESSAGE_PAGE_SIZE + 1,
  });
  const hasOlderMessages = recentMessages.length > CHAT_MESSAGE_PAGE_SIZE;
  const messages = await attachThreadMessageAssets(
    userId,
    threadId,
    recentMessages.slice(0, CHAT_MESSAGE_PAGE_SIZE).reverse(),
  );
  const usageTotals = await getThreadUsageTotals(threadId);

  return {
    hasOlderMessages,
    isArchived: Boolean(thread.deletedAt),
    messages,
    thread,
    usageTotals,
  };
}

export async function getOlderThreadMessages(input: {
  userId: string;
  threadId: string;
  beforeMessageId: string;
  limit?: number;
}) {
  await requireOwnedThread(input.userId, input.threadId, { allowArchived: true });
  const cursor = await db.query.chatMessage.findFirst({
    where: and(eq(chatMessage.id, input.beforeMessageId), eq(chatMessage.threadId, input.threadId)),
  });
  if (!cursor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "The earlier message page was not found." });
  }

  const limit = input.limit ?? CHAT_MESSAGE_PAGE_SIZE;
  const olderMessages = await db.query.chatMessage.findMany({
    where: and(
      eq(chatMessage.threadId, input.threadId),
      or(
        lt(chatMessage.createdAt, cursor.createdAt),
        and(eq(chatMessage.createdAt, cursor.createdAt), lt(chatMessage.id, cursor.id)),
      ),
    ),
    orderBy: [desc(chatMessage.createdAt), desc(chatMessage.id)],
    limit: limit + 1,
  });
  const hasOlderMessages = olderMessages.length > limit;
  const messages = await attachThreadMessageAssets(
    input.userId,
    input.threadId,
    olderMessages.slice(0, limit).reverse(),
  );

  return { hasOlderMessages, messages };
}

export async function renameThread(input: { userId: string; threadId: string; title: string }) {
  await requireOwnedThread(input.userId, input.threadId, { allowArchived: true });

  await db
    .update(chatThread)
    .set({
      title: input.title.trim(),
      titleSource: "manual",
    })
    .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, input.userId)));

  await db.insert(usageEvent).values({
    id: createId(),
    userId: input.userId,
    threadId: input.threadId,
    eventType: "title_changed",
    status: "recorded",
  });

  return requireOwnedThread(input.userId, input.threadId, { allowArchived: true });
}

export async function archiveThread(input: { userId: string; threadId: string }) {
  await requireOwnedThread(input.userId, input.threadId);

  await db
    .update(chatThread)
    .set({
      deletedAt: new Date(),
    })
    .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, input.userId)));

  await db.insert(usageEvent).values({
    id: createId(),
    userId: input.userId,
    threadId: input.threadId,
    eventType: "thread_deleted",
    status: "recorded",
  });

  return {
    ok: true,
    threadId: input.threadId,
  };
}

export async function deleteThread(input: { userId: string; threadId: string }) {
  const thread = await requireOwnedThread(input.userId, input.threadId, { allowArchived: true });
  if (!thread.deletedAt) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Archive this chat before deleting it permanently." });
  }

  const deleted = await db
    .delete(chatThread)
    .where(buildArchivedThreadDeleteCondition(input.userId, input.threadId))
    .returning({ id: chatThread.id });
  if (!deleted.length) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Archive this chat before deleting it permanently." });
  }
  return { ok: true, threadId: input.threadId };
}

export async function restoreThread(input: { userId: string; threadId: string }) {
  await requireOwnedThread(input.userId, input.threadId, { allowArchived: true });

  await db
    .update(chatThread)
    .set({
      deletedAt: null,
      lastMessageAt: new Date(),
    })
    .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, input.userId)));

  return requireOwnedThread(input.userId, input.threadId);
}

export async function ensureThreadForRequest(input: {
  userId: string;
  threadId?: string | null;
  model?: string | null;
  latestUserMessage?: UIMessage | null;
}) {
  if (input.threadId) {
    const existingThread = await getOwnedThread(input.userId, input.threadId);
    if (existingThread) {
      return requireOwnedThread(input.userId, input.threadId);
    }

    await db
      .insert(chatThread)
      .values({
        id: input.threadId,
        userId: input.userId,
        title: "Untitled chat",
        titleSource: "auto",
        model: input.model ?? undefined,
      })
      .onConflictDoNothing({ target: chatThread.id });

    return requireOwnedThread(input.userId, input.threadId);
  }

  return createThread({
    userId: input.userId,
    title: undefined,
    model: input.model ?? undefined,
  });
}

export async function persistUserMessage(input: {
  userId: string;
  threadId: string;
  message: UIMessage;
  model?: string | null;
}) {
  const existing = await db.query.chatMessage.findFirst({
    where: and(eq(chatMessage.threadId, input.threadId), eq(chatMessage.clientMessageId, input.message.id)),
  });

  if (existing) return existing;

  const parts = normalizeChatMessageParts(input.message.parts);
  const content = extractPlainTextFromMessage({ ...input.message, parts });
  const id = createId();

  await db
    .insert(chatMessage)
    .values({
      id,
      threadId: input.threadId,
      userId: input.userId,
      clientMessageId: input.message.id,
      role: "user",
      status: "completed",
      content,
      parts,
      model: input.model ?? null,
      finishedAt: new Date(),
    })
    .onConflictDoNothing({ target: [chatMessage.threadId, chatMessage.clientMessageId] });

  const persistedMessage = await db.query.chatMessage.findFirst({
    where: and(eq(chatMessage.threadId, input.threadId), eq(chatMessage.clientMessageId, input.message.id)),
  });

  if (!persistedMessage) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to persist user message" });
  }

  await db
    .update(chatThread)
    .set({
      lastMessageAt: new Date(),
      model: input.model ?? null,
    })
    .where(eq(chatThread.id, input.threadId));

  return persistedMessage;
}

export async function prepareUserMessageReplay(input: {
  userId: string;
  threadId: string;
  clientMessageId: string;
  content?: string;
}): Promise<{
  targetMessageId: string;
  targetClientMessageId: string;
  replacementContent?: string;
  replacementParts?: UIMessage["parts"];
  followingMessageIds: string[];
}> {
  await requireOwnedThread(input.userId, input.threadId);
  const messages = await db.query.chatMessage.findMany({
    where: eq(chatMessage.threadId, input.threadId),
    orderBy: asc(chatMessage.createdAt),
  });
  const targetIndex = messages.findIndex((message) => message.clientMessageId === input.clientMessageId);
  const target = messages[targetIndex];

  if (!target || target.role !== "user") {
    throw new TRPCError({ code: "NOT_FOUND", message: "The message to retry was not found." });
  }

  return {
    targetMessageId: target.id,
    targetClientMessageId: input.clientMessageId,
    replacementContent: input.content,
    replacementParts:
      input.content === undefined
        ? undefined
        : [
            ...(target.parts ?? []).filter((part) => part.type !== "text"),
            { type: "text" as const, text: input.content },
          ],
    followingMessageIds: messages.slice(targetIndex + 1).map((message) => message.id),
  };
}

export async function createAssistantPlaceholder(input: {
  userId: string;
  threadId: string;
  provider?: string | null;
  model?: string | null;
  summaryVersionUsed?: number;
}) {
  const id = createId();

  await db.insert(chatMessage).values({
    id,
    threadId: input.threadId,
    userId: input.userId,
    role: "assistant",
    status: "streaming",
    content: "",
    provider: input.provider ?? null,
    model: input.model ?? null,
    summaryVersionUsed: input.summaryVersionUsed ?? 0,
  });

  await db.insert(usageEvent).values({
    id: createId(),
    userId: input.userId,
    threadId: input.threadId,
    messageId: id,
    eventType: "chat_started",
    provider: input.provider ?? null,
    model: input.model ?? null,
    status: "recorded",
  });

  return db.query.chatMessage
    .findFirst({
      where: eq(chatMessage.id, id),
    })
    .then((message) => {
      if (!message) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create assistant placeholder" });
      }

      return message;
    });
}

export async function finalizeAssistantMessage(input: {
  userId: string;
  threadId: string;
  messageId: string;
  content: string;
  parts?: UIMessage["parts"];
  reasoning?: string | null;
  reasoningTokens?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditCost: number;
  provider?: string | null;
  model?: string | null;
  status?: "completed" | "cancelled";
  summaryVersionUsed?: number;
  replay?: {
    targetMessageId: string;
    replacementContent?: string;
    replacementParts?: UIMessage["parts"];
    followingMessageIds: string[];
  };
}) {
  await requireOwnedThread(input.userId, input.threadId);
  await db.transaction(async (tx) => {
    if (input.replay && input.status !== "cancelled") {
      if (input.replay.followingMessageIds.length > 0) {
        await tx
          .delete(chatMessage)
          .where(
            and(eq(chatMessage.threadId, input.threadId), inArray(chatMessage.id, input.replay.followingMessageIds)),
          );
      }

      if (input.replay.replacementContent !== undefined) {
        await tx
          .update(chatMessage)
          .set({
            content: input.replay.replacementContent,
            parts: input.replay.replacementParts ?? [{ type: "text", text: input.replay.replacementContent }],
            status: "completed",
            errorMessage: null,
            finishedAt: new Date(),
          })
          .where(and(eq(chatMessage.id, input.replay.targetMessageId), eq(chatMessage.threadId, input.threadId)));
      }

      await tx
        .update(chatThread)
        .set({ summary: null, summaryVersion: 0, summaryUpdatedAt: null })
        .where(eq(chatThread.id, input.threadId));
    }

    await tx
      .update(chatMessage)
      .set({
        status: input.status ?? "completed",
        content: input.content,
        parts: input.parts ?? (input.content ? [{ type: "text", text: input.content }] : []),
        reasoning: input.reasoning ?? null,
        reasoningTokens: input.reasoningTokens ?? 0,
        summaryVersionUsed: input.summaryVersionUsed ?? 0,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        creditCost: input.creditCost,
        provider: input.provider ?? null,
        model: input.model ?? null,
        finishedAt: new Date(),
        errorMessage: null,
      })
      .where(and(eq(chatMessage.id, input.messageId), eq(chatMessage.threadId, input.threadId)));

    await tx
      .update(chatThread)
      .set({
        lastMessageAt: new Date(),
        model: input.model ?? null,
      })
      .where(eq(chatThread.id, input.threadId));
  });

  await db.insert(usageEvent).values({
    id: createId(),
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.messageId,
    eventType: input.status === "cancelled" ? "chat_cancelled" : "chat_completed",
    provider: input.provider ?? null,
    model: input.model ?? null,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    creditCost: input.creditCost,
    status: "recorded",
  });

  const message = await db.query.chatMessage.findFirst({
    where: eq(chatMessage.id, input.messageId),
  });

  if (!message) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Assistant message missing after finalize" });
  }

  const thread = await requireOwnedThread(input.userId, input.threadId);

  if (thread.titleSource !== "manual" && thread.title === "Untitled chat") {
    const replacementTitle = deriveThreadTitle(input.content);

    if (replacementTitle && replacementTitle !== "Untitled chat") {
      await db
        .update(chatThread)
        .set({
          title: replacementTitle,
          titleSource: "auto",
        })
        .where(eq(chatThread.id, input.threadId));
    }
  }

  await refreshThreadSummary(input.threadId);

  return message;
}

export async function failAssistantMessage(input: {
  userId: string;
  threadId: string;
  messageId: string;
  errorMessage: string;
  provider?: string | null;
  model?: string | null;
  removePlaceholder?: boolean;
}) {
  if (input.removePlaceholder) {
    await db
      .delete(chatMessage)
      .where(and(eq(chatMessage.id, input.messageId), eq(chatMessage.threadId, input.threadId)));
    return;
  }

  await db
    .update(chatMessage)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
    })
    .where(and(eq(chatMessage.id, input.messageId), eq(chatMessage.threadId, input.threadId)));

  await db.insert(usageEvent).values({
    id: createId(),
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.messageId,
    eventType: "chat_failed",
    provider: input.provider ?? null,
    model: input.model ?? null,
    status: "recorded",
    payload: input.errorMessage,
  });
}

export async function getThreadContextForAssistant(input: {
  userId: string;
  threadId: string;
  throughClientMessageId?: string;
  replacementContent?: string;
}) {
  const thread = await requireOwnedThread(input.userId, input.threadId);
  if (!input.throughClientMessageId) {
    const recentMessages = await db.query.chatMessage.findMany({
      where: and(
        eq(chatMessage.threadId, input.threadId),
        inArray(chatMessage.status, ["completed", "cancelled", "streaming"]),
        inArray(chatMessage.role, ["user", "assistant", "system"]),
      ),
      orderBy: [desc(chatMessage.createdAt), desc(chatMessage.id)],
      limit: THREAD_CONTEXT_MESSAGE_LIMIT,
    });
    const uiMessages = recentMessages.reverse().map((message) => toAssistantContextMessage(message));
    const summary = thread.summary?.trim();

    return {
      messages: summary
        ? [
            {
              id: `summary-${thread.id}-${thread.summaryVersion}`,
              role: "system" as const,
              parts: [{ type: "text" as const, text: `Conversation summary:\n${summary}` }],
            },
            ...uiMessages,
          ]
        : uiMessages,
      summaryVersion: Number(thread.summaryVersion ?? 0),
      thread,
    };
  }

  const allMessages = await listThreadMessages(input.threadId);
  const cutoffIndex = allMessages.findIndex((message) => message.clientMessageId === input.throughClientMessageId);

  if (cutoffIndex < 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "The message to retry was not found." });
  }

  const messages = allMessages.slice(0, cutoffIndex + 1);
  const eligibleMessages = messages.filter(
    (message) =>
      ["completed", "cancelled", "streaming"].includes(message.status) &&
      (message.role === "user" || message.role === "assistant" || message.role === "system"),
  );
  const recentMessages = eligibleMessages.slice(-THREAD_CONTEXT_MESSAGE_LIMIT);
  const targetMessage = messages.at(-1);
  const uiMessages: UIMessage[] = recentMessages.map((message) =>
    toAssistantContextMessage(message, message.id === targetMessage?.id ? input.replacementContent : undefined),
  );
  const contextSummary = buildCutoffSafeThreadSummary(eligibleMessages);

  if (!contextSummary) {
    return {
      messages: uiMessages,
      summaryVersion: Number(thread.summaryVersion ?? 0),
      thread,
    };
  }

  const contextMessages: UIMessage[] = [
    {
      id: `summary-${thread.id}-${thread.summaryVersion}`,
      role: "system",
      parts: [
        {
          type: "text" as const,
          text: `Conversation summary:\n${contextSummary}`,
        },
      ],
    },
    ...uiMessages,
  ];

  return {
    messages: contextMessages,
    summaryVersion: Number(thread.summaryVersion ?? 0),
    thread,
  };
}
