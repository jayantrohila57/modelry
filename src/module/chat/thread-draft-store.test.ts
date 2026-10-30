import assert from "node:assert/strict";
import test from "node:test";
import {
  clearThreadDraftSnapshot,
  createThreadDraftKey,
  getThreadDraftSnapshot,
  readPersistedThreadDraftSnapshot,
  saveThreadDraftSnapshot,
} from "./thread-draft-store";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("drafts survive a reload without persisting attachment bytes and are scoped to the user", () => {
  const storage = new MemoryStorage();
  const userKey = createThreadDraftKey("thread-123", "user-a");
  const otherUserKey = createThreadDraftKey("thread-123", "user-b");

  assert.notEqual(userKey, otherUserKey);

  saveThreadDraftSnapshot(
    userKey,
    {
      attachments: [
        {
          filename: "private.pdf",
          id: "file-1",
          mediaType: "application/pdf",
          type: "file",
          url: "data:application/pdf;base64,secret-bytes",
        },
      ],
      text: "  preserve this draft  ",
    },
    storage,
  );

  const storedValue = storage.getItem(userKey);
  assert.ok(storedValue);
  assert.equal(storedValue.includes("secret-bytes"), false);
  assert.deepEqual(readPersistedThreadDraftSnapshot(userKey, storage), {
    attachments: [],
    droppedAttachmentCount: 1,
    text: "  preserve this draft  ",
  });
  assert.equal(getThreadDraftSnapshot(userKey, storage)?.attachments.length, 1);
  assert.equal(getThreadDraftSnapshot(otherUserKey, storage), undefined);

  clearThreadDraftSnapshot(userKey, storage);
  assert.equal(storage.getItem(userKey), null);
});
