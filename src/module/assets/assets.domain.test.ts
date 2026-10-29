import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetPathname, getAssetContentDisposition, getAssetFileType, getProcessingProgress, isAssetPathOwnedByUser, splitTextIntoChunks, validateAssetUpload } from "./assets.domain";

test("asset upload validation accepts supported text-bearing document types", () => {
  assert.deepEqual(
    validateAssetUpload({ name: "report.pdf", mimeType: "application/pdf", sizeBytes: 1200, maxSizeBytes: 10_000 }),
    { ok: true, fileType: "pdf" },
  );
});

test("asset upload validation rejects unsupported types and oversized documents", () => {
  assert.equal(
    validateAssetUpload({ name: "movie.mp4", mimeType: "video/mp4", sizeBytes: 1200, maxSizeBytes: 10_000 }).ok,
    false,
  );
  assert.equal(
    validateAssetUpload({ name: "report.pdf", mimeType: "application/pdf", sizeBytes: 10_001, maxSizeBytes: 10_000 }).ok,
    false,
  );
});

test("file type derives from a safe normalized extension", () => {
  assert.equal(getAssetFileType("/private/Financial-Plan.XLSX"), "xlsx");
  assert.equal(getAssetFileType("readme"), "other");
});

test("asset blob paths are scoped to the owning user", () => {
  const pathname = buildAssetPathname("user-123", "pdf", "00000000-0000-4000-8000-000000000001");
  assert.equal(pathname, "assets/user-123/00000000-0000-4000-8000-000000000001.pdf");
  assert.equal(isAssetPathOwnedByUser(pathname, "user-123"), true);
  assert.equal(isAssetPathOwnedByUser("assets/user-456/00000000-0000-4000-8000-000000000001.pdf", "user-123"), false);
  assert.equal(isAssetPathOwnedByUser("assets/user-123/../user-456/file.pdf", "user-123"), false);
});

test("download headers preserve Unicode filenames with an ASCII fallback", () => {
  assert.equal(
    getAssetContentDisposition("研究报告.pdf", "attachment"),
    "attachment; filename=\"____.pdf\"; filename*=UTF-8''%E7%A0%94%E7%A9%B6%E6%8A%A5%E5%91%8A.pdf",
  );
});

test("text chunking preserves all text and overlaps chunk boundaries", () => {
  const chunks = splitTextIntoChunks("abcdefghijkl", { maxCharacters: 6, overlapCharacters: 2 });
  assert.deepEqual(chunks, ["abcdef", "efghij", "ijkl"]);
});

test("processing progress only advances at persisted pipeline stages", () => {
  assert.equal(getProcessingProgress("queued"), 0);
  assert.equal(getProcessingProgress("uploading"), 15);
  assert.equal(getProcessingProgress("extracting"), 40);
  assert.equal(getProcessingProgress("embedding"), 75);
  assert.equal(getProcessingProgress("ready"), 100);
  assert.equal(getProcessingProgress("failed"), 100);
});
