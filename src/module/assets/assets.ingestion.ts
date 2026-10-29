import { embedMany, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { del, get } from "@vercel/blob";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { ollama } from "ollama-ai-provider-v2";
import { OfficeParser } from "officeparser";
import { db } from "@/core/db/db";
import { assetChunk, chatAttachment } from "@/core/db/db.schema";
import { getChatModel } from "@/module/ai/ai.provider";
import { serverEnv } from "@/shared/config/env.server";
import { getProcessingProgress, splitTextIntoChunks, type AssetFileType, type AssetProcessingStatus } from "./assets.domain";
import { getAssetForUser } from "./assets.service";

const VECTOR_DIMENSIONS = 768;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const MAX_CHUNKS_PER_ASSET = 700;

async function setProcessingStatus(assetId: string, status: AssetProcessingStatus, error: string | null = null) {
  await db
    .update(chatAttachment)
    .set({ processingStatus: status, processingProgress: getProcessingProgress(status), processingError: error })
    .where(eq(chatAttachment.id, assetId));
}

function toSafeMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value, (_key, current) => (current instanceof Date ? current.toISOString() : current))) as Record<string, unknown>;
}

async function extractDocument(buffer: Buffer, fileType: AssetFileType) {
  if (fileType === "txt") {
    return { text: buffer.toString("utf8"), metadata: {} };
  }

  const ast = await OfficeParser.parseOffice(buffer, {
    fileType: fileType as Exclude<AssetFileType, "other" | "txt">,
    includeRawContent: false,
    ocr: false,
  });
  const extracted = await ast.to("text");
  return { text: extracted.value, metadata: toSafeMetadata(ast.metadata as Record<string, unknown>) };
}

async function makeSummary(text: string, fileName: string) {
  try {
    const result = await generateText({
      model: getChatModel(),
      prompt: `Analyze this document and return exactly three short lines, without JSON:\nSUMMARY: one or two neutral sentences describing the document\nCATEGORY: one broad, domain-neutral category (for example: Report, Notes, Research, Reference, Correspondence, or Data)\nTAGS: up to five concise topic tags\n\nFilename: ${fileName}\nDocument text:\n${text.slice(0, 12_000)}`,
      maxOutputTokens: 180,
    });
    const summary = result.text.match(/^SUMMARY:\s*(.+)$/im)?.[1]?.trim();
    const category = result.text.match(/^CATEGORY:\s*(.+)$/im)?.[1]?.trim();
    const tags = result.text.match(/^TAGS:\s*(.+)$/im)?.[1]?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];
    return {
      summary: summary || text.slice(0, 360).trim(),
      category: category?.slice(0, 80) || "Documents",
      tags: tags.slice(0, 5),
    };
  } catch {
    return { summary: text.slice(0, 360).trim(), category: "Documents", tags: [] as string[] };
  }
}

async function createEmbeddings(chunks: string[]) {
  const model = serverEnv.AI_PROVIDER === "google"
    ? google.textEmbeddingModel(serverEnv.ASSET_EMBEDDING_MODEL)
    : ollama.textEmbeddingModel(serverEnv.ASSET_EMBEDDING_MODEL);
  const result = await embedMany({
    model,
    values: chunks,
    ...(serverEnv.AI_PROVIDER === "google"
      ? { providerOptions: { google: { outputDimensionality: VECTOR_DIMENSIONS } } }
      : {}),
  });

  for (const embedding of result.embeddings) {
    if (embedding.length !== VECTOR_DIMENSIONS) {
      throw new Error(`Embedding model returned ${embedding.length} dimensions; expected ${VECTOR_DIMENSIONS}.`);
    }
  }
  return result.embeddings;
}

export async function processAsset(userId: string, assetId: string) {
  const asset = await getAssetForUser(userId, assetId);
  if (asset.processingStatus === "ready") return { id: asset.id, status: "ready" as const };
  if (asset.processingStatus === "extracting" || asset.processingStatus === "embedding") {
    return { id: asset.id, status: asset.processingStatus };
  }
  if (!asset.pathname || asset.fileType === "other") throw new Error("This asset cannot be analyzed.");

  const [locked] = await db
    .update(chatAttachment)
    .set({ processingStatus: "extracting", processingProgress: getProcessingProgress("extracting"), processingError: null })
    .where(
      and(
        eq(chatAttachment.id, assetId),
        eq(chatAttachment.userId, userId),
        inArray(chatAttachment.processingStatus, ["queued", "failed"]),
      ),
    )
    .returning({ id: chatAttachment.id });
  if (!locked) return { id: assetId, status: "processing" as const };

  try {
    const storedBlob = await get(asset.pathname, { access: "private" });
    if (!storedBlob || storedBlob.statusCode !== 200) throw new Error("The stored file could not be downloaded.");
    const buffer = Buffer.from(await new Response(storedBlob.stream).arrayBuffer());
    if (buffer.byteLength > serverEnv.MAX_UPLOAD_FILE_SIZE_BYTES) throw new Error("The file exceeds the configured size limit.");

    const extracted = await extractDocument(buffer, asset.fileType as AssetFileType);
    const text = extracted.text.replace(/\u0000/g, "").trim().slice(0, MAX_EXTRACTED_CHARACTERS);
    if (!text) throw new Error("No readable text was found in this document.");
    const chunks = splitTextIntoChunks(text, { maxCharacters: 3500, overlapCharacters: 400 });
    if (!chunks.length || chunks.length > MAX_CHUNKS_PER_ASSET) {
      throw new Error("This document has too much text to index in one pass.");
    }

    const summary = await makeSummary(text, asset.name);
    await setProcessingStatus(assetId, "embedding");
    const embeddings = await createEmbeddings(chunks);

    await db.delete(assetChunk).where(and(eq(assetChunk.assetId, assetId), eq(assetChunk.userId, userId)));
    await db.insert(assetChunk).values(
      chunks.map((content, chunkIndex) => ({
        id: crypto.randomUUID(),
        assetId,
        userId,
        chunkIndex,
        content,
        embedding: embeddings[chunkIndex]!,
      })),
    );
    await db
      .update(chatAttachment)
      .set({
        extractedText: text,
        extractedMetadata: { ...extracted.metadata, tags: summary.tags },
        summary: summary.summary,
        category: summary.category,
        processingStatus: "ready",
        processingProgress: 100,
        processingError: null,
        indexedAt: new Date(),
      })
      .where(and(eq(chatAttachment.id, assetId), eq(chatAttachment.userId, userId)));

    return { id: assetId, status: "ready" as const, chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document analysis failed.";
    await setProcessingStatus(assetId, "failed", message.slice(0, 500));
    throw error;
  }
}

export async function findRelevantAssetChunks(input: { userId: string; query: string; limit?: number; assetIds?: string[] }) {
  const assetIds = [...new Set(input.assetIds ?? [])];
  const query = input.query.trim() || (assetIds.length ? "Summarize the uploaded documents" : "");
  if (!query) return [];
  const hasReadyAssets = await db.query.chatAttachment.findFirst({
    where: and(
      eq(chatAttachment.userId, input.userId),
      eq(chatAttachment.processingStatus, "ready"),
      ne(chatAttachment.status, "deleted"),
    ),
    columns: { id: true },
  });
  if (!hasReadyAssets) return [];
  const embeddings = await createEmbeddings([query]);
  const vector = `[${embeddings[0]!.join(",")}]`;
  if (assetIds.length) {
    const results = await Promise.all(assetIds.map(async (assetId) => {
      const result = await db.execute(sql`
        select c.asset_id as "assetId", a.name as "name", c.content as "content",
          1 - (c.embedding <=> ${vector}::vector) as "similarity", true as "explicitlyAttached"
        from asset_chunk c
        inner join chat_attachment a on a.id = c.asset_id
        where c.asset_id = ${assetId} and c.user_id = ${input.userId} and a.user_id = ${input.userId}
          and a.status <> 'deleted' and a.processing_status = 'ready'
        order by c.embedding <=> ${vector}::vector
        limit 3
      `);
      return result.rows as Array<{ assetId: string; name: string; content: string; similarity: number; explicitlyAttached: boolean }>;
    }));
    return results.flat();
  }

  const result = await db.execute(sql`
    select c.asset_id as "assetId", a.name as "name", c.content as "content",
      1 - (c.embedding <=> ${vector}::vector) as "similarity", false as "explicitlyAttached"
    from asset_chunk c
    inner join chat_attachment a on a.id = c.asset_id
    where c.user_id = ${input.userId} and a.user_id = ${input.userId}
      and a.status <> 'deleted' and a.processing_status = 'ready'
    order by c.embedding <=> ${vector}::vector
    limit ${input.limit ?? 6}
  `);
  return result.rows as Array<{ assetId: string; name: string; content: string; similarity: number; explicitlyAttached: boolean }>;
}
