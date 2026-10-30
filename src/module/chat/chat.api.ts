import { createTRPCRouter, protectedProcedure, withApiSuccess } from "@/core/api/api.methods";
import { listAllowedAiModelsForUser } from "@/module/ai/ai.models";
import {
  archiveThreadInputSchema,
  createThreadInputSchema,
  deleteThreadInputSchema,
  getOlderThreadMessagesInputSchema,
  getThreadInputSchema,
  listThreadsInputSchema,
  pinThreadInputSchema,
  renameThreadInputSchema,
  restoreThreadInputSchema,
} from "./chat.schema";
import {
  archiveThread,
  createThread,
  deleteThread,
  getOlderThreadMessages,
  getThread,
  listThreads,
  renameThread,
  restoreThread,
  setThreadPinned,
} from "./chat.service";

export const chatRouter = createTRPCRouter({
  list: protectedProcedure.input(listThreadsInputSchema).query(async ({ ctx, input }) =>
    withApiSuccess(
      await listThreads(ctx.user.id, {
        archived: input.archived,
        limit: input.limit,
        offset: input.offset,
        search: input.search,
      }),
      "Threads retrieved successfully.",
    ),
  ),
  get: protectedProcedure
    .input(getThreadInputSchema)
    .query(async ({ ctx, input }) =>
      withApiSuccess(await getThread(ctx.user.id, input.threadId), "Thread retrieved successfully."),
    ),
  olderMessages: protectedProcedure.input(getOlderThreadMessagesInputSchema).query(async ({ ctx, input }) =>
    withApiSuccess(
      await getOlderThreadMessages({
        userId: ctx.user.id,
        threadId: input.threadId,
        beforeMessageId: input.beforeMessageId,
        limit: input.limit,
      }),
      "Earlier chat messages retrieved successfully.",
    ),
  ),
  models: protectedProcedure.query(async ({ ctx }) =>
    withApiSuccess(await listAllowedAiModelsForUser(ctx.user.id), "Allowed chat models retrieved successfully."),
  ),
  create: protectedProcedure.input(createThreadInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(
      await createThread({
        userId: ctx.user.id,
        title: input.title,
        model: input.model,
      }),
      "Thread created successfully.",
    ),
  ),
  rename: protectedProcedure.input(renameThreadInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(
      await renameThread({
        userId: ctx.user.id,
        threadId: input.threadId,
        title: input.title,
      }),
      "Thread renamed successfully.",
    ),
  ),
  archive: protectedProcedure.input(archiveThreadInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(
      await archiveThread({
        userId: ctx.user.id,
        threadId: input.threadId,
      }),
      "Thread archived successfully.",
    ),
  ),
  restore: protectedProcedure.input(restoreThreadInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(
      await restoreThread({
        userId: ctx.user.id,
        threadId: input.threadId,
      }),
      "Thread restored successfully.",
    ),
  ),
  pin: protectedProcedure
    .input(pinThreadInputSchema)
    .mutation(async ({ ctx, input }) =>
      withApiSuccess(
        await setThreadPinned({ userId: ctx.user.id, threadId: input.threadId, isPinned: input.isPinned }),
        input.isPinned ? "Chat pinned." : "Chat unpinned.",
      ),
    ),
  delete: protectedProcedure.input(deleteThreadInputSchema).mutation(async ({ ctx, input }) =>
    withApiSuccess(
      await deleteThread({
        userId: ctx.user.id,
        threadId: input.threadId,
      }),
      "Chat permanently deleted.",
    ),
  ),
});
