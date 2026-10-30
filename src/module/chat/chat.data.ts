export type ChatWorkspaceMessage = {
  key: string;
  from: "user" | "assistant";
  content: string;
  createdAt?: Date;
  toolParts?: Array<{
    type: string;
    toolName: string;
    state: string;
    input: unknown;
    output?: unknown;
    errorText?: string;
  }>;
  sources?: { href: string; title: string }[];
  reasoning?: {
    content: string;
  };
  usage?: {
    completionTokens: number;
    creditCost: number;
    promptTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
  metadata?: {
    model?: string;
    provider?: string;
    status?: string;
  };
  attachments?: Array<{ id: string; name: string; mimeType: string; url: string }>;
};

export const CHAT_RECENT_THREADS_LIMIT = 9;
export const CHAT_ARCHIVED_THREADS_LIMIT = 5;

export const chatSuggestions = [
  "Explain how temperature changes model behavior",
  "Compare reasoning on vs off for the same prompt",
  "What tokens are counted in this response?",
  "Walk me through the chat request lifecycle",
  "How would you design credits for an AI API?",
  "Summarize tradeoffs between local and cloud models",
];
