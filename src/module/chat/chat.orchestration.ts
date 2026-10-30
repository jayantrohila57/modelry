import { TRPCError } from "@trpc/server";
import type { UIMessage } from "ai";
import type { chatMessage } from "@/core/db/db.schema";
import { calculateCreditCostFromTokens, getResolvedAiModelForUser } from "@/module/ai/ai.models";
import {
  addAdditionalPromptContextTokens,
  estimateCreditReservation,
  estimateTokenCount,
  estimateTokensFromMessages,
  exceedsChatContextWindow,
  extractPlainTextFromMessage,
} from "@/module/ai/ai.tokens";
import {
  createAssistantPlaceholder,
  ensureThreadForRequest,
  finalizeAssistantMessage,
  getThreadContextForAssistant,
  persistUserMessage,
  prepareUserMessageReplay,
} from "@/module/chat/chat.service";
import {
  ensureWalletForUser,
  grantStarterCreditsIfEligible,
  reserveCredits,
  settleReservedCredits,
} from "@/module/credits/credits.service";
import { serverEnv } from "@/shared/config/env.server";

export const CHAT_CONTEXT_WINDOW_EXCEEDED_CODE = "CONTEXT_WINDOW_EXCEEDED";

export async function prepareChatExchange(input: {
  latestUserMessage: UIMessage;
  modelId?: string | null;
  requestMessages: UIMessage[];
  additionalPromptContext?: string;
  webSearch?: boolean;
  threadId?: string | null;
  replay?: { clientMessageId: string; content?: string };
  userId: string;
}) {
  await ensureWalletForUser(input.userId);
  await grantStarterCreditsIfEligible(input.userId);

  const resolvedModel = await getResolvedAiModelForUser({
    userId: input.userId,
    modelId: input.modelId,
  });

  if (input.webSearch && resolvedModel.provider !== "google") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Web search is currently available for Google models only." });
  }

  if (!input.replay && input.requestMessages.filter((message) => message.role === "user").length === 1) {
    const initialPromptTokens = addAdditionalPromptContextTokens(
      estimateTokensFromMessages(input.requestMessages),
      input.additionalPromptContext ?? "",
    );
    if (exceedsChatContextWindow(initialPromptTokens, resolvedModel.contextWindow)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${CHAT_CONTEXT_WINDOW_EXCEEDED_CODE}: This prompt is too large for the selected model. Shorten it, remove some attachments, or choose a model with a larger context window.`,
      });
    }
  }

  const thread = await ensureThreadForRequest({
    userId: input.userId,
    threadId: input.threadId,
    model: resolvedModel.id,
    latestUserMessage: input.latestUserMessage,
  });

  const replayState = input.replay
    ? await prepareUserMessageReplay({
        userId: input.userId,
        threadId: thread.id,
        clientMessageId: input.replay.clientMessageId,
        content: input.replay.content,
      })
    : undefined;
  const context = await getThreadContextForAssistant({
    userId: input.userId,
    threadId: thread.id,
    throughClientMessageId: replayState?.targetClientMessageId,
    replacementContent: replayState?.replacementContent,
  });

  if (!replayState && !context.messages.some((message) => message.id === input.latestUserMessage.id)) {
    context.messages.push({
      id: input.latestUserMessage.id,
      role: "user",
      parts: [{ type: "text", text: extractPlainTextFromMessage(input.latestUserMessage) }],
    });
  }

  const basePromptTokens = Math.max(
    estimateTokensFromMessages(context.messages),
    estimateTokenCount(extractPlainTextFromMessage(input.latestUserMessage)),
  );
  const estimatedPromptTokens = addAdditionalPromptContextTokens(basePromptTokens, input.additionalPromptContext ?? "");

  if (exceedsChatContextWindow(estimatedPromptTokens, resolvedModel.contextWindow)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${CHAT_CONTEXT_WINDOW_EXCEEDED_CODE}: This conversation is too large for the selected model. Start a new chat, shorten the prompt, remove some attachments, or choose a model with a larger context window.`,
    });
  }

  const persistedUserMessage = await persistUserMessage({
    userId: input.userId,
    threadId: thread.id,
    message: input.latestUserMessage,
    model: resolvedModel.id,
  });

  const estimatedCredits = calculateCreditCostFromTokens(estimatedPromptTokens, resolvedModel.creditMultiplierBps);
  const reservedCreditsAmount = estimateCreditReservation(
    estimatedCredits,
    serverEnv.CHAT_RESERVE_RATIO,
    serverEnv.CHAT_RESERVE_MIN_CREDITS,
  );

  const reservation = await reserveCredits({
    userId: input.userId,
    amountCredits: reservedCreditsAmount,
    threadId: thread.id,
    messageId: persistedUserMessage.id,
    note: `Reserved for thread ${thread.id}`,
  });

  let assistantMessage: typeof chatMessage.$inferSelect;

  try {
    assistantMessage = await createAssistantPlaceholder({
      userId: input.userId,
      threadId: thread.id,
      provider: resolvedModel.provider,
      model: resolvedModel.id,
      summaryVersionUsed: context.summaryVersion,
    });
  } catch (error) {
    await settleReservedCredits({
      userId: input.userId,
      reservedCredits: reservation.reservedCredits,
      actualCredits: 0,
      threadId: thread.id,
      messageId: persistedUserMessage.id,
    });
    throw error;
  }

  return {
    assistantMessage,
    context,
    estimatedPromptTokens,
    persistedUserMessage,
    reservedCredits: reservation.reservedCredits,
    resolvedModel,
    thread,
    replay: replayState
      ? {
          targetMessageId: replayState.targetMessageId,
          replacementContent: replayState.replacementContent,
          replacementParts: replayState.replacementParts,
          followingMessageIds: replayState.followingMessageIds,
        }
      : undefined,
  };
}

export async function finalizeChatExchange(input: {
  content: string;
  parts?: UIMessage["parts"];
  completionTokens: number;
  messageId: string;
  modelId: string;
  creditMultiplierBps: number;
  promptTokens: number;
  provider: string;
  reasoning?: string | null;
  reasoningTokens?: number;
  reservedCredits: number;
  status?: "completed" | "cancelled";
  summaryVersionUsed?: number;
  threadId: string;
  totalTokens?: number;
  userId: string;
  replay?: {
    targetMessageId: string;
    replacementContent?: string;
    replacementParts?: UIMessage["parts"];
    followingMessageIds: string[];
  };
}) {
  const totalTokens = Math.max(
    0,
    input.totalTokens ?? input.promptTokens + input.completionTokens + (input.reasoningTokens ?? 0),
  );
  const actualCredits = calculateCreditCostFromTokens(totalTokens, input.creditMultiplierBps);

  const settlement = await settleReservedCredits({
    userId: input.userId,
    reservedCredits: input.reservedCredits,
    actualCredits,
    threadId: input.threadId,
    messageId: input.messageId,
  });

  await finalizeAssistantMessage({
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.messageId,
    content: input.content,
    parts: input.parts,
    reasoning: input.reasoning,
    reasoningTokens: input.reasoningTokens,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens,
    creditCost: settlement.chargedCredits,
    provider: input.provider,
    model: input.modelId,
    status: input.status,
    summaryVersionUsed: input.summaryVersionUsed,
    replay: input.replay,
  });

  return settlement;
}
