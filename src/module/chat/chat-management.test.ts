import assert from "node:assert/strict";
import { createRuntimeAiModelId, getRuntimeProviderModelFromId, isRuntimeAiModelId } from "@/module/ai/ai.models";
import { addAdditionalPromptContextTokens, estimateTokenCount } from "@/module/ai/ai.tokens";
import { getReasoningLevelTemperature } from "@/module/chat/chat.runtime";
import { mapPersistedMessagesToUiMessages } from "@/module/chat/chat-message.utils";
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
assert.deepEqual(getThreadDraftSnapshot(landingKey), {
  attachments: [],
  text: "landing draft",
});

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
