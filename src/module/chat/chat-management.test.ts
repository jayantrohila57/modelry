import assert from "node:assert/strict";
import { createChat } from "@shadcn/helpers/ai-sdk";
import { PgDialect } from "drizzle-orm/pg-core";
import { createRuntimeAiModelId, getRuntimeProviderModelFromId, isRuntimeAiModelId } from "@/module/ai/ai.models";
import { addAdditionalPromptContextTokens, estimateTokenCount } from "@/module/ai/ai.tokens";
import { getSafePostSignInCallback } from "@/module/auth/auth.callback";
import { createChatWorkspaceKey, getNewChatDestination, groupThreadsByActivity } from "@/module/chat/chat.navigation";
import {
  createRetryChatRequest,
  normalizeChatSearchQuery,
  resolveChatRequestThreadId,
} from "@/module/chat/chat.request.utils";
import { getTemperatureFromPreset } from "@/module/chat/chat.runtime";
import { pinThreadInputSchema } from "@/module/chat/chat.schema";
import {
  buildArchivedThreadDeleteCondition,
  buildCutoffSafeThreadSummary,
  buildThreadSearchCondition,
} from "@/module/chat/chat.service";
import {
  formatMessageTimestamp,
  mapPersistedMessagesToUiMessages,
  normalizeChatMessageParts,
} from "@/module/chat/chat-message.utils";
import {
  clearThreadDraftSnapshot,
  createThreadDraftKey,
  getThreadDraftSnapshot,
  saveThreadDraftSnapshot,
} from "@/module/chat/thread-draft-store";

const result = mapPersistedMessagesToUiMessages([
  {
    clientMessageId: "client-1",
    completionTokens: 0,
    content: "Hello there",
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
    creditCost: 0,
    errorMessage: null,
    finishedAt: null,
    id: "message-1",
    model: "demo-model",
    promptTokens: 0,
    provider: "demo-provider",
    reasoning: null,
    reasoningTokens: 0,
    role: "user",
    status: "completed",
    threadId: "thread-1",
    summaryVersionUsed: 0,
    totalTokens: 0,
    updatedAt: new Date("2026-03-31T10:00:00.000Z"),
    userId: "user-1",
  },
]);
assert.deepEqual(
  normalizeChatMessageParts([
    { type: "text", text: "safe text", ignored: true },
    {
      type: "file",
      url: "/api/assets/00000000-0000-4000-8000-000000000001/download",
      mediaType: "application/pdf",
      filename: "safe.pdf",
    },
    { type: "file", url: "https://example.com/unsafe.pdf", mediaType: "application/pdf", filename: "unsafe.pdf" },
    { type: "tool-call", input: { prompt: "unsafe" } },
    null,
  ]),
  [
    { type: "text", text: "safe text" },
    {
      type: "file",
      url: "/api/assets/00000000-0000-4000-8000-000000000001/download",
      mediaType: "application/pdf",
      filename: "safe.pdf",
    },
  ],
);
assert.deepEqual(normalizeChatMessageParts({ type: "text", text: "not an array" }), []);

const restoredWithLegacyAttachments = mapPersistedMessagesToUiMessages([
  {
    clientMessageId: "client-attachment",
    completionTokens: 0,
    content: "Review these documents",
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
    creditCost: 0,
    errorMessage: null,
    finishedAt: null,
    id: "message-attachment",
    model: null,
    parts: [
      { type: "text", text: "Review these documents" },
      {
        type: "file",
        filename: "current.pdf",
        mediaType: "application/pdf",
        url: "/api/assets/00000000-0000-4000-8000-000000000001/download",
      },
    ],
    attachments: [
      { id: "00000000-0000-4000-8000-000000000001", name: "current.pdf", mimeType: "application/pdf" },
      { id: "00000000-0000-4000-8000-000000000002", name: "legacy.pdf", mimeType: "application/pdf" },
    ],
    promptTokens: 0,
    provider: null,
    reasoning: null,
    reasoningTokens: 0,
    role: "user",
    status: "completed",
    threadId: "thread-1",
    summaryVersionUsed: 0,
    totalTokens: 0,
    updatedAt: new Date("2026-03-31T10:00:00.000Z"),
    userId: "user-1",
  },
])[0];
assert.equal(restoredWithLegacyAttachments?.parts.filter((part) => part.type === "file").length, 2);
assert.deepEqual(
  restoredWithLegacyAttachments?.parts
    .filter((part) => part.type === "file")
    .map((part) => (part.type === "file" ? part.url : "")),
  [
    "/api/assets/00000000-0000-4000-8000-000000000001/download",
    "/api/assets/00000000-0000-4000-8000-000000000002/download",
  ],
);

const scriptedAiChat = createChat()
  .user("Find the latest release notes", { id: "fixture-user-message" })
  .assistant(({ writer }) => {
    writer
      .reasoning("Checking the release notes")
      .text("The release adds message scroller support.")
      .sourceUrl({ url: "https://example.com/releases", title: "Release notes" });
  });
const scriptedAssistant = scriptedAiChat.get()[1];
assert.ok(scriptedAssistant);
assert.ok(scriptedAssistant.parts.some((part) => part.type === "reasoning"));
assert.ok(scriptedAssistant.parts.some((part) => part.type === "source-url"));
const restoredScriptedAssistant = mapPersistedMessagesToUiMessages([
  {
    clientMessageId: null,
    completionTokens: 8,
    content: "The release adds message scroller support.",
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
    creditCost: 1,
    errorMessage: null,
    finishedAt: null,
    id: "fixture-assistant-message",
    model: "demo-model",
    parts: scriptedAssistant.parts,
    promptTokens: 12,
    provider: "demo-provider",
    reasoning: "Checking the release notes",
    reasoningTokens: 3,
    role: "assistant",
    status: "completed",
    threadId: "thread-1",
    summaryVersionUsed: 0,
    totalTokens: 23,
    updatedAt: new Date("2026-03-31T10:00:00.000Z"),
    userId: "user-1",
  },
])[0];
assert.deepEqual(restoredScriptedAssistant?.parts, scriptedAssistant.parts);

assert.equal(result.length, 1);
assert.equal(result[0]?.id, "client-1");
assert.equal(result[0]?.role, "user");
assert.equal(result[0]?.parts[0]?.type, "text");
assert.equal(result[0]?.parts[0]?.text, "Hello there");
assert.match(formatMessageTimestamp(new Date("2026-03-31T10:00:00.000Z")), /UTC/);
assert.deepEqual(result[0]?.metadata, {
  completionTokens: 0,
  creditCost: 0,
  model: "demo-model",
  persistedMessageId: "message-1",
  promptTokens: 0,
  provider: "demo-provider",
  reasoningTokens: 0,
  status: "completed",
  summaryVersionUsed: 0,
  threadId: "thread-1",
  totalTokens: 0,
});

const landingKey = createThreadDraftKey(null);
const threadKey = createThreadDraftKey("thread-123");

clearThreadDraftSnapshot(landingKey);
clearThreadDraftSnapshot(threadKey);

saveThreadDraftSnapshot(landingKey, {
  attachments: [],
  text: "landing draft",
});
saveThreadDraftSnapshot(threadKey, {
  attachments: [
    {
      filename: "preview.png",
      id: "attachment-1",
      mediaType: "image/png",
      type: "file",
      url: "data:image/png;base64,preview",
    },
  ],
  text: "thread draft",
});

assert.deepEqual(getThreadDraftSnapshot(landingKey), {
  attachments: [],
  text: "landing draft",
});

assert.match(getNewChatDestination(), /^\/chat\?new=\d+$/);
assert.equal(createChatWorkspaceKey("thread-123", false), `${threadKey}:active`);
assert.equal(createChatWorkspaceKey("thread-123", true), `${threadKey}:archived`);
assert.equal(getSafePostSignInCallback("/chat/all?q=quarterly"), "/chat/all?q=quarterly");
assert.equal(getSafePostSignInCallback("//attacker.example"), "/chat");
assert.equal(getSafePostSignInCallback("/safe/..//attacker.example"), "/chat");
assert.equal(resolveChatRequestThreadId(undefined, "client-thread-id"), "client-thread-id");
assert.equal(resolveChatRequestThreadId("persisted-thread-id", "client-thread-id"), "persisted-thread-id");
assert.equal(normalizeChatSearchQuery(["first phrase", "ignored phrase"]), "first phrase");
assert.equal(normalizeChatSearchQuery("x".repeat(130)).length, 120);
const failedExchange = {
  body: { assetIds: ["asset-1"], model: "model-1", threadId: "thread-1" },
  files: [{ filename: "report.pdf", mediaType: "application/pdf", type: "file" as const, url: "/assets/1" }],
  messageId: "message-1",
  text: "Summarize the file",
};
assert.deepEqual(createRetryChatRequest(failedExchange), {
  body: failedExchange.body,
  message: { files: failedExchange.files, messageId: failedExchange.messageId, text: failedExchange.text },
});
const threadSearchSql = new PgDialect().sqlToQuery(buildThreadSearchCondition("%budget%")).sql;
assert.match(threadSearchSql, / in \(select /i);
assert.doesNotMatch(threadSearchSql, /chat_thread\.id/i);
assert.match(
  new PgDialect().sqlToQuery(buildArchivedThreadDeleteCondition("user-1", "thread-1")).sql,
  /deleted_at" is not null/i,
);
assert.equal(getThreadDraftSnapshot(landingKey), undefined);
assert.deepEqual(pinThreadInputSchema.parse({ threadId: "00000000-0000-4000-8000-000000000001", isPinned: true }), {
  threadId: "00000000-0000-4000-8000-000000000001",
  isPinned: true,
});

const groupedThreads = groupThreadsByActivity(
  [
    { id: "pinned", isPinned: true, lastMessageAt: new Date("2026-10-30T11:00:00.000Z") },
    { id: "today", isPinned: false, lastMessageAt: new Date("2026-10-30T10:00:00.000Z") },
    { id: "yesterday", lastMessageAt: new Date("2026-10-29T10:00:00.000Z") },
    { id: "week", lastMessageAt: new Date("2026-10-25T10:00:00.000Z") },
    { id: "older", lastMessageAt: new Date("2026-10-20T10:00:00.000Z") },
  ],
  new Date("2026-10-30T12:00:00.000Z"),
);
assert.deepEqual(
  groupedThreads.map((group) => [group.label, group.threads.map((thread) => thread.id)]),
  [
    ["Pinned", ["pinned"]],
    ["Today", ["today"]],
    ["Yesterday", ["yesterday"]],
    ["Previous 7 Days", ["week"]],
    ["Older", ["older"]],
  ],
);
assert.deepEqual(getThreadDraftSnapshot(threadKey), {
  attachments: [
    {
      filename: "preview.png",
      id: "attachment-1",
      mediaType: "image/png",
      type: "file",
      url: "data:image/png;base64,preview",
    },
  ],
  text: "thread draft",
});

clearThreadDraftSnapshot(threadKey);

assert.equal(getThreadDraftSnapshot(threadKey), undefined);
assert.equal(getThreadDraftSnapshot(landingKey), undefined);

assert.equal(getTemperatureFromPreset("low"), 0.2);
assert.equal(getTemperatureFromPreset("medium"), 0.5);
assert.equal(getTemperatureFromPreset("high"), 0.8);

const replaySummary = buildCutoffSafeThreadSummary(
  Array.from({ length: 14 }, (_, index) => ({
    content: `context fact ${index}`,
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    status: "completed" as const,
  })),
);
assert.match(replaySummary ?? "", /context fact 0/);
assert.match(replaySummary ?? "", /context fact 1/);
assert.doesNotMatch(replaySummary ?? "", /context fact 2/);

assert.equal(addAdditionalPromptContextTokens(12, "summary excerpt"), 12 + estimateTokenCount("summary excerpt"));

const runtimeModelId = createRuntimeAiModelId("llama3.2:latest");
assert.equal(runtimeModelId, "runtime:ollama:llama3.2%3Alatest");
assert.equal(isRuntimeAiModelId(runtimeModelId), true);
assert.equal(getRuntimeProviderModelFromId(runtimeModelId), "llama3.2:latest");
assert.equal(getRuntimeProviderModelFromId("local-default"), null);

console.log("chat-management tests passed");
