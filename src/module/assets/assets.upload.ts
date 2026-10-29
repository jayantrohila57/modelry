import { upload } from "@vercel/blob/client";
import { buildAssetPathname, getAllowedMimeTypes, getAssetFileType, validateAssetUpload } from "./assets.domain";

export type AssetUploadStage = "uploading" | "saving" | "extracting" | "embedding" | "ready" | "failed";

export type AssetUploadProgress = {
  stage: AssetUploadStage;
  progress: number;
  message: string;
  error?: string;
};

type AssetStatusResponse = {
  data?: {
    id: string;
    name: string;
    processingStatus: string;
    processingProgress: number;
    processingError: string | null;
    summary: string | null;
  };
  message?: string;
};

function getResponseData<T>(response: unknown): T {
  if (!response || typeof response !== "object" || !("data" in response)) {
    throw new Error("The server returned an invalid asset response.");
  }
  return (response as { data: T }).data;
}

const stageMessage: Record<AssetUploadStage, string> = {
  uploading: "Uploading to secure storage",
  saving: "Saving file details",
  extracting: "Reading document and extracting metadata",
  embedding: "Indexing content for AI search",
  ready: "Ready to use in chat",
  failed: "Analysis failed",
};

export async function uploadAndProcessAsset(input: {
  file: File;
  maxSizeBytes: number;
  userId: string;
  folderId?: string;
  createAsset: (metadata: { name: string; pathname: string; mimeType: string; folderId?: string }) => Promise<unknown>;
  onProgress: (progress: AssetUploadProgress) => void;
}) {
  const fileType = getAssetFileType(input.file.name);
  if (!input.userId) throw new Error("Sign in before uploading documents.");
  const validation = validateAssetUpload({
    name: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    maxSizeBytes: input.maxSizeBytes,
  });
  if (!validation.ok) throw new Error(validation.reason);
  if (fileType === "other") throw new Error("This file type is not supported for document analysis.");

  const mimeType = input.file.type && getAllowedMimeTypes(fileType).includes(input.file.type)
    ? input.file.type
    : getAllowedMimeTypes(fileType)[0]!;
  const extension = fileType;
  const pathname = buildAssetPathname(input.userId, extension);
  input.onProgress({ stage: "uploading", progress: 0, message: stageMessage.uploading });

  const blob = await upload(pathname, input.file, {
    access: "private",
    contentType: mimeType,
    handleUploadUrl: "/api/assets/upload",
    multipart: input.file.size > 5 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => {
      input.onProgress({ stage: "uploading", progress: Math.round(percentage), message: stageMessage.uploading });
    },
  });

  input.onProgress({ stage: "saving", progress: 100, message: stageMessage.saving });
  const assetId = getResponseData<string>(
    await input.createAsset({
      name: input.file.name,
      pathname: blob.pathname,
      mimeType: blob.contentType || mimeType,
      folderId: input.folderId,
    }),
  );

  let processError: Error | undefined;
  const processRequest = fetch(`/api/assets/${assetId}/process`, {
    method: "POST",
    signal: AbortSignal.timeout(305_000),
  }).then(async (response) => {
    if (response.ok) return;
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || "Document analysis failed.");
  }).catch((error: unknown) => {
    processError = error instanceof Error ? error : new Error("Document analysis failed.");
  });
  let completed: AssetStatusResponse["data"] | undefined;
  const deadline = Date.now() + 305_000;
  while (!completed) {
    if (processError) throw processError;
    if (Date.now() >= deadline) throw new Error("Document analysis timed out. Try again from the Assets page.");
    const response = await fetch(`/api/assets/${assetId}/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json()) as AssetStatusResponse;
    const asset = body.data;
    if (!response.ok || !asset) throw new Error(body.message || "Unable to check document analysis status.");

    if (asset.processingStatus === "failed") throw new Error(asset.processingError || "Document analysis failed.");
    if (asset.processingStatus === "ready") {
      completed = asset;
      break;
    }

    const stage: AssetUploadStage = asset.processingStatus === "embedding" ? "embedding" : "extracting";
    input.onProgress({ stage, progress: asset.processingProgress, message: stageMessage[stage] });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await processRequest;
  if (processError) throw processError;
  input.onProgress({ stage: "ready", progress: 100, message: stageMessage.ready });
  return { assetId, name: completed.name, summary: completed.summary };
}
