import type { UIMessage } from "ai";

export type PersistedChatMessage = {
  id: string;
  threadId: string;
  userId: string | null;
  clientMessageId: string | null;
  role: "system" | "user" | "assistant" | "tool";
  status: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  content: string;
  parts?: UIMessage["parts"] | null;
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

const ASSET_DOWNLOAD_URL_PATTERN =
  /^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/download$/i;

export function normalizeChatMessageParts(parts: unknown): UIMessage["parts"] {
  if (!Array.isArray(parts)) return [];

  return parts.flatMap((part): UIMessage["parts"] => {
    if (!part || typeof part !== "object") return [];
    const candidate = part as Record<string, unknown>;

    if (candidate.type === "text" && typeof candidate.text === "string") {
      return [{ type: "text" as const, text: candidate.text }];
    }

    if (
      candidate.type === "file" &&
      typeof candidate.url === "string" &&
      ASSET_DOWNLOAD_URL_PATTERN.test(candidate.url) &&
      typeof candidate.mediaType === "string" &&
      (candidate.filename === undefined || typeof candidate.filename === "string")
    ) {
      return [
        {
          type: "file" as const,
          url: candidate.url,
          mediaType: candidate.mediaType,
          ...(typeof candidate.filename === "string" ? { filename: candidate.filename } : {}),
        },
      ];
    }

    return [];
  });
}

export function mapPersistedMessagesToUiMessages(messages: PersistedChatMessage[]): UIMessage[] {
  return messages.map((message) => {
    const legacyParts: UIMessage["parts"] = [
      ...(message.reasoning?.trim() ? [{ text: message.reasoning, type: "reasoning" as const }] : []),
      ...(message.content || message.errorMessage
        ? [{ text: message.content || message.errorMessage || "", type: "text" as const }]
        : []),
      ...(message.attachments ?? []).map((attachment) => ({
        type: "file" as const,
        mediaType: attachment.mimeType,
        filename: attachment.name,
        url: `/api/assets/${attachment.id}/download`,
      })),
    ];
    const normalizedStoredParts = Array.isArray(message.parts)
      ? message.parts.filter(
          (part): part is UIMessage["parts"][number] =>
            Boolean(part) && typeof part === "object" && typeof part.type === "string",
        )
      : [];
    const storedParts = normalizedStoredParts.length ? normalizedStoredParts : legacyParts;
    const existingAssetIds = new Set(
      storedParts.flatMap((part) => {
        if (!part || typeof part !== "object" || part.type !== "file") return [];
        const match = part.url.match(/\/api\/assets\/([0-9a-f-]+)\/download/i);
        return match ? [match[1]] : [];
      }),
    );
    const missingAttachmentParts = (message.attachments ?? [])
      .filter((attachment) => !existingAssetIds.has(attachment.id))
      .map((attachment) => ({
        type: "file" as const,
        mediaType: attachment.mimeType,
        filename: attachment.name,
        url: `/api/assets/${attachment.id}/download`,
      }));

    return {
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
      parts: [...storedParts, ...missingAttachmentParts],
      role: message.role === "tool" ? "assistant" : message.role,
    };
  });
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

export function formatMessageTimestamp(createdAt: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(createdAt);
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
