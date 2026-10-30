import { createTRPCRouter, protectedProcedure, withApiSuccess } from "@/core/api/api.methods";
import {
  categorizeAssetInputSchema,
  createAssetInputSchema,
  createFolderInputSchema,
  deleteAssetInputSchema,
  folderMutationInputSchema,
  listAssetsInputSchema,
  moveAssetInputSchema,
  renameFolderInputSchema,
  renameAssetInputSchema,
  statusAssetsInputSchema,
} from "./assets.schema";
import {
  categorizeAsset,
  createAsset,
  createFolder,
  deleteFolder,
  deleteAsset,
  getAssetStatuses,
  listAssets,
  moveAsset,
  renameFolder,
  renameAsset,
} from "./assets.service";

export const assetsRouter = createTRPCRouter({
  list: protectedProcedure.input(listAssetsInputSchema).query(async ({ ctx, input }) =>
    withApiSuccess(await listAssets({ userId: ctx.user.id, ...input }), "Assets retrieved successfully."),
  ),
  create: protectedProcedure.input(createAssetInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await createAsset({ userId: ctx.user.id, ...input }), "Asset uploaded successfully."),
  ),
  createFolder: protectedProcedure.input(createFolderInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await createFolder(ctx.user.id, input.name), "Folder created successfully."),
  ),
  renameFolder: protectedProcedure.input(renameFolderInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await renameFolder(ctx.user.id, input.folderId, input.name), "Folder renamed successfully."),
  ),
  deleteFolder: protectedProcedure.input(folderMutationInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await deleteFolder(ctx.user.id, input.folderId), "Folder deleted successfully."),
  ),
  status: protectedProcedure.input(statusAssetsInputSchema).query(async ({ ctx, input }) =>
    withApiSuccess(await getAssetStatuses(ctx.user.id, input.assetIds), "Asset processing states retrieved."),
  ),
  rename: protectedProcedure.input(renameAssetInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await renameAsset(ctx.user.id, input.assetId, input.name), "Asset renamed successfully."),
  ),
  move: protectedProcedure.input(moveAssetInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await moveAsset(ctx.user.id, input.assetId, input.folderId), "Asset moved successfully."),
  ),
  categorize: protectedProcedure.input(categorizeAssetInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(await categorizeAsset(ctx.user.id, input.assetId, input.category), "Category updated successfully."),
  ),
  delete: protectedProcedure.input(deleteAssetInputSchema).mutation(
    async ({ ctx, input }) =>
      withApiSuccess(await deleteAsset(ctx.user.id, input.assetId), "Asset deleted successfully."),
  ),
});
