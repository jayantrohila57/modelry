import { del, head } from "@vercel/blob";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/core/db/db";
import { assetChunk, assetFolder, chatAttachment } from "@/core/db/db.schema";
import { serverEnv } from "@/shared/config/env.server";
import { getAssetFileType, isAssetPathOwnedByUser, validateAssetUpload } from "./assets.domain";

const createId = () => crypto.randomUUID();

export async function listAssets(input: {
  userId: string;
  search?: string;
  fileType?: string;
  category?: string;
  folderId?: string;
}) {
  const filters = [eq(chatAttachment.userId, input.userId), ne(chatAttachment.status, "deleted"), isNotNull(chatAttachment.pathname)];
  if (input.fileType) filters.push(eq(chatAttachment.fileType, input.fileType));
  if (input.category) filters.push(eq(chatAttachment.category, input.category));
  if (input.folderId === "root") filters.push(isNull(chatAttachment.folderId));
  else if (input.folderId) filters.push(eq(chatAttachment.folderId, input.folderId));
  if (input.search) {
    const term = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(chatAttachment.name, term), ilike(chatAttachment.summary, term))!);
  }

  const [assets, folders] = await Promise.all([
    db
      .select({
        id: chatAttachment.id,
        name: chatAttachment.name,
        mimeType: chatAttachment.mimeType,
        sizeBytes: chatAttachment.sizeBytes,
        fileType: chatAttachment.fileType,
        category: chatAttachment.category,
        folderId: chatAttachment.folderId,
        summary: chatAttachment.summary,
        extractedMetadata: chatAttachment.extractedMetadata,
        processingStatus: chatAttachment.processingStatus,
        processingProgress: chatAttachment.processingProgress,
        processingError: chatAttachment.processingError,
        indexedAt: chatAttachment.indexedAt,
        createdAt: chatAttachment.createdAt,
        updatedAt: chatAttachment.updatedAt,
      })
      .from(chatAttachment)
      .where(and(...filters))
      .orderBy(desc(chatAttachment.createdAt))
      .limit(200),
    db
      .select({ id: assetFolder.id, name: assetFolder.name, createdAt: assetFolder.createdAt })
      .from(assetFolder)
      .where(eq(assetFolder.userId, input.userId))
      .orderBy(asc(assetFolder.name)),
  ]);

  return {
    assets,
    folders,
    categories: [...new Set(assets.map((asset) => asset.category))].sort((a, b) => a.localeCompare(b)),
  };
}

export async function createAsset(input: {
  userId: string;
  name: string;
  pathname: string;
  mimeType: string;
  folderId?: string;
}) {
  const fileType = getAssetFileType(input.name);
  if (fileType === "other") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This file type is not supported for document analysis." });
  }
  if (!isAssetPathOwnedByUser(input.pathname, input.userId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid upload path." });
  }

  let blob;
  try {
    blob = await head(input.pathname);
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: "Uploaded file could not be found in Blob storage." });
  }
  if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Uploaded file could not be found in Blob storage." });

  const validation = validateAssetUpload({
    name: input.name,
    mimeType: blob.contentType || input.mimeType,
    sizeBytes: blob.size,
    maxSizeBytes: serverEnv.MAX_UPLOAD_FILE_SIZE_BYTES,
  });
  if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });

  if (input.folderId) {
    const folder = await db.query.assetFolder.findFirst({
      where: and(eq(assetFolder.id, input.folderId), eq(assetFolder.userId, input.userId)),
      columns: { id: true },
    });
    if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  }

  const id = createId();
  await db.insert(chatAttachment).values({
    id,
    userId: input.userId,
    name: input.name,
    url: blob.url,
    pathname: blob.pathname,
    mimeType: blob.contentType || input.mimeType,
    sizeBytes: blob.size,
    fileType,
    folderId: input.folderId ?? null,
    processingStatus: "queued",
    processingProgress: 0,
  });

  return id;
}

export async function createFolder(userId: string, name: string) {
  const id = createId();
  try {
    const [folder] = await db.insert(assetFolder).values({ id, userId, name }).returning({
      id: assetFolder.id,
      name: assetFolder.name,
      createdAt: assetFolder.createdAt,
    });
    return folder;
  } catch {
    throw new TRPCError({ code: "CONFLICT", message: "A folder with that name already exists." });
  }
}

export async function renameFolder(userId: string, folderId: string, name: string) {
  const [folder] = await db
    .update(assetFolder)
    .set({ name })
    .where(and(eq(assetFolder.id, folderId), eq(assetFolder.userId, userId)))
    .returning({ id: assetFolder.id, name: assetFolder.name, updatedAt: assetFolder.updatedAt });
  if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  return folder;
}

export async function deleteFolder(userId: string, folderId: string) {
  const [folder] = await db
    .delete(assetFolder)
    .where(and(eq(assetFolder.id, folderId), eq(assetFolder.userId, userId)))
    .returning({ id: assetFolder.id });
  if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  return { ok: true, folderId };
}

export async function getAssetStatuses(userId: string, assetIds: string[]) {
  return db
    .select({
      id: chatAttachment.id,
      processingStatus: chatAttachment.processingStatus,
      processingProgress: chatAttachment.processingProgress,
      processingError: chatAttachment.processingError,
      summary: chatAttachment.summary,
      name: chatAttachment.name,
    })
    .from(chatAttachment)
    .where(and(eq(chatAttachment.userId, userId), inArray(chatAttachment.id, assetIds), ne(chatAttachment.status, "deleted")));
}

export async function renameAsset(userId: string, assetId: string, name: string) {
  const [asset] = await db
    .update(chatAttachment)
    .set({ name })
    .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId), ne(chatAttachment.status, "deleted")))
    .returning({ id: chatAttachment.id, name: chatAttachment.name, updatedAt: chatAttachment.updatedAt });
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
  return asset;
}

export async function moveAsset(userId: string, assetId: string, folderId: string | null) {
  if (folderId) {
    const folder = await db.query.assetFolder.findFirst({
      where: and(eq(assetFolder.id, folderId), eq(assetFolder.userId, userId)),
      columns: { id: true },
    });
    if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found." });
  }
  const [asset] = await db
    .update(chatAttachment)
    .set({ folderId })
    .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId), ne(chatAttachment.status, "deleted")))
    .returning({ id: chatAttachment.id, folderId: chatAttachment.folderId });
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
  return asset;
}

export async function categorizeAsset(userId: string, assetId: string, category: string) {
  const [asset] = await db
    .update(chatAttachment)
    .set({ category })
    .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId), ne(chatAttachment.status, "deleted")))
    .returning({ id: chatAttachment.id, category: chatAttachment.category });
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
  return asset;
}

export async function deleteAsset(userId: string, assetId: string) {
  const [asset] = await db
    .select({ id: chatAttachment.id, pathname: chatAttachment.pathname })
    .from(chatAttachment)
    .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId), ne(chatAttachment.status, "deleted")))
    .limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });

  if (asset.pathname) await del(asset.pathname);
  await db.delete(assetChunk).where(and(eq(assetChunk.assetId, assetId), eq(assetChunk.userId, userId)));
  await db.delete(chatAttachment).where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId)));
  return { ok: true, assetId };
}

export async function getAssetForUser(userId: string, assetId: string) {
  const [asset] = await db
    .select({
      id: chatAttachment.id,
      userId: chatAttachment.userId,
      pathname: chatAttachment.pathname,
      name: chatAttachment.name,
      mimeType: chatAttachment.mimeType,
      fileType: chatAttachment.fileType,
      status: chatAttachment.status,
      processingStatus: chatAttachment.processingStatus,
    })
    .from(chatAttachment)
    .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId), ne(chatAttachment.status, "deleted")))
    .limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
  return asset;
}

export async function validateAssetsForChat(userId: string, assetIds: string[]) {
  const uniqueIds = [...new Set(assetIds)];
  if (uniqueIds.length !== assetIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate assets were attached." });
  if (!uniqueIds.length) return;
  const owned = await db
    .select({ id: chatAttachment.id })
    .from(chatAttachment)
    .where(
      and(
        eq(chatAttachment.userId, userId),
        inArray(chatAttachment.id, uniqueIds),
        eq(chatAttachment.processingStatus, "ready"),
        ne(chatAttachment.status, "deleted"),
      ),
    );
  if (owned.length !== uniqueIds.length) {
    throw new TRPCError({ code: "FORBIDDEN", message: "One or more attached files are unavailable." });
  }
}

export async function linkAssetsToThread(userId: string, threadId: string, messageId: string, assetIds: string[]) {
  if (!assetIds.length) return;
  await db
    .update(chatAttachment)
    .set({ threadId, messageId, status: "attached" })
    .where(
      and(
        eq(chatAttachment.userId, userId),
        inArray(chatAttachment.id, assetIds),
        ne(chatAttachment.status, "deleted"),
        or(isNull(chatAttachment.threadId), eq(chatAttachment.threadId, threadId)),
      ),
    );
}
