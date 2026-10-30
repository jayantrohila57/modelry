import type { UIMessage } from "ai";

export type PersistedChatMessage = {
  id: string;
  threadId: string;
  userId: string | null;
  clientMessageId: string | null;
  role: "system" | "user" | "assistant" | "tool";
  status: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  content: string;
  model: string | null;
  provider: string | null;
  reasoning: string | null;
  reasoningTokens: number;
  summaryVersionUsed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditCost: number;
  errorMessage: string | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Array<{ id: string; name: string; mimeType: string }>;
};

export type PersistedMessageMetadata = {
  assistantMessageId?: string;
  completionTokens?: number;
  creditCost?: number;
  model?: string;
  persistedMessageId: string;
  promptTokens?: number;
  provider?: string;
  reasoningTokens?: number;
  reservedCredits?: number;
  status: PersistedChatMessage["status"];
  summaryVersionUsed?: number;
  threadId: string;
  totalTokens?: number;
};

export function mapPersistedMessagesToUiMessages(messages: PersistedChatMessage[]): UIMessage[] {
  return messages.map((message) => ({
    createdAt: message.createdAt,
    id: message.clientMessageId ?? message.id,
    metadata: {
      completionTokens: message.completionTokens,
      creditCost: message.creditCost,
      model: message.model ?? undefined,
      persistedMessageId: message.id,
      promptTokens: message.promptTokens,
      provider: message.provider ?? undefined,
      reasoningTokens: message.reasoningTokens,
      status: message.status,
      summaryVersionUsed: message.summaryVersionUsed,
      threadId: message.threadId,
      totalTokens: message.totalTokens,
    } satisfies PersistedMessageMetadata,
    parts: [
      ...(message.reasoning?.trim()
        ? [
            {
              text: message.reasoning,
              type: "reasoning" as const,
            },
          ]
        : []),
      ...(message.content || message.errorMessage
        ? [
            {
              text: message.content || message.errorMessage || "",
              type: "text" as const,
            },
          ]
        : []),
      ...(message.attachments ?? []).map((attachment) => ({
        type: "file" as const,
        mediaType: attachment.mimeType,
        filename: attachment.name,
        url: `/api/assets/${attachment.id}/download`,
      })),
    ],
    role: message.role === "tool" ? "assistant" : message.role,
  }));
}

export function getTextFromUiMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function getReasoningFromUiMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function getThreadIdFromMessageMetadata(message: UIMessage | undefined) {
  const metadata = message?.metadata as { threadId?: unknown } | undefined;

  return typeof metadata?.threadId === "string" && metadata.threadId.length > 0 ? metadata.threadId : undefined;
}

export function getMessageMetadata(message: UIMessage) {
  return ((message.metadata as PersistedMessageMetadata | undefined) ?? {
    persistedMessageId: message.id,
    status: "completed",
    threadId: "",
  }) as PersistedMessageMetadata;
}
