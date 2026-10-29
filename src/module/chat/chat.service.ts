import { TRPCError } from "@trpc/server";
import type { UIMessage } from "ai";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/core/db/db";
import { chatAttachment, chatMessage, chatThread, usageEvent } from "@/core/db/db.schema";
import { extractPlainTextFromMessage } from "@/module/ai/ai.tokens";
import type { PersistedChatMessage } from "./chat-message.utils";

const THREAD_CONTEXT_MESSAGE_LIMIT = 12;
const THREAD_SUMMARY_TRIGGER_COUNT = 18;
const THREAD_SUMMARY_MAX_CHARS = 4000;

function createId() {
  return crypto.randomUUID();
}

export function deriveThreadTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled chat";
  return normalized.slice(0, 80);
}

function buildDeterministicThreadSummary(messages: PersistedChatMessage[]) {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim().length > 0)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n")
    .slice(0, THREAD_SUMMARY_MAX_CHARS)
    .trim();
}

function calculateThreadUsageTotals(messages: PersistedChatMessage[]) {
  return messages.reduce(
    (totals, message) => ({
      completionTokens: totals.completionTokens + Number(message.completionTokens ?? 0),
      creditCost: totals.creditCost + Number(message.creditCost ?? 0),
      promptTokens: totals.promptTokens + Number(message.promptTokens ?? 0),
      reasoningTokens: totals.reasoningTokens + Number(message.reasoningTokens ?? 0),
      totalTokens: totals.totalTokens + Number(message.totalTokens ?? 0),
    }),
    {
      completionTokens: 0,
      creditCost: 0,
      promptTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    },
  );
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
    orderBy: asc(chatMessage.createdAt),
  });
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

export async function listThreads(userId: string, input?: { archived?: boolean; limit?: number }) {
  const archived = input?.archived ?? false;
  const limit = input?.limit ?? 50;

  return db.query.chatThread.findMany({
    where: and(
      eq(chatThread.userId, userId),
      archived ? isNotNull(chatThread.deletedAt) : isNull(chatThread.deletedAt),
    ),
    orderBy: desc(chatThread.lastMessageAt),
    limit,
  });
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
  const messages = await listThreadMessages(threadId);
  const attachments = await db
    .select({ id: chatAttachment.id, messageId: chatAttachment.messageId, name: chatAttachment.name, mimeType: chatAttachment.mimeType })
    .from(chatAttachment)
    .where(and(eq(chatAttachment.threadId, threadId), eq(chatAttachment.userId, userId), isNotNull(chatAttachment.messageId)));
  const attachmentsByMessage = new Map<string, typeof attachments>();
  for (const attachment of attachments) {
    if (!attachment.messageId) continue;
    const current = attachmentsByMessage.get(attachment.messageId) ?? [];
    current.push(attachment);
    attachmentsByMessage.set(attachment.messageId, current);
  }

  return {
    isArchived: Boolean(thread.deletedAt),
    messages: messages.map((message) => ({
      ...message,
      attachments: (attachmentsByMessage.get(message.id) ?? []).map(({ id, name, mimeType }) => ({ id, name, mimeType })),
    })),
    thread,
    usageTotals: calculateThreadUsageTotals(messages),
  };
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
    const thread = await requireOwnedThread(input.userId, input.threadId);
    return thread;
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

  const content = extractPlainTextFromMessage(input.message);
  const id = createId();

  await db.insert(chatMessage).values({
    id,
    threadId: input.threadId,
    userId: input.userId,
    clientMessageId: input.message.id,
    role: "user",
    status: "completed",
    content,
    model: input.model ?? null,
    finishedAt: new Date(),
  });

  await db
    .update(chatThread)
    .set({
      lastMessageAt: new Date(),
      model: input.model ?? null,
    })
    .where(eq(chatThread.id, input.threadId));

  return db.query.chatMessage
    .findFirst({
      where: eq(chatMessage.id, id),
    })
    .then((message) => {
      if (!message) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to persist user message" });
      }

      return message;
    });
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
}) {
  await requireOwnedThread(input.userId, input.threadId);

  await db
    .update(chatMessage)
    .set({
      status: input.status ?? "completed",
      content: input.content,
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

  await db
    .update(chatThread)
    .set({
      lastMessageAt: new Date(),
      model: input.model ?? null,
    })
    .where(eq(chatThread.id, input.threadId));

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
}) {
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

export async function getThreadContextForAssistant(input: { userId: string; threadId: string }) {
  const thread = await requireOwnedThread(input.userId, input.threadId);
  const messages = await listThreadMessages(input.threadId);
  const eligibleMessages = messages.filter(
    (message) =>
      ["completed", "cancelled", "streaming"].includes(message.status) &&
      (message.role === "user" || message.role === "assistant" || message.role === "system"),
  );
  const recentMessages = eligibleMessages.slice(-THREAD_CONTEXT_MESSAGE_LIMIT);
  const uiMessages: UIMessage[] = recentMessages.map((message) => ({
    id: message.clientMessageId ?? message.id,
    role: (message.role === "tool" ? "assistant" : message.role) as UIMessage["role"],
    parts: message.content
      ? [
          {
            type: "text" as const,
            text: message.content,
          },
        ]
      : [],
  }));

  if (!thread.summary?.trim()) {
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
          text: `Conversation summary:\n${thread.summary}`,
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
