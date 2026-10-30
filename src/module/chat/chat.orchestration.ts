import type { UIMessage } from "ai";
import type { chatMessage } from "@/core/db/db.schema";
import { calculateCreditCostFromTokens, getResolvedAiModelForUser } from "@/module/ai/ai.models";
import {
  addAdditionalPromptContextTokens,
  estimateCreditReservation,
  estimateTokenCount,
  estimateTokensFromMessages,
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

export async function prepareChatExchange(input: {
  latestUserMessage: UIMessage;
  modelId?: string | null;
  requestMessages: UIMessage[];
  additionalPromptContext?: string;
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

  const thread = await ensureThreadForRequest({
    userId: input.userId,
    threadId: input.threadId,
    model: resolvedModel.id,
    latestUserMessage: input.latestUserMessage,
  });

  const persistedUserMessage = await persistUserMessage({
    userId: input.userId,
    threadId: thread.id,
    message: input.latestUserMessage,
    model: resolvedModel.id,
  });

  let context = await getThreadContextForAssistant({
    userId: input.userId,
    threadId: thread.id,
  });

  const basePromptTokens = Math.max(
    estimateTokensFromMessages(input.requestMessages),
    estimateTokensFromMessages(context.messages),
    estimateTokenCount(persistedUserMessage.content),
  );
  const estimatedPromptTokens = addAdditionalPromptContextTokens(basePromptTokens, input.additionalPromptContext ?? "");

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
    if (input.replay) {
      await prepareUserMessageReplay({
        userId: input.userId,
        threadId: thread.id,
        clientMessageId: input.replay.clientMessageId,
        content: input.replay.content,
      });
      context = await getThreadContextForAssistant({
        userId: input.userId,
        threadId: thread.id,
      });
    }

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
  };
}

export async function finalizeChatExchange(input: {
  content: string;
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
  });

  return settlement;
}
