"use client";

import { useChat } from "@ai-sdk/react";
import { MessageScroller } from "@shadcn/react/message-scroller";
import { DefaultChatTransport, type DynamicToolUIPart, type FileUIPart, type ToolUIPart, type UIMessage } from "ai";
import {
  ArchiveRestore,
  CheckIcon,
  CopyIcon,
  Info,
  InfoIcon,
  Layers,
  MessageCircleIcon,
  MoreHorizontal,
  PencilIcon,
  RotateCwIcon,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  apiClient,
  getApiErrorMessage,
  getApiResponseData,
  getApiResponseMessage,
  type RouterOutputs,
  type UnwrapApiData,
} from "@/core/api/api.client";
import { AssetFileIcon } from "@/module/assets/asset-file-icon";
import { AssetUploadSteps } from "@/module/assets/asset-upload-steps";
import { ASSET_FILE_TYPES } from "@/module/assets/assets.domain";
import { type AssetUploadProgress, uploadAndProcessAsset } from "@/module/assets/assets.upload";
import { announceChatChange, createChatWorkspaceKey, getNewChatDestination } from "@/module/chat/chat.navigation";
import { createRetryChatRequest, resolveChatRequestThreadId } from "@/module/chat/chat.request.utils";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  useConversationViewport,
} from "@/shared/components/ai-elements/conversation";
import { MessageAction, MessageActions, MessageResponse } from "@/shared/components/ai-elements/message";
import type { PromptInputMessage } from "@/shared/components/ai-elements/prompt-input";
import {
  PromptInputProvider,
  usePromptInputController,
  useProviderAttachments,
} from "@/shared/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/shared/components/ai-elements/suggestion";
import Shell from "@/shared/components/layout/shell";
import { useSettingsDialog } from "@/shared/components/provider/global-modal.provider";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/components/ui/attachment";
import { Badge } from "@/shared/components/ui/badge";
import { Bubble, BubbleContent } from "@/shared/components/ui/bubble";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/shared/components/ui/hover-card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Message as MessageFrame,
  MessageContent as MessageFrameContent,
  MessageFooter as MessageFrameFooter,
} from "@/shared/components/ui/message";
import { Spinner } from "@/shared/components/ui/spinner";
import { Textarea } from "@/shared/components/ui/textarea";
import { Toggle } from "@/shared/components/ui/toggle";
import { PATH } from "@/shared/config/routes";
import { useIsMobile } from "@/shared/utils/hooks/use-mobile";
import { cn } from "@/shared/utils/lib/utils";
import { CHAT_RECENT_THREADS_LIMIT, type ChatWorkspaceMessage, chatSuggestions } from "./chat.data";
import { ChatMetaRail } from "./chat.meta-rail";
import { type ChatReasoningEffort, type ChatTemperaturePreset, deriveAutoThreadTitleFromText } from "./chat.runtime";
import {
  formatMessageTimestamp,
  getMessageMetadata,
  getReasoningFromUiMessage,
  getTextFromUiMessage,
  getThreadIdFromMessageMetadata,
  mapPersistedMessagesToUiMessages,
  type PersistedChatMessage,
} from "./chat-message.utils";
import { ChatComposer } from "./components/chat-composer";
import { ChatReasoningTrace, ChatSourcesTrace, ChatToolTrace } from "./components/chat-traces";
import {
  clearThreadDraftSnapshot,
  createThreadDraftKey,
  getThreadDraftSnapshot,
  saveThreadDraftSnapshot,
} from "./thread-draft-store";

const chatTransport = new DefaultChatTransport({
  api: "/api/ai/chat",
  fetch: async (input, init) => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(new DOMException("Request timed out", "TimeoutError")),
      120_000,
    );
    const signal = init?.signal ? AbortSignal.any([init.signal, timeoutController.signal]) : timeoutController.signal;

    try {
      return await fetch(input, { ...init, signal });
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
const CHAT_FILE_ACCEPT = ASSET_FILE_TYPES.map((extension) => `.${extension}`).join(",");

type AllowedModel = UnwrapApiData<RouterOutputs["chat"]["models"]>[number];
type ViewerSessionPayload = UnwrapApiData<RouterOutputs["viewer"]["session"]>;
type ToolPart = ToolUIPart | DynamicToolUIPart;

type ChatWorkspaceThread = {
  id: string;
  isArchived?: boolean;
  lastMessageAt: Date;
  model?: string | null;
  title: string;
  titleSource?: "auto" | "manual";
};

type ChatWorkspaceProps = {
  droppedAttachmentCount?: number;
  hasOlderMessages?: boolean;
  initialMessages?: PersistedChatMessage[];
  mode: "landing" | "thread";
  thread?: ChatWorkspaceThread | null;
  userId: string;
};

function mapUiMessagesToWorkspaceMessages(messages: UIMessage[]): ChatWorkspaceMessage[] {
  return messages.map((message) => {
    const metadata = getMessageMetadata(message);
    const textContent = getTextFromUiMessage(message);
    const reasoning = getReasoningFromUiMessage(message);
    const toolParts = message.parts.flatMap((part) => {
      if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
        const toolPart = part as ToolPart;
        return [
          {
            type: toolPart.type,
            toolName: toolPart.type === "dynamic-tool" ? toolPart.toolName : toolPart.type.slice(5),
            state: toolPart.state,
            input: toolPart.input,
            output: toolPart.output,
            errorText: toolPart.errorText,
          },
        ];
      }

      return [];
    });
    const sources = message.parts.flatMap((part) => {
      if (part.type !== "source-url") return [];
      try {
        const url = new URL(part.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") return [];
        return [{ href: url.toString(), title: part.title || url.hostname }];
      } catch {
        return [];
      }
    });

    return {
      from: message.role === "user" ? "user" : "assistant",
      key: message.id,
      content: textContent,
      createdAt: (message as UIMessage & { createdAt?: Date }).createdAt,
      toolParts,
      sources,
      metadata: {
        model: metadata.model,
        provider: metadata.provider,
        status: metadata.status,
      },
      attachments: message.parts
        .filter((part) => part.type === "file")
        .map((part, index) => ({
          id: `${message.id}-asset-${index}`,
          name: part.filename || "Document",
          mimeType: part.mediaType,
          url: part.url,
        })),
      reasoning: reasoning
        ? {
            content: reasoning,
          }
        : undefined,
      usage:
        metadata.promptTokens || metadata.completionTokens || metadata.totalTokens || metadata.creditCost
          ? {
              completionTokens: metadata.completionTokens ?? 0,
              creditCost: metadata.creditCost ?? 0,
              promptTokens: metadata.promptTokens ?? 0,
              reasoningTokens: metadata.reasoningTokens ?? 0,
              totalTokens: metadata.totalTokens ?? 0,
            }
          : undefined,
    } satisfies ChatWorkspaceMessage;
  });
}

function getAssetIdsFromMessage(message: UIMessage | undefined) {
  return (message?.parts ?? []).flatMap((part) => {
    if (part.type !== "file") return [];
    const match = part.url.match(/\/api\/assets\/([0-9a-f-]+)\/download/i);
    return match ? [match[1]] : [];
  });
}

function DraftSync({ draftKey, droppedAttachmentCount = 0 }: { draftKey: string; droppedAttachmentCount?: number }) {
  const controller = usePromptInputController();
  const attachments = useProviderAttachments();

  useEffect(() => {
    if (!controller.textInput.value.trim() && attachments.files.length === 0 && droppedAttachmentCount === 0) {
      clearThreadDraftSnapshot(draftKey);
      return;
    }

    saveThreadDraftSnapshot(draftKey, {
      attachments: attachments.files.map((file) => ({
        filename: file.filename ?? "attachment",
        id: file.id,
        mediaType: file.mediaType,
        type: "file",
        url: file.url,
        file: file.file,
      })),
      droppedAttachmentCount,
      text: controller.textInput.value,
    });
  }, [attachments.files, controller.textInput.value, droppedAttachmentCount, draftKey]);

  return null;
}

function ConversationScrollRestoration({ threadId }: { threadId: string | null }) {
  const viewportRef = useConversationViewport();
  const storageKey = `modelry:chat-scroll:${threadId ?? "landing"}`;

  useEffect(() => {
    const scrollElement = viewportRef?.current;
    if (!scrollElement) return;

    let restored = false;
    let firstFrame = 0;
    let secondFrame = 0;
    const restore = () => {
      const savedPosition = Number(sessionStorage.getItem(storageKey));
      if (Number.isFinite(savedPosition) && savedPosition > 0) {
        scrollElement.scrollTop = savedPosition;
      }
      restored = true;
    };
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(restore);
    });
    const save = () => {
      if (restored) sessionStorage.setItem(storageKey, String(scrollElement.scrollTop));
    };
    scrollElement.addEventListener("scroll", save, { passive: true });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      save();
      scrollElement.removeEventListener("scroll", save);
    };
  }, [storageKey, viewportRef]);

  return null;
}

function MessageUsage({ message }: { message: ChatWorkspaceMessage }) {
  const isStreaming = message.metadata?.status === "streaming";

  // Don't show anything if no data and not streaming
  if (!message.usage && !message.metadata?.model && !isStreaming) {
    return null;
  }

  // Calculate total tokens to check if we have meaningful data
  const totalTokens = message.usage?.totalTokens ?? 0;
  const hasNoTokenData = totalTokens < 1;

  // Don't show "More info" button when streaming or when no token data
  const showInfoButton = !isStreaming && !hasNoTokenData;

  return (
    <div className="flex items-center gap-2">
      {showInfoButton ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button type="button" className="text-muted-foreground px-0" variant="link">
              <InfoIcon className="size-3 text-muted-foreground" />
              More info
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Message Details</p>
              <div className="grid gap-1 text-xs">
                {message.metadata?.model && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span>{message.metadata.model}</span>
                  </div>
                )}
                {message.usage?.promptTokens !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prompt Tokens</span>
                    <span>{message.usage.promptTokens.toLocaleString()}</span>
                  </div>
                )}
                {message.usage?.completionTokens !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion</span>
                    <span>{message.usage.completionTokens.toLocaleString()}</span>
                  </div>
                )}
                {message.usage?.reasoningTokens !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reasoning</span>
                    <span>{message.usage.reasoningTokens.toLocaleString()}</span>
                  </div>
                )}
                {message.usage?.totalTokens !== undefined && (
                  <div className="flex justify-between border-t pt-1 font-medium">
                    <span>Total Tokens</span>
                    <span>{message.usage.totalTokens.toLocaleString()}</span>
                  </div>
                )}
                {typeof message.usage?.creditCost === "number" && message.usage.creditCost > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Credits</span>
                    <span>{message.usage.creditCost.toLocaleString()}</span>
                  </div>
                )}
                {message.metadata?.status && message.metadata.status !== "completed" && !isStreaming && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline">{message.metadata.status}</Badge>
                  </div>
                )}
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : null}
      {isStreaming ? (
        <Badge variant="outline" className="flex flex-row justify-start items-center gap-1 text-xs">
          <Spinner className="size-4 text-muted-foreground" />
          <span className="shimmer text-muted-foreground motion-reduce:shimmer-none">Generating...</span>
        </Badge>
      ) : null}
    </div>
  );
}

function EmptyConversationState({ mode }: { mode: "landing" | "thread" }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-3xl">
        <Layers className="size-6 stroke-[2.25]" />
      </div>
      <h2 className="text-xl font-semibold">
        {mode === "landing" ? "Run your first experiment" : "This thread is empty"}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
        {mode === "landing"
          ? "Pick a model, adjust reasoning, and send a prompt. Modelry will create a thread and surface tokens, cost, and behavior as the model responds."
          : "Send a message to begin this thread. Responses, chain of thought, token usage, and credit cost will appear here once the model replies."}
      </p>
    </div>
  );
}

function ThreadToolbar({
  isArchived,
  isBusy,
  mode,
  onArchive,
  onAutoRename,
  onRename,
  onRestore,
  onToggleDetails,
  thread,
  threadTitle,
}: {
  isArchived: boolean;
  isBusy: boolean;
  mode: "landing" | "thread";
  onArchive: () => void;
  onAutoRename: () => void;
  onRename: () => void;
  onRestore: () => void;
  onToggleDetails: () => void;
  thread?: { id: string } | null;
  threadTitle: string;
}) {
  return (
    <div className="border-b px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        {mode === "thread" ? (
          <div>
            <div className="flex items-center gap-2">
              <MessageCircleIcon />
              <h1 className="truncate font-semibold text-base">{threadTitle}</h1>
              {isArchived ? <Badge variant="outline">Archived</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">ID: {thread?.id}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-2xl">
              <Layers className="size-5 stroke-[2.25]" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-[0.24em]">Modelry Lab</p>
              <h1 className="font-semibold text-lg">New experiment</h1>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Dropdown menu for thread actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" type="button" variant="outline">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggleDetails()}>
                <Info className="mr-2 size-4" />
                Chat Info
              </DropdownMenuItem>
              {thread && !isArchived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRename()} disabled={isBusy}>
                    <CheckIcon className="mr-2 size-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAutoRename()} disabled={isBusy}>
                    <Sparkles className="mr-2 size-4" />
                    Auto Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive()} disabled={isBusy}>
                    <ArchiveRestore className="mr-2 size-4" />
                    Archive
                  </DropdownMenuItem>
                </>
              )}
              {thread && isArchived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRestore()} disabled={isBusy}>
                    <ArchiveRestore className="mr-2 size-4" />
                    Restore
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function getAutoTitleCandidate(messages: UIMessage[]) {
  const preferredMessage =
    messages.find((message) => message.role === "assistant" && getTextFromUiMessage(message).trim().length > 0) ??
    messages.find((message) => message.role === "user" && getTextFromUiMessage(message).trim().length > 0);

  return preferredMessage ? deriveAutoThreadTitleFromText(getTextFromUiMessage(preferredMessage)) : "Untitled chat";
}

function ChatWorkspaceInner({
  droppedAttachmentCount = 0,
  hasOlderMessages: initialHasOlderMessages = false,
  mode,
  thread,
  initialMessages = [],
  userId,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { openSettings } = useSettingsDialog();
  const utils = apiClient.useUtils();
  const draftKey = createThreadDraftKey(thread?.id ?? null, userId);
  const clientThreadId = useRef(thread?.id ?? crypto.randomUUID());
  const workspaceActiveRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const setMessagesRef = useRef<(messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void>(
    () => undefined,
  );
  const requestThreadId = resolveChatRequestThreadId(thread?.id, clientThreadId.current);
  const controller = usePromptInputController();
  const attachments = useProviderAttachments();
  const viewerQuery = apiClient.viewer.session.useQuery(undefined, { refetchOnWindowFocus: false });
  const modelsQuery = apiClient.chat.models.useQuery(undefined, { refetchOnWindowFocus: false });
  const createAsset = apiClient.assets.create.useMutation();
  const [model, setModel] = useState(thread?.model ?? "");
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ChatReasoningEffort>("low");
  const [temperaturePreset, setTemperaturePreset] = useState<ChatTemperaturePreset>("medium");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [threadTitle, setThreadTitle] = useState(thread?.title ?? "Untitled chat");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [contextLimitExceeded, setContextLimitExceeded] = useState(false);
  const failedExchangeRef = useRef<{
    body: {
      assetIds: string[];
      model: string;
      reasoningEnabled: boolean;
      reasoningEffort: ChatReasoningEffort;
      temperaturePreset: ChatTemperaturePreset;
      threadId: string;
      webSearch: boolean;
      operation?: "edit" | "regenerate";
    };
    files: FileUIPart[];
    messageId: string;
    previousMessages?: UIMessage[];
    retryPrefixMessages?: UIMessage[];
    restoreInput?: boolean;
    text: string;
  } | null>(null);
  const [assetUploads, setAssetUploads] = useState<
    Array<{ id: string; name: string; sizeBytes: number; progress: AssetUploadProgress }>
  >([]);
  const [isUploadingAssets, setIsUploadingAssets] = useState(false);
  const successfulAssetsBySource = useRef(new Map<string, { assetId: string; file: FileUIPart; sizeBytes: number }>());
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(thread?.title ?? "");
  const [hasOlderMessages, setHasOlderMessages] = useState(initialHasOlderMessages);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [olderMessagesCursor, setOlderMessagesCursor] = useState(initialMessages[0]?.id ?? "");

  const initialUiMessages = useMemo(() => mapPersistedMessagesToUiMessages(initialMessages), [initialMessages]);
  const viewer = getApiResponseData(viewerQuery.data) as ViewerSessionPayload | null;
  const allowedModels = (getApiResponseData(modelsQuery.data) ?? []) as AllowedModel[];
  const availableModels = useMemo(() => allowedModels.filter((item) => item.runtimeAvailable), [allowedModels]);
  const selectedModelData = useMemo(
    () => allowedModels.find((item) => item.id === model) ?? availableModels[0],
    [allowedModels, availableModels, model],
  );
  const isArchived = Boolean(thread?.isArchived);
  const hasNoRuntimeModels = modelsQuery.isSuccess && availableModels.length === 0;
  const webSearchSupported = selectedModelData?.provider === "google";

  useEffect(() => {
    workspaceActiveRef.current = true;
    return () => {
      workspaceActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const preferredModel =
      availableModels.find((item) => item.id === thread?.model)?.id ??
      allowedModels.find((item) => item.id === thread?.model && item.runtimeAvailable)?.id ??
      allowedModels.find((item) => item.isDefault && item.runtimeAvailable)?.id ??
      availableModels[0]?.id ??
      allowedModels[0]?.id ??
      "";

    if (preferredModel && preferredModel !== model) {
      setModel(preferredModel);
    }
  }, [allowedModels, availableModels, thread?.model]);

  const invalidateThreadLists = useCallback(
    (announce = true) => {
      if (announce) announceChatChange();
      void utils.chat.list.invalidate({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT });
      void utils.chat.list.invalidate({ archived: true, limit: CHAT_RECENT_THREADS_LIMIT });
    },
    [utils],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
      if (event.altKey && event.key.toLowerCase() === "n" && !isEditable) {
        event.preventDefault();
        router.push(getNewChatDestination());
      }
    };

    const handleCrossTabChange = (event: StorageEvent) => {
      if (event.key === "modelry:chat-sync") {
        invalidateThreadLists(false);
        if (thread?.id) void utils.chat.get.invalidate({ threadId: thread.id });
        router.refresh();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("storage", handleCrossTabChange);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("storage", handleCrossTabChange);
    };
  }, [invalidateThreadLists, router, thread?.id, utils.chat.get]);

  const { messages, sendMessage, status, stop, setMessages, regenerate } = useChat({
    id: thread?.id ?? "landing-chat",
    messages: initialUiMessages,
    onError: (nextError) => {
      const isContextLimit = nextError.message.includes("CONTEXT_WINDOW_EXCEEDED");
      setContextLimitExceeded(isContextLimit);
      const errorMessage = isContextLimit
        ? "This request exceeds the selected model’s context limit. Your text is preserved."
        : nextError.name === "TimeoutError"
          ? "This request timed out. Your message is still available to retry."
          : nextError.message || "Failed to send chat message.";
      toast.error(errorMessage);
      if (failedExchangeRef.current?.previousMessages) {
        setMessagesRef.current(failedExchangeRef.current.previousMessages);
      }
      if (
        failedExchangeRef.current?.restoreInput !== false &&
        failedExchangeRef.current?.text &&
        controller.textInput.value === ""
      ) {
        controller.textInput.setInput(failedExchangeRef.current.text);
      }
    },
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      const finalStatus = isAbort ? "cancelled" : isDisconnect || isError ? "failed" : "completed";
      setMessagesRef.current((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === message.id && currentMessage.role === "assistant"
            ? {
                ...currentMessage,
                metadata: { ...getMessageMetadata(currentMessage), status: finalStatus },
              }
            : currentMessage,
        ),
      );
      failedExchangeRef.current = null;
      setAssetUploads([]);
      invalidateThreadLists();
      void utils.viewer.session.invalidate();

      if (thread?.id && workspaceActiveRef.current) {
        void utils.chat.get.invalidate({ threadId: thread.id });
        router.refresh();
      }

      const nextThreadId = getThreadIdFromMessageMetadata(message);
      if (workspaceActiveRef.current && !thread?.id && nextThreadId) {
        clearThreadDraftSnapshot(draftKey);
        startTransition(() => {
          router.replace(PATH.CHAT.THREAD(nextThreadId));
        });
      }
    },
    transport: chatTransport,
  });

  setMessagesRef.current = setMessages;

  const runChatRequest = useCallback(async (request: () => Promise<void>) => {
    if (requestInFlightRef.current) return;
    setContextLimitExceeded(false);
    requestInFlightRef.current = true;
    try {
      await request();
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  const sendChatExchange = useCallback(
    async (exchange: NonNullable<typeof failedExchangeRef.current>) => {
      failedExchangeRef.current = exchange;
      const message: UIMessage = {
        id: exchange.messageId,
        role: "user",
        parts: [
          ...(exchange.text ? [{ type: "text" as const, text: exchange.text }] : []),
          ...exchange.files,
        ],
      };
      await runChatRequest(() => sendMessage(message, { body: exchange.body }));
    },
    [runChatRequest, sendMessage],
  );

  const loadEarlierMessages = useCallback(async () => {
    if (!thread?.id || !hasOlderMessages || !olderMessagesCursor || isLoadingOlderMessages) return;

    setIsLoadingOlderMessages(true);
    try {
      const response = await utils.chat.olderMessages.fetch({
        beforeMessageId: olderMessagesCursor,
        limit: 50,
        threadId: thread.id,
      });
      const page = getApiResponseData(response) as {
        hasOlderMessages: boolean;
        messages: PersistedChatMessage[];
      } | null;
      if (!page) throw new Error(getApiResponseMessage(response, "Could not load earlier messages."));

      const olderMessages = mapPersistedMessagesToUiMessages(page.messages);
      setMessages((currentMessages) => {
        const currentIds = new Set(currentMessages.map((message) => message.id));
        return [...olderMessages.filter((message) => !currentIds.has(message.id)), ...currentMessages];
      });
      setHasOlderMessages(page.hasOlderMessages);
      setOlderMessagesCursor(page.messages[0]?.id ?? "");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load earlier messages."));
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    hasOlderMessages,
    isLoadingOlderMessages,
    olderMessagesCursor,
    setMessages,
    thread?.id,
    utils.chat.olderMessages,
  ]);

  const retryFailedExchange = useCallback(async () => {
    const exchange = failedExchangeRef.current;
    if (!exchange) return;

    if (exchange.retryPrefixMessages) {
      setMessages(exchange.retryPrefixMessages);
    }
    const retryRequest = createRetryChatRequest(exchange);
    await runChatRequest(() => sendMessage(retryRequest.message, { body: retryRequest.body }));
  }, [runChatRequest, sendMessage, setMessages]);

  const startEditingMessage = useCallback((message: UIMessage) => {
    setEditingMessageId(message.id);
    setEditMessageText(getTextFromUiMessage(message));
  }, []);

  const saveEditedMessage = useCallback(async () => {
    const messageIndex = messages.findIndex((message) => message.id === editingMessageId && message.role === "user");
    const target = messages[messageIndex];
    const editedText = editMessageText.trim();

    if (!target || !editedText || status === "submitted" || status === "streaming") return;

    const editedMessage: UIMessage = {
      ...target,
      parts: [{ type: "text", text: editedText }, ...target.parts.filter((part) => part.type === "file")],
    };
    const exchange = {
      body: {
        assetIds: getAssetIdsFromMessage(target),
        model,
        operation: "edit" as const,
        reasoningEnabled,
        reasoningEffort,
        temperaturePreset,
        threadId: requestThreadId,
        webSearch: useWebSearch,
      },
      files: target.parts.filter((part) => part.type === "file") as FileUIPart[],
      messageId: editedMessage.id,
      previousMessages: messages,
      retryPrefixMessages: messages.slice(0, messageIndex),
      text: editedText,
    };
    failedExchangeRef.current = exchange;
    setMessages(messages.slice(0, messageIndex));
    setEditingMessageId(null);
    setEditMessageText("");
    await runChatRequest(() => sendMessage(editedMessage, { body: exchange.body }));
  }, [
    editMessageText,
    editingMessageId,
    messages,
    model,
    reasoningEnabled,
    reasoningEffort,
    temperaturePreset,
    requestThreadId,
    runChatRequest,
    sendMessage,
    setMessages,
    status,
    useWebSearch,
  ]);

  const regenerateLastAnswer = useCallback(async () => {
    if (!thread?.id || status === "submitted" || status === "streaming") return;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) return;
    const lastUserIndex = messages.findIndex((message) => message.id === lastUserMessage.id);
    failedExchangeRef.current = {
      body: {
        assetIds: getAssetIdsFromMessage(lastUserMessage),
        model,
        operation: "regenerate",
        reasoningEnabled,
        reasoningEffort,
        temperaturePreset,
        threadId: requestThreadId,
        webSearch: useWebSearch,
      },
      files: lastUserMessage.parts.filter((part) => part.type === "file") as FileUIPart[],
      messageId: lastUserMessage.id,
      previousMessages: messages,
      retryPrefixMessages: messages.slice(0, lastUserIndex + 1),
      restoreInput: false,
      text: getTextFromUiMessage(lastUserMessage),
    };
    await runChatRequest(() =>
      regenerate({
        body: {
          assetIds: getAssetIdsFromMessage(lastUserMessage),
          model,
          operation: "regenerate",
          reasoningEnabled,
          reasoningEffort,
          temperaturePreset,
          threadId: requestThreadId,
          webSearch: useWebSearch,
        },
      }),
    );
  }, [
    messages,
    model,
    reasoningEnabled,
    reasoningEffort,
    temperaturePreset,
    regenerate,
    requestThreadId,
    runChatRequest,
    status,
    thread?.id,
    useWebSearch,
  ]);

  const renderedMessages = useMemo(() => mapUiMessagesToWorkspaceMessages(messages), [messages]);
  const latestAssistantMetadata = [...messages].reverse().find((message) => message.role === "assistant")?.metadata as
    | { completionTokens?: number; promptTokens?: number; reasoningTokens?: number }
    | undefined;
  const measuredPromptTokens = Number(latestAssistantMetadata?.promptTokens ?? 0);
  const measuredCompletionTokens = Number(latestAssistantMetadata?.completionTokens ?? 0);
  const draftTokenEstimate = Math.ceil(controller.textInput.value.length / 4) + attachments.files.length * 1000;
  const reasoningSupported = selectedModelData?.supportsReasoning ?? false;
  const reasoningEffortSupported = selectedModelData?.provider === "google";

  useEffect(() => {
    if (!reasoningSupported && reasoningEnabled) {
      setReasoningEnabled(false);
    }
  }, [reasoningEnabled, reasoningSupported]);

  useEffect(() => {
    if (!webSearchSupported && useWebSearch) {
      setUseWebSearch(false);
    }
  }, [useWebSearch, webSearchSupported]);

  const renameThread = apiClient.chat.rename.useMutation({
    onError: (mutationError) => {
      toast.error(getApiErrorMessage(mutationError, "Failed to rename thread."));
    },
    onSuccess: (response) => {
      const nextThread = getApiResponseData(response);
      if (nextThread) {
        setThreadTitle(nextThread.title);
      }
      toast.success(getApiResponseMessage(response, "Thread renamed."));
    },
    onSettled: () => {
      invalidateThreadLists();
      if (thread?.id) {
        void utils.chat.get.invalidate({ threadId: thread.id });
      }
    },
  });

  const archiveThread = apiClient.chat.archive.useMutation({
    onError: (mutationError) => {
      toast.error(getApiErrorMessage(mutationError, "Failed to archive thread."));
    },
    onSuccess: (response) => {
      toast.success(getApiResponseMessage(response, "Thread archived."));
      startTransition(() => {
        router.push(PATH.CHAT.ROOT);
      });
    },
    onSettled: () => invalidateThreadLists(),
  });

  const restoreThread = apiClient.chat.restore.useMutation({
    onError: (mutationError) => {
      toast.error(getApiErrorMessage(mutationError, "Failed to restore thread."));
    },
    onSuccess: (response) => {
      const nextThread = getApiResponseData(response);
      if (nextThread) {
        setThreadTitle(nextThread.title);
      }
      toast.success(getApiResponseMessage(response, "Thread restored."));
      if (thread?.id) {
        void utils.chat.get.invalidate({ threadId: thread.id });
      }
      router.refresh();
    },
    onSettled: () => invalidateThreadLists(),
  });

  useEffect(() => {
    setThreadTitle(thread?.title ?? "Untitled chat");
  }, [thread?.title]);

  const mutateThreadTitle = useCallback(
    async (nextTitle: string) => {
      if (!thread?.id) {
        return;
      }

      const trimmedTitle = nextTitle.trim();
      if (!trimmedTitle || trimmedTitle === threadTitle) {
        return;
      }

      const previousTitle = threadTitle;
      setThreadTitle(trimmedTitle);

      try {
        await renameThread.mutateAsync({ threadId: thread.id, title: trimmedTitle });
      } catch {
        setThreadTitle(previousTitle);
      }
    },
    [renameThread, thread?.id, threadTitle],
  );

  const handleSuggestionClick = useCallback(
    async (suggestion: string) => {
      if (isArchived) {
        toast.error("This thread is archived. Restore it before sending a new message.");
        return;
      }

      if (!model) {
        toast.error("Select an available model before sending a message.");
        return;
      }

      const message = { text: suggestion, files: [] as FileUIPart[] };

      if (status === "submitted" || status === "streaming") {
        return;
      }

      await sendChatExchange({
        body: {
          assetIds: [],
          model,
          reasoningEnabled,
          reasoningEffort,
          temperaturePreset,
          threadId: requestThreadId,
          webSearch: useWebSearch,
        },
        files: [],
        messageId: crypto.randomUUID(),
        text: message.text,
      });
    },
    [
      isArchived,
      status,
      model,
      reasoningEnabled,
      reasoningEffort,
      temperaturePreset,
      sendChatExchange,
      requestThreadId,
    ],
  );

  const handleRename = useCallback(async () => {
    if (!thread?.id) {
      return;
    }

    const trimmedTitle = renameTitle.trim();
    if (!trimmedTitle || trimmedTitle === threadTitle) {
      setRenameDialogOpen(false);
      return;
    }

    const previousTitle = threadTitle;
    setThreadTitle(trimmedTitle);
    setRenameDialogOpen(false);

    try {
      await renameThread.mutateAsync({ threadId: thread.id, title: trimmedTitle });
    } catch {
      setThreadTitle(previousTitle);
    }
  }, [renameTitle, thread?.id, threadTitle, renameThread]);

  // Open rename dialog with current title
  const openRenameDialog = useCallback(() => {
    setRenameTitle(threadTitle);
    setRenameDialogOpen(true);
  }, [threadTitle]);

  const handleAutoRename = useCallback(async () => {
    if (!thread?.id) {
      return;
    }

    const nextTitle = getAutoTitleCandidate(messages);
    if (!nextTitle || nextTitle === "Untitled chat") {
      toast.error("There is not enough chat content yet to generate a better title.");
      return;
    }

    await mutateThreadTitle(nextTitle);
  }, [messages, mutateThreadTitle, thread?.id]);

  const handleArchive = useCallback(async () => {
    if (!thread?.id) {
      return;
    }

    setArchiveDialogOpen(false);
    await archiveThread.mutateAsync({ threadId: thread.id });
  }, [archiveThread, thread?.id]);

  const handleRestore = useCallback(async () => {
    if (!thread?.id) {
      return;
    }

    setRestoreDialogOpen(false);
    await restoreThread.mutateAsync({ threadId: thread.id });
  }, [restoreThread, thread?.id]);

  const handleTranscriptionChange = useCallback(
    (transcript: string) => {
      const currentText = controller.textInput.value.trim();
      controller.textInput.setInput(currentText ? `${currentText} ${transcript}` : transcript);
    },
    [controller.textInput],
  );

  const uploadAndSend = useCallback(
    async (message: PromptInputMessage) => {
      const clearSubmittedDraft = () => {
        if (controller.textInput.value === message.text) {
          controller.textInput.setInput("");
        }

        const submittedFileCounts = new Map<string, number>();
        for (const file of message.files) {
          const key = `${file.filename ?? ""}\n${file.mediaType ?? ""}`;
          submittedFileCounts.set(key, (submittedFileCounts.get(key) ?? 0) + 1);
        }

        for (const attachment of attachments.files) {
          const key = `${attachment.filename ?? ""}\n${attachment.mediaType ?? ""}`;
          const remaining = submittedFileCounts.get(key) ?? 0;
          if (remaining > 0) {
            attachments.remove(attachment.id);
            submittedFileCounts.set(key, remaining - 1);
          }
        }
      };

      if (!message.files.length) {
        const text = message.text.trim() ? message.text.trim() : "";
        const exchange = {
          body: {
            assetIds: [],
            model,
            reasoningEnabled,
            reasoningEffort,
            temperaturePreset,
            threadId: requestThreadId,
            webSearch: useWebSearch,
          },
          files: [] as FileUIPart[],
          messageId: crypto.randomUUID(),
          text,
        };
        const request = sendChatExchange(exchange);
        clearSubmittedDraft();
        await request;
        return;
      }

      if (message.files.length > 5) {
        toast.error("Upload up to 5 files in one chat message.");
        return;
      }

      setIsUploadingAssets(true);
      const rows = message.files.map((file, index) => ({
        id: `${Date.now()}-${index}-${crypto.randomUUID()}`,
        name: file.filename || `Document ${index + 1}`,
        sizeBytes: 0,
        progress: { stage: "uploading" as const, progress: 0, message: "Starting secure upload" },
      }));
      setAssetUploads(rows);
      const uploadedFiles: Array<{ assetId: string; file: FileUIPart; sizeBytes: number }> = [];

      try {
        for (const [index, source] of message.files.entries()) {
          const row = rows[index]!;
          const sourceKey = `${source.url}\n${source.filename ?? ""}\n${source.mediaType ?? ""}`;
          const existingUpload = successfulAssetsBySource.current.get(sourceKey);
          if (existingUpload) {
            uploadedFiles.push(existingUpload);
            setAssetUploads((current) =>
              current.map((item) =>
                item.id === row.id
                  ? {
                      ...item,
                      sizeBytes: existingUpload.sizeBytes,
                      progress: { stage: "ready", progress: 100, message: "Ready to use in chat" },
                    }
                  : item,
              ),
            );
            continue;
          }
          const blob = await fetch(source.url).then((response) => response.blob());
          const file = new File([blob], source.filename || row.name, { type: source.mediaType || blob.type });
          setAssetUploads((current) =>
            current.map((item) => (item.id === row.id ? { ...item, sizeBytes: file.size } : item)),
          );
          const result = await uploadAndProcessAsset({
            file,
            userId: viewer?.user?.id ?? "",
            maxSizeBytes: 10 * 1024 * 1024,
            createAsset: (input) => createAsset.mutateAsync(input),
            onProgress: (progress) =>
              setAssetUploads((current) => current.map((item) => (item.id === row.id ? { ...item, progress } : item))),
          });
          const upload = {
            assetId: result.assetId,
            sizeBytes: file.size,
            file: {
              type: "file" as const,
              url: `/api/assets/${result.assetId}/download`,
              filename: file.name,
              mediaType: file.type,
            },
          };
          uploadedFiles.push(upload);
          successfulAssetsBySource.current.set(sourceKey, upload);
        }

        const text =
          message.text.trim() ||
          "Please briefly summarize each uploaded document and call out its main topics and useful details.";
        const exchange = {
          body: {
            assetIds: uploadedFiles.map((item) => item.assetId),
            model,
            reasoningEnabled,
            reasoningEffort,
            temperaturePreset,
            threadId: requestThreadId,
            webSearch: useWebSearch,
          },
          files: uploadedFiles.map((item) => item.file),
          messageId: crypto.randomUUID(),
          text,
        };
        const request = sendChatExchange(exchange);
        clearSubmittedDraft();
        setIsUploadingAssets(false);
        await request;
        successfulAssetsBySource.current.clear();
        void utils.assets.list.invalidate();
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Upload or document analysis failed.";
        setAssetUploads((current) =>
          current.map((item) => {
            if (item.progress.stage === "ready") return item;
            return {
              ...item,
              progress: { ...item.progress, stage: "failed", message: "Upload or analysis failed", error: messageText },
            };
          }),
        );
        toast.error(messageText);
      } finally {
        setIsUploadingAssets(false);
      }
    },
    [
      attachments,
      controller.textInput,
      createAsset,
      model,
      reasoningEnabled,
      reasoningEffort,
      temperaturePreset,
      requestThreadId,
      sendChatExchange,
      useWebSearch,
      utils.assets.list,
    ],
  );

  const handleSend = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() && message.files.length === 0) return;
      if (isArchived) {
        toast.error("This thread is archived. Restore it before sending a new message.");
        return;
      }
      if (!model) {
        toast.error("Select an available model before sending a message.");
        return;
      }
      if (isUploadingAssets) return;
      if (requestInFlightRef.current || status === "submitted" || status === "streaming") {
        return;
      }
      await uploadAndSend(message);
    },
    [attachments, controller.textInput, isArchived, isUploadingAssets, model, requestInFlightRef, status, uploadAndSend],
  );

  const isSubmitting = status === "submitted" || status === "streaming";
  const isBusy = renameThread.isPending || archiveThread.isPending || restoreThread.isPending;
  const isSubmitDisabled =
    (!controller.textInput.value.trim() && attachments.files.length === 0) ||
    !model ||
    hasNoRuntimeModels ||
    isArchived ||
    isUploadingAssets;
  const activePlan = viewer?.billing?.currentPlan?.name ?? "Free";
  const balanceCredits = viewer?.wallet?.balanceCredits ?? 0;
  const isLowBalance = balanceCredits <= 0 || balanceCredits < 1000;

  return (
    <Shell>
      <Shell.Section
        className={cn(
          "grid size-full min-w-0 w-full max-w-none grid-cols-1 overflow-hidden px-0",
          !isMobile && detailsOpen
            ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]"
            : "xl:grid-cols-[minmax(0,1fr)_0px]",
        )}
      >
        <div className="flex min-w-0 flex-col overflow-hidden">
          <DraftSync draftKey={draftKey} droppedAttachmentCount={droppedAttachmentCount} />
          <ThreadToolbar
            isArchived={isArchived}
            isBusy={isBusy}
            mode={mode}
            onArchive={() => setArchiveDialogOpen(true)}
            onAutoRename={() => void handleAutoRename()}
            onRename={() => openRenameDialog()}
            onRestore={() => setRestoreDialogOpen(true)}
            onToggleDetails={() => setDetailsOpen((current) => !current)}
            thread={thread ? { id: thread.id } : null}
            threadTitle={threadTitle}
          />
          {isArchived ? (
            <div className="border-b px-4 py-3 sm:px-5">
              <Alert>
                <ArchiveRestore className="size-4" />
                <AlertTitle>This thread is archived</AlertTitle>
                <AlertDescription>
                  You can read the conversation, but sending is disabled until the thread is restored.
                </AlertDescription>
                <Button
                  className="mt-3"
                  disabled={isBusy}
                  onClick={() => setRestoreDialogOpen(true)}
                  size="sm"
                  type="button"
                >
                  <ArchiveRestore className="size-4" />
                  Restore thread
                </Button>
              </Alert>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col divide-y overflow-hidden">
            <Conversation>
              <ConversationScrollRestoration threadId={thread?.id ?? null} />
              <ConversationContent>
                {hasOlderMessages ? (
                  <div className="flex justify-center pb-2">
                    <Button
                      disabled={isLoadingOlderMessages || isSubmitting}
                      onClick={() => void loadEarlierMessages()}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {isLoadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}
                    </Button>
                  </div>
                ) : null}
                {renderedMessages.length === 0 ? (
                  <MessageScroller.Item
                    className="flex min-h-[40vh] flex-1 items-center"
                    messageId="empty"
                    scrollAnchor
                  >
                    <EmptyConversationState mode={mode} />
                  </MessageScroller.Item>
                ) : (
                  renderedMessages.map((message) => {
                    const isReasoningStreaming = message.metadata?.status === "streaming";
                    const sourceMessage = messages.find((item) => item.id === message.key);
                    const isLastAssistant =
                      message.from === "assistant" && renderedMessages.at(-1)?.key === message.key;

                    return (
                      <MessageScroller.Item
                        key={message.key}
                        messageId={message.key}
                        scrollAnchor={message.from === "user"}
                      >
                        <MessageFrame align={message.from === "user" ? "end" : "start"}>
                          <MessageFrameContent className="gap-2 text-sm">
                            {message.reasoning ? (
                              <ChatReasoningTrace
                                content={message.reasoning.content}
                                isStreaming={isReasoningStreaming}
                              />
                            ) : null}
                            {message.sources?.length ? <ChatSourcesTrace sources={message.sources} /> : null}
                            {message.from === "user" && message.attachments?.length ? (
                              <div className="flex max-w-[min(80%,32rem)] flex-wrap justify-end gap-2 self-end">
                                {message.attachments.map((attachment) => (
                                  <Attachment key={attachment.id} size="sm" state="done">
                                    <AttachmentMedia>
                                      <AssetFileIcon name={attachment.name} />
                                    </AttachmentMedia>
                                    <AttachmentContent>
                                      <a href={attachment.url} rel="noreferrer" target="_blank">
                                        <AttachmentTitle>{attachment.name}</AttachmentTitle>
                                        <span className="sr-only"> (opens in a new tab)</span>
                                      </a>
                                      <AttachmentDescription>{attachment.mimeType}</AttachmentDescription>
                                    </AttachmentContent>
                                  </Attachment>
                                ))}
                              </div>
                            ) : null}
                            {editingMessageId === message.key ? (
                              <div className="grid gap-2">
                                <Textarea
                                  aria-label="Edit your message"
                                  autoFocus
                                  onChange={(event) => setEditMessageText(event.target.value)}
                                  onKeyDown={(event) => {
                                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                      event.preventDefault();
                                      void saveEditedMessage();
                                    }
                                  }}
                                  value={editMessageText}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    disabled={!editMessageText.trim() || isSubmitting}
                                    onClick={() => void saveEditedMessage()}
                                    size="sm"
                                    type="button"
                                  >
                                    <CheckIcon data-icon="inline-start" />
                                    Save and resend
                                  </Button>
                                  <Button
                                    onClick={() => setEditingMessageId(null)}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : message.from === "user" ? (
                              <Bubble align="end" variant="muted">
                                <BubbleContent className="whitespace-pre-wrap px-3 py-2 text-sm">
                                  {message.content}
                                </BubbleContent>
                              </Bubble>
                            ) : (
                              <MessageResponse className="max-w-full overflow-x-auto">
                                {message.content}
                              </MessageResponse>
                            )}
                            {message.toolParts?.length ? <ChatToolTrace parts={message.toolParts} /> : null}
                            {message.from === "assistant" ? <MessageUsage message={message} /> : null}
                            <MessageFrameFooter className="justify-between gap-3 px-0 text-xs">
                              <time className="text-muted-foreground" dateTime={message.createdAt?.toISOString()}>
                                {message.createdAt ? formatMessageTimestamp(message.createdAt) : null}
                              </time>
                              <MessageActions>
                                <MessageAction
                                  label="Copy message"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(message.content).then(
                                      () => toast.success("Message copied."),
                                      () => toast.error("Could not copy this message."),
                                    );
                                  }}
                                  tooltip="Copy message"
                                >
                                  <CopyIcon />
                                </MessageAction>
                                {message.from === "user" && sourceMessage ? (
                                  <MessageAction
                                    disabled={isSubmitting || isArchived || !thread?.id}
                                    label="Edit and resend message"
                                    onClick={() => startEditingMessage(sourceMessage)}
                                    tooltip="Edit and resend"
                                  >
                                    <PencilIcon />
                                  </MessageAction>
                                ) : null}
                                {isLastAssistant ? (
                                  <MessageAction
                                    disabled={isSubmitting || isArchived}
                                    label="Regenerate response"
                                    onClick={() => void regenerateLastAnswer()}
                                    tooltip="Regenerate response"
                                  >
                                    <RotateCwIcon />
                                  </MessageAction>
                                ) : null}
                              </MessageActions>
                            </MessageFrameFooter>
                          </MessageFrameContent>
                        </MessageFrame>
                      </MessageScroller.Item>
                    );
                  })
                )}
                {assetUploads.length ? (
                  <MessageScroller.Item messageId="asset-upload-progress">
                    <div
                      className="mx-auto mb-4 grid w-full max-w-3xl gap-2 px-4"
                      role="region"
                      aria-label="Document upload progress"
                    >
                      {assetUploads.map((item) => (
                        <AssetUploadSteps
                          key={item.id}
                          name={item.name}
                          sizeBytes={item.sizeBytes}
                          progress={item.progress}
                        />
                      ))}
                    </div>
                  </MessageScroller.Item>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="grid min-w-0 max-w-full shrink-0 gap-4 pt-4">
              {/* Show suggestions only when no messages and not archived */}
              {renderedMessages.length === 0 && !isArchived ? (
                <div className="min-w-0 max-w-full overflow-hidden px-4 pb-2">
                  <p className="text-muted-foreground mb-2 text-xs">Try asking:</p>
                  <Suggestions>
                    {chatSuggestions.map((suggestion) => (
                      <Suggestion
                        key={suggestion}
                        onClick={() => void handleSuggestionClick(suggestion)}
                        suggestion={suggestion}
                      />
                    ))}
                  </Suggestions>
                </div>
              ) : null}
              {modelsQuery.isError ? (
                <div className="px-4">
                  <Alert>
                    <AlertTitle>Failed to load chat models</AlertTitle>
                    <AlertDescription>
                      {getApiErrorMessage(modelsQuery.error, "Could not load the allowed model list.")}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
              <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-2 pb-[env(safe-area-inset-bottom)]">
                {droppedAttachmentCount > attachments.files.length ? (
                  <Alert className="mb-2">
                    <AlertTitle>Reattach your files</AlertTitle>
                    <AlertDescription>
                      Your draft text was restored, but browser storage does not keep file contents. Reattach{" "}
                      {droppedAttachmentCount - attachments.files.length} file
                      {droppedAttachmentCount - attachments.files.length === 1 ? "" : "s"} to include them.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {contextLimitExceeded ? (
                  <Alert className="mb-2" variant="destructive">
                    <AlertTitle>Context limit reached</AlertTitle>
                    <AlertDescription>
                      Your message is preserved. Shorten the prompt, remove attachments, or select a model with a larger
                      context window, then send again.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {status === "error" && failedExchangeRef.current && !contextLimitExceeded ? (
                  <Alert className="mb-2" variant="destructive">
                    <AlertTitle>
                      {failedExchangeRef.current.body.operation === "regenerate"
                        ? "Response wasn’t regenerated"
                        : failedExchangeRef.current.body.operation === "edit"
                          ? "Edit wasn’t sent"
                          : "Message wasn’t sent"}
                    </AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {failedExchangeRef.current.body.operation === "regenerate"
                          ? "The earlier response is preserved. You can retry regeneration."
                          : failedExchangeRef.current.body.operation === "edit"
                            ? "Your original conversation is preserved. Retry the edited message."
                            : "Your message and attached files are ready to retry."}
                      </span>
                      <Button onClick={() => void retryFailedExchange()} size="sm" type="button" variant="outline">
                        Retry message
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <ChatComposer
                  accept={CHAT_FILE_ACCEPT}
                  allowedModels={allowedModels}
                  draftTokenEstimate={draftTokenEstimate}
                  isArchived={isArchived}
                  isMobile={isMobile}
                  isSubmitting={isSubmitting}
                  isSubmitDisabled={isSubmitDisabled}
                  isUploadingAssets={isUploadingAssets}
                  measuredCompletionTokens={measuredCompletionTokens}
                  measuredPromptTokens={measuredPromptTokens}
                  measuredReasoningTokens={Number(latestAssistantMetadata?.reasoningTokens ?? 0)}
                  mode={mode}
                  model={model}
                  onError={(error) => toast.error(error.message)}
                  onModelChange={setModel}
                  onReasoningEffortChange={setReasoningEffort}
                  onReasoningEnabledChange={setReasoningEnabled}
                  onStop={stop}
                  onSubmit={handleSend}
                  onTemperatureChange={setTemperaturePreset}
                  onTranscriptionChange={handleTranscriptionChange}
                  onWebSearchChange={setUseWebSearch}
                  reasoningEffort={reasoningEffort}
                  reasoningEffortSupported={reasoningEffortSupported}
                  reasoningEnabled={reasoningEnabled}
                  reasoningSupported={reasoningSupported}
                  selectedModel={selectedModelData}
                  status={status}
                  temperaturePreset={temperaturePreset}
                  useWebSearch={useWebSearch}
                  webSearchSupported={webSearchSupported}
                />
              </div>
            </div>
          </div>
        </div>
        <ChatMetaRail
          activePlan={activePlan}
          availableModelsCount={availableModels.length}
          balanceCredits={balanceCredits}
          hasNoRuntimeModels={hasNoRuntimeModels}
          isArchived={isArchived}
          isBusy={isBusy}
          isLowBalance={isLowBalance}
          messages={messages}
          mode={mode}
          onArchive={() => setArchiveDialogOpen(true)}
          onAutoRename={() => void handleAutoRename()}
          onManageBilling={() => openSettings("subscription")}
          onOpenChange={setDetailsOpen}
          onRename={() => openRenameDialog()}
          onRestore={() => setRestoreDialogOpen(true)}
          open={detailsOpen}
          selectedModel={selectedModelData}
          thread={thread ? { id: thread.id } : null}
        />
      </Shell.Section>

      {/* Rename Dialog */}
      <Dialog onOpenChange={setRenameDialogOpen} open={renameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>Enter a new name for this chat thread.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Chat name</Label>
              <Input
                id="name"
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleRename();
                  }
                }}
                placeholder="Enter chat name..."
                value={renameTitle}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRenameDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!renameTitle.trim() || renameTitle.trim() === threadTitle}
              onClick={() => void handleRename()}
              type="button"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog onOpenChange={setArchiveDialogOpen} open={archiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This chat thread will be archived and disappear from recent chats. You can restore it later from the
              archived section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={() => void handleArchive()}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog onOpenChange={setRestoreDialogOpen} open={restoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This archived chat thread will be restored to your recent chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={() => void handleRestore()}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

export function ChatWorkspace({
  hasOlderMessages = false,
  mode,
  thread = null,
  initialMessages = [],
  userId,
}: ChatWorkspaceProps) {
  const draftKey = createThreadDraftKey(thread?.id ?? null, userId);
  const initialDraft = getThreadDraftSnapshot(draftKey) ?? { attachments: [], text: "" };
  const workspaceKey = createChatWorkspaceKey(thread?.id ?? null, Boolean(thread?.isArchived));

  return (
    <PromptInputProvider
      initialAttachments={initialDraft.attachments}
      initialInput={initialDraft.text}
      key={`${workspaceKey}:${userId}`}
    >
      <ChatWorkspaceInner
        droppedAttachmentCount={initialDraft.droppedAttachmentCount}
        hasOlderMessages={hasOlderMessages}
        initialMessages={initialMessages}
        mode={mode}
        thread={thread}
        userId={userId}
      />
    </PromptInputProvider>
  );
}
