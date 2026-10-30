import { z } from "zod/v3";

const assetId = z.string().uuid();
const folderId = z.string().uuid();

export const listAssetsInputSchema = z.object({
  search: z.string().trim().max(160).optional(),
  fileType: z.string().trim().max(16).optional(),
  category: z.string().trim().max(80).optional(),
  folderId: z.union([folderId, z.literal("root")]).optional(),
  page: z.number().int().min(1).max(100_000).default(1),
});

export const createAssetInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  pathname: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^assets\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/),
  mimeType: z.string().trim().min(1).max(255),
  folderId: folderId.optional(),
});

export const createFolderInputSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const renameAssetInputSchema = z.object({ assetId, name: z.string().trim().min(1).max(255) });
export const moveAssetInputSchema = z.object({ assetId, folderId: folderId.nullable() });
export const categorizeAssetInputSchema = z.object({ assetId, category: z.string().trim().min(1).max(80) });
export const folderMutationInputSchema = z.object({ folderId });
export const renameFolderInputSchema = z.object({ folderId, name: z.string().trim().min(1).max(80) });
export const statusAssetsInputSchema = z.object({ assetIds: z.array(assetId).min(1).max(5) });
export const deleteAssetInputSchema = z.object({ assetId });
