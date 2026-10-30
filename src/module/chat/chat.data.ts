export type ChatWorkspaceMessage = {
  key: string;
  from: "user" | "assistant";
  sources?: { href: string; title: string }[];
  versions: {
    id: string;
    content: string;
  }[];
  reasoning?: {
    content: string;
    duration?: number;
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
