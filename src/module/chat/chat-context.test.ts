import assert from "node:assert/strict";
import test from "node:test";
import { exceedsChatContextWindow, getChatInputTokenLimit } from "@/module/ai/ai.tokens";

test("context checks reserve room for the model response", () => {
  assert.equal(getChatInputTokenLimit(128_000), 125_952);
  assert.equal(getChatInputTokenLimit(null), null);
  assert.equal(exceedsChatContextWindow(744, 1_000), false);
  assert.equal(exceedsChatContextWindow(745, 1_000), true);
  assert.equal(exceedsChatContextWindow(1_000, null), false);
});
