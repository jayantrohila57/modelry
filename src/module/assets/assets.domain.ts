export const ASSET_FILE_TYPES = [
  "pdf",
  "docx",
  "rtf",
  "odt",
  "txt",
  "md",
  "html",
  "csv",
  "xlsx",
  "ods",
  "pptx",
  "odp",
  "epub",
  "tex",
] as const;

export type AssetFileType = (typeof ASSET_FILE_TYPES)[number] | "other";
export type AssetProcessingStatus = "queued" | "uploading" | "extracting" | "embedding" | "ready" | "failed";

const MIME_TYPES_BY_EXTENSION: Record<(typeof ASSET_FILE_TYPES)[number], readonly string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  rtf: ["application/rtf", "text/rtf"],
  odt: ["application/vnd.oasis.opendocument.text"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain", "text/x-markdown"],
  html: ["text/html"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  odp: ["application/vnd.oasis.opendocument.presentation"],
  epub: ["application/epub+zip", "application/octet-stream"],
  tex: ["application/x-tex", "text/x-tex", "text/plain"],
};

export function getAllowedMimeTypes(fileType: Exclude<AssetFileType, "other">): string[] {
  return [...MIME_TYPES_BY_EXTENSION[fileType]];
}

export function buildAssetPathname(
  userId: string,
  fileType: Exclude<AssetFileType, "other">,
  id = crypto.randomUUID(),
): string {
  if (!userId || !/^[\da-f-]{36}$/i.test(id)) throw new Error("Invalid asset owner or identifier.");
  return `assets/${encodeURIComponent(userId)}/${id}.${fileType}`;
}

export function isAssetPathOwnedByUser(pathname: string, userId: string): boolean {
  const prefix = `assets/${encodeURIComponent(userId)}/`;
  if (!userId || !pathname.startsWith(prefix) || pathname.includes("..")) return false;
  return /^[\da-f-]{36}(?:-[a-z\d]+)?\.[a-z\d]+$/i.test(pathname.slice(prefix.length));
}

export function getAssetFileType(name: string): AssetFileType {
  const extension = name.split(".").at(-1)?.trim().toLowerCase();
  return extension && ASSET_FILE_TYPES.includes(extension as (typeof ASSET_FILE_TYPES)[number])
    ? (extension as (typeof ASSET_FILE_TYPES)[number])
    : "other";
}

export function validateAssetUpload(input: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  maxSizeBytes: number;
}): { ok: true; fileType: Exclude<AssetFileType, "other"> } | { ok: false; reason: string } {
  const fileType = getAssetFileType(input.name);
  if (fileType === "other") {
    return { ok: false, reason: "This file type is not supported for document analysis." };
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "The file is empty or has an invalid size." };
  }
  if (input.sizeBytes > input.maxSizeBytes) {
    return { ok: false, reason: `File exceeds the ${input.maxSizeBytes} byte limit.` };
  }

  const mimeType = input.mimeType.trim().toLowerCase().split(";")[0];
  if (mimeType && mimeType !== "application/octet-stream" && !MIME_TYPES_BY_EXTENSION[fileType].includes(mimeType)) {
    return { ok: false, reason: "The file extension does not match its content type." };
  }

  return { ok: true, fileType };
}

export function splitTextIntoChunks(
  text: string,
  options: { maxCharacters: number; overlapCharacters: number },
): string[] {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/[\t ]+\n/g, "\n").trim();
  const maxCharacters = Math.max(1, Math.floor(options.maxCharacters));
  const overlapCharacters = Math.max(0, Math.min(Math.floor(options.overlapCharacters), maxCharacters - 1));
  const chunks: string[] = [];

  for (let start = 0; start < normalizedText.length; ) {
    let end = Math.min(start + maxCharacters, normalizedText.length);
    if (end < normalizedText.length) {
      const whitespace = normalizedText.lastIndexOf(" ", end);
      const newline = normalizedText.lastIndexOf("\n", end);
      const boundary = Math.max(whitespace, newline);
      if (boundary > start + Math.floor(maxCharacters / 2)) end = boundary;
    }
    const chunk = normalizedText.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalizedText.length) break;
    start = Math.max(start + 1, end - overlapCharacters);
  }

  return chunks;
}

export function getProcessingProgress(status: AssetProcessingStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "uploading":
      return 15;
    case "extracting":
      return 40;
    case "embedding":
      return 75;
    case "ready":
    case "failed":
      return 100;
  }
}
