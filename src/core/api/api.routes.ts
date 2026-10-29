import { createCallerFactory, createTRPCRouter } from "@/core/api/api.methods";
import { analyticsRouter } from "@/module/analytics/analytics.api";
import { attachmentsRouter } from "@/module/attachments/attachments.api";
import { assetsRouter } from "@/module/assets/assets.api";
import { billingRouter } from "@/module/billing/billing.api";
import { chatRouter } from "@/module/chat/chat.api";
import { creditsRouter } from "@/module/credits/credits.api";
import { systemRouter } from "@/module/system/system.api";
import { viewerRouter } from "@/module/viewer/viewer.api";

export const appRouter = createTRPCRouter({
  system: systemRouter,
  viewer: viewerRouter,
  chat: chatRouter,
  credits: creditsRouter,
  billing: billingRouter,
  attachments: attachmentsRouter,
  assets: assetsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
