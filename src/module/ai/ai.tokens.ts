import type { UIMessage } from "ai";

export function extractPlainTextFromMessage(message: UIMessage | null | undefined) {
  if (!message) return "";

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
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

export function estimateCreditReservation(tokens: number, ratio: number, minimum: number) {
  return Math.max(minimum, Math.ceil(tokens * ratio));
}
