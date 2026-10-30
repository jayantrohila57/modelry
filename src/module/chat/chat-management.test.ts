import assert from "node:assert/strict";
import { createRuntimeAiModelId, getRuntimeProviderModelFromId, isRuntimeAiModelId } from "@/module/ai/ai.models";
import { addAdditionalPromptContextTokens, estimateTokenCount } from "@/module/ai/ai.tokens";
import { getReasoningLevelTemperature } from "@/module/chat/chat.runtime";
import { mapPersistedMessagesToUiMessages } from "@/module/chat/chat-message.utils";
import { createChatWorkspaceKey, getNewChatDestination, groupThreadsByActivity } from "@/module/chat/chat.navigation";
import { pinThreadInputSchema } from "@/module/chat/chat.schema";
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

assert.equal(result.length, 1);
assert.equal(result[0]?.id, "client-1");
assert.equal(result[0]?.role, "user");
assert.equal(result[0]?.parts[0]?.type, "text");
assert.equal(result[0]?.parts[0]?.text, "Hello there");
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
assert.equal(createChatWorkspaceKey("thread-123", false), "thread-123:active");
assert.equal(createChatWorkspaceKey("thread-123", true), "thread-123:archived");
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

assert.equal(getReasoningLevelTemperature("low"), 0.2);
assert.equal(getReasoningLevelTemperature("medium"), 0.5);
assert.equal(getReasoningLevelTemperature("high"), 0.8);

assert.equal(addAdditionalPromptContextTokens(12, "summary excerpt"), 12 + estimateTokenCount("summary excerpt"));

const runtimeModelId = createRuntimeAiModelId("llama3.2:latest");
assert.equal(runtimeModelId, "runtime:ollama:llama3.2%3Alatest");
assert.equal(isRuntimeAiModelId(runtimeModelId), true);
assert.equal(getRuntimeProviderModelFromId(runtimeModelId), "llama3.2:latest");
assert.equal(getRuntimeProviderModelFromId("local-default"), null);

console.log("chat-management tests passed");
