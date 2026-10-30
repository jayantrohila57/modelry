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

function encodeHeaderFilename(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function getAssetContentDisposition(name: string, disposition: "inline" | "attachment") {
  const fallback = name.normalize("NFKD").replace(/[^\x20-\x7E]|[\\";\r\n]/g, "_") || "download";
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeHeaderFilename(name)}`;
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

export function validateAssetContent(
  buffer: Uint8Array,
  fileType: Exclude<AssetFileType, "other">,
): { ok: true } | { ok: false; reason: string } {
  if (!buffer.byteLength) return { ok: false, reason: "The file is empty." };
  const bytes = buffer;
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2]!) &&
    [0x04, 0x06, 0x08].includes(bytes[3]!);
  if (fileType === "pdf" && !new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) {
    return { ok: false, reason: "The file contents do not match the PDF extension." };
  }
  if (["docx", "xlsx", "pptx", "odt", "ods", "odp", "epub"].includes(fileType) && !isZip) {
    return { ok: false, reason: "The file contents do not match the document extension." };
  }
  if (isZip) {
    const archiveEntries = new TextDecoder().decode(bytes);
    const expectedEntry =
      fileType === "docx"
        ? "word/document.xml"
        : fileType === "xlsx"
          ? "xl/workbook.xml"
          : fileType === "pptx"
            ? "ppt/presentation.xml"
            : ["odt", "ods", "odp"].includes(fileType)
              ? "content.xml"
              : fileType === "epub"
                ? "mimetype"
                : undefined;
    if (expectedEntry && !archiveEntries.includes(expectedEntry)) {
      return { ok: false, reason: "The file contents do not match the document extension." };
    }
  }
  if (fileType === "rtf" && !new TextDecoder().decode(bytes.subarray(0, 32)).startsWith("{\\rtf")) {
    return { ok: false, reason: "The file contents do not match the RTF extension." };
  }
  if (!["pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "epub"].includes(fileType)) {
    if (bytes.includes(0)) return { ok: false, reason: "The file contains unsupported binary data." };
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, reason: "The file is not valid UTF-8 text." };
    }
  }
  return { ok: true };
}

export function splitTextIntoChunks(
  text: string,
  options: { maxCharacters: number; overlapCharacters: number },
): string[] {
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .trim();
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
