import type { UIMessage } from "ai";

export function extractPlainTextFromMessage(message: UIMessage | null | undefined) {
  if (!message) return "";

  const parts = Array.isArray(message.parts) ? message.parts : [];

  return parts
    .filter((part) => part && typeof part === "object" && part.type === "text" && typeof part.text === "string")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

export function estimateTokenCount(content: string) {
  const normalized = content.trim();
  if (!normalized) return 0;

  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function addAdditionalPromptContextTokens(estimatedTokens: number, additionalContext: string) {
  return estimatedTokens + estimateTokenCount(additionalContext);
}

export function estimateTokensFromMessages(messages: UIMessage[]) {
  return messages.reduce((total, message) => total + estimateTokenCount(extractPlainTextFromMessage(message)), 0);
}

export function getChatInputTokenLimit(contextWindow: number | null | undefined) {
  if (!Number.isFinite(contextWindow) || !contextWindow || contextWindow < 1) return null;

  const outputReserve = Math.min(2048, Math.max(256, Math.ceil(contextWindow * 0.1)));
  return Math.max(0, Math.floor(contextWindow - outputReserve));
}

export function exceedsChatContextWindow(estimatedPromptTokens: number, contextWindow: number | null | undefined) {
  const inputLimit = getChatInputTokenLimit(contextWindow);
  return inputLimit !== null && estimatedPromptTokens > inputLimit;
}

export function estimateCreditReservation(tokens: number, ratio: number, minimum: number) {
  return Math.max(minimum, Math.ceil(tokens * ratio));
}
