"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import {
  ArchiveRestore,
  BrainIcon,
  CheckIcon,
  GlobeIcon,
  Info,
  InfoIcon,
  Layers,
  MessageCircleIcon,
  MoreHorizontal,
  Sparkles,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  apiClient,
  getApiErrorMessage,
  getApiResponseData,
  getApiResponseMessage,
  type RouterOutputs,
  type UnwrapApiData,
} from "@/core/api/api.client";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/shared/components/ai-elements/attachments";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/shared/components/ai-elements/chain-of-thought";
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/shared/components/ai-elements/context";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/shared/components/ai-elements/conversation";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/shared/components/ai-elements/inline-citation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/shared/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/shared/components/ai-elements/model-selector";
import type { PromptInputMessage } from "@/shared/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  useProviderAttachments,
} from "@/shared/components/ai-elements/prompt-input";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/shared/components/ai-elements/queue";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/shared/components/ai-elements/reasoning";
import { Shimmer } from "@/shared/components/ai-elements/shimmer";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/shared/components/ai-elements/sources";
import { SpeechInput } from "@/shared/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/shared/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/shared/components/ai-elements/tool";
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
import { Badge } from "@/shared/components/ui/badge";
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
import { Spinner } from "@/shared/components/ui/spinner";
import { Toggle } from "@/shared/components/ui/toggle";
import { PATH } from "@/shared/config/routes";
import { useIsMobile } from "@/shared/utils/hooks/use-mobile";
import { cn } from "@/shared/utils/lib/utils";
import { CHAT_RECENT_THREADS_LIMIT, type ChatWorkspaceMessage, chatSuggestions } from "./chat.data";
import { ChatMetaRail, ChatMetaRailToggle } from "./chat.meta-rail";
import {
  CHAT_REASONING_LEVELS,
  type ChatReasoningLevel,
  deriveAutoThreadTitleFromText,
  formatReasoningLevelLabel,
} from "./chat.runtime";
import {
  getMessageMetadata,
  getReasoningFromUiMessage,
  getTextFromUiMessage,
  getThreadIdFromMessageMetadata,
  mapPersistedMessagesToUiMessages,
  type PersistedChatMessage,
} from "./chat-message.utils";
import {
  clearThreadDraftSnapshot,
  createThreadDraftKey,
  type DraftAttachmentSnapshot,
  getThreadDraftSnapshot,
  saveThreadDraftSnapshot,
} from "./thread-draft-store";

const chatTransport = new DefaultChatTransport({
  api: "/api/ai/chat",
});

type AllowedModel = UnwrapApiData<RouterOutputs["chat"]["models"]>[number];
type ViewerSessionPayload = UnwrapApiData<RouterOutputs["viewer"]["session"]>;

type ChatWorkspaceThread = {
  id: string;
  isArchived?: boolean;
  lastMessageAt: Date;
  model?: string | null;
  title: string;
  titleSource?: "auto" | "manual";
};

type ChatWorkspaceProps = {
  initialMessages?: PersistedChatMessage[];
  mode: "landing" | "thread";
  thread?: ChatWorkspaceThread | null;
};

function mapUiMessagesToWorkspaceMessages(messages: UIMessage[]): ChatWorkspaceMessage[] {
  return messages.map((message) => {
    const metadata = getMessageMetadata(message);
    const textContent = getTextFromUiMessage(message);
    const reasoning = getReasoningFromUiMessage(message);

    return {
      from: message.role === "user" ? "user" : "assistant",
      key: message.id,
      metadata: {
        model: metadata.model,
        provider: metadata.provider,
        status: metadata.status,
      },
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
      versions: [
        {
          content: textContent,
          id: message.id,
        },
      ],
    } satisfies ChatWorkspaceMessage;
  });
}

async function convertUrlToDraftUrl(url: string) {
  if (!url.startsWith("blob:")) {
    return url;
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function serializeDraftAttachments(files: (FileUIPart & { id: string })[]): Promise<DraftAttachmentSnapshot[]> {
  return Promise.all(
    files.map(async (file) => ({
      filename: file.filename ?? "attachment",
      id: file.id,
      mediaType: file.mediaType,
      type: "file" as const,
      url: await convertUrlToDraftUrl(file.url),
    })),
  );
}

function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: FileUIPart & { id: string };
  onRemove: (id: string) => void;
}) {
  return (
    <Attachment data={attachment} onRemove={() => onRemove(attachment.id)}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
}

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment: FileUIPart & { id: string }) => (
        <AttachmentItem attachment={attachment} key={attachment.id} onRemove={attachments.remove} />
      ))}
    </Attachments>
  );
}

function DraftSync({ draftKey }: { draftKey: string }) {
  const controller = usePromptInputController();
  const attachments = useProviderAttachments();
  const deferredText = useDeferredValue(controller.textInput.value);

  useEffect(() => {
    let cancelled = false;

    const persistDraft = async () => {
      const serializedAttachments = await serializeDraftAttachments(attachments.files);

      if (cancelled) {
        return;
      }

      if (!deferredText.trim() && serializedAttachments.length === 0) {
        clearThreadDraftSnapshot(draftKey);
        return;
      }

      saveThreadDraftSnapshot(draftKey, {
        attachments: serializedAttachments,
        text: controller.textInput.value,
      });
    };

    void persistDraft();

    return () => {
      cancelled = true;
    };
  }, [attachments.files, controller.textInput.value, deferredText, draftKey]);

  return null;
}

function ModelPicker({
  model,
  models,
  onChange,
}: {
  model: string;
  models: AllowedModel[];
  onChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const groupedModels = useMemo(
    () => ({
      Available: models.filter((item) => item.runtimeAvailable),
      Unavailable: models.filter((item) => !item.runtimeAvailable),
    }),
    [models],
  );
  const selectedModelData = useMemo(() => models.find((item) => item.id === model) ?? models[0], [model, models]);

  if (!selectedModelData) {
    return (
      <PromptInputButton disabled>
        <span>No model</span>
      </PromptInputButton>
    );
  }

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <PromptInputButton variant="secondary">
          <ModelSelectorLogo provider={selectedModelData.provider} />
          <ModelSelectorName>{selectedModelData.displayName}</ModelSelectorName>
          {!selectedModelData.runtimeAvailable ? <Badge variant="outline">Offline</Badge> : null}
        </PromptInputButton>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {Object.entries(groupedModels).map(([group, items]) =>
            items.length > 0 ? (
              <ModelSelectorGroup heading={group} key={group}>
                {items.map((item) => (
                  <ModelSelectorItem
                    disabled={!item.runtimeAvailable}
                    key={item.id}
                    onSelect={() => {
                      if (!item.runtimeAvailable) {
                        return;
                      }
                      onChange(item.id);
                      setOpen(false);
                    }}
                    value={item.id}
                  >
                    <ModelSelectorLogo provider={item.provider} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <ModelSelectorName>{item.displayName}</ModelSelectorName>
                      <span className="text-muted-foreground truncate text-[11px]">{item.description}</span>
                    </div>
                    <ModelSelectorLogoGroup>
                      <Badge variant="outline">{item.provider}</Badge>
                      <Badge variant="outline">{item.planCode}</Badge>
                      <Badge variant="secondary">x{(item.creditMultiplierBps / 10000).toFixed(2)}</Badge>
                    </ModelSelectorLogoGroup>
                    {model === item.id ? <CheckIcon className="ml-auto size-4" /> : <div className="ml-auto size-4" />}
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            ) : null,
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

function MessageUsage({ message }: { message: Omit<ChatWorkspaceMessage, "versions"> }) {
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
          <Shimmer duration={1.5}>Generating...</Shimmer>
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
  detailsOpen,
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
  detailsOpen: boolean;
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
          {/* Sidebar rail trigger - commented out for future use (chat summary) */}
          {/* <Button onClick={onToggleDetails} size="sm" type="button" variant="outline">
            <ChatMetaRailToggle open={detailsOpen} />
          </Button> */}
        </div>
      </div>
    </div>
  );
}

function getChainOfThoughtLabel(isStreaming: boolean, duration?: number) {
  if (isStreaming || duration === 0) {
    return <span>Chain of thought...</span>;
  }

  if (duration === undefined) {
    return <span>Chain of thought</span>;
  }

  return <span>Chain of thought | {duration}s</span>;
}

function getAutoTitleCandidate(messages: UIMessage[]) {
  const preferredMessage =
    messages.find((message) => message.role === "assistant" && getTextFromUiMessage(message).trim().length > 0) ??
    messages.find((message) => message.role === "user" && getTextFromUiMessage(message).trim().length > 0);

  return preferredMessage ? deriveAutoThreadTitleFromText(getTextFromUiMessage(preferredMessage)) : "Untitled chat";
}

function ChatWorkspaceInner({ mode, thread, initialMessages = [] }: ChatWorkspaceProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { openSettings } = useSettingsDialog();
  const utils = apiClient.useUtils();
  const draftKey = createThreadDraftKey(thread?.id ?? null);
  const controller = usePromptInputController();
  const attachments = useProviderAttachments();
  const viewerQuery = apiClient.viewer.session.useQuery(undefined, { refetchOnWindowFocus: false });
  const modelsQuery = apiClient.chat.models.useQuery(undefined, { refetchOnWindowFocus: false });
  const [model, setModel] = useState(thread?.model ?? "");
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [reasoningLevel, setReasoningLevel] = useState<ChatReasoningLevel>("low");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [threadTitle, setThreadTitle] = useState(thread?.title ?? "Untitled chat");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [messageQueue, setMessageQueue] = useState<PromptInputMessage[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(thread?.title ?? "");

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

  const invalidateThreadLists = useCallback(() => {
    void utils.chat.list.invalidate({ archived: false, limit: CHAT_RECENT_THREADS_LIMIT });
    void utils.chat.list.invalidate({ archived: true, limit: CHAT_RECENT_THREADS_LIMIT });
  }, [utils]);

  const { messages, sendMessage, status, stop } = useChat({
    id: thread?.id ?? "landing-chat",
    messages: initialUiMessages,
    onError: (nextError) => {
      toast.error(nextError.message || "Failed to send chat message.");
      // Clear queue on error to prevent stuck messages
      setMessageQueue([]);
    },
    onFinish: ({ message }) => {
      invalidateThreadLists();
      void utils.viewer.session.invalidate();

      if (thread?.id) {
        void utils.chat.get.invalidate({ threadId: thread.id });
        router.refresh();
      }

      const nextThreadId = getThreadIdFromMessageMetadata(message);
      if (!thread?.id && nextThreadId) {
        clearThreadDraftSnapshot(draftKey);
        startTransition(() => {
          router.replace(PATH.CHAT.THREAD(nextThreadId));
        });
      }

      // Auto-send next queued message if any
      setMessageQueue((prev) => {
        if (prev.length > 0) {
          const [nextMessage, ...remaining] = prev;
          // Send next message after a small delay to ensure state is updated
          setTimeout(() => {
            void sendNextMessage(nextMessage);
          }, 100);
          return remaining;
        }
        return prev;
      });
    },
    transport: chatTransport,
  });

  const renderedMessages = useMemo(() => mapUiMessagesToWorkspaceMessages(messages), [messages]);
  const reasoningSupported = selectedModelData?.supportsReasoning ?? true;

  useEffect(() => {
    if (!reasoningSupported && reasoningEnabled) {
      setReasoningEnabled(false);
    }
  }, [reasoningEnabled, reasoningSupported]);

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
    onSettled: invalidateThreadLists,
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
    onSettled: invalidateThreadLists,
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

  const handleSend = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() && message.files.length === 0) {
        return;
      }

      if (isArchived) {
        toast.error("This thread is archived. Restore it before sending a new message.");
        return;
      }

      if (!model) {
        toast.error("Select an available model before sending a message.");
        return;
      }

      // If AI is currently processing, queue the message instead
      if (status === "submitted" || status === "streaming") {
        setMessageQueue((prev) => [...prev, message]);
        toast.success(`Message queued. ${messageQueue.length + 1} in queue.`);
        controller.textInput.setInput("");
        attachments.clear();
        return;
      }

      await sendMessage(
        message.text.trim() ? { files: message.files, text: message.text.trim() } : { files: message.files },
        {
          body: {
            model,
            reasoningEnabled,
            reasoningLevel,
            threadId: thread?.id,
            webSearch: useWebSearch,
          },
        },
      );

      controller.textInput.setInput("");
    },
    [
      isArchived,
      status,
      messageQueue.length,
      model,
      reasoningEnabled,
      reasoningLevel,
      useWebSearch,
      sendMessage,
      thread?.id,
      controller.textInput,
      attachments,
    ],
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

      // If AI is currently processing, queue the message instead
      if (status === "submitted" || status === "streaming") {
        setMessageQueue((prev) => [...prev, message]);
        toast.success(`Message queued. ${messageQueue.length + 1} in queue.`);
        return;
      }

      await sendMessage(message, {
        body: {
          model,
          reasoningEnabled,
          reasoningLevel,
          threadId: thread?.id,
          webSearch: useWebSearch,
        },
      });
    },
    [isArchived, status, messageQueue.length, model, reasoningEnabled, reasoningLevel, sendMessage, thread?.id],
  );

  // Helper function to send queued messages
  const sendNextMessage = useCallback(
    async (message: PromptInputMessage) => {
      if (!model) return;

      await sendMessage(
        message.text.trim() ? { files: message.files, text: message.text.trim() } : { files: message.files },
        {
          body: {
            model,
            reasoningEnabled,
            reasoningLevel,
            threadId: thread?.id,
            webSearch: useWebSearch,
          },
        },
      );
    },
    [model, reasoningEnabled, reasoningLevel, useWebSearch, sendMessage, thread?.id],
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

  const isSubmitting = status === "submitted" || status === "streaming";
  const isBusy = renameThread.isPending || archiveThread.isPending || restoreThread.isPending;
  const isSubmitDisabled =
    (!controller.textInput.value.trim() && attachments.files.length === 0) ||
    !model ||
    hasNoRuntimeModels ||
    isArchived;
  const activePlan = viewer?.billing?.currentPlan?.name ?? "Free";
  const balanceCredits = viewer?.wallet?.balanceCredits ?? 0;
  const isLowBalance = balanceCredits <= 0 || balanceCredits < 1000;

  return (
    <Shell>
      <Shell.Section
        className={cn(
          "grid size-full w-full  max-w-5xl grid-cols-1 px-0",
          !isMobile && detailsOpen ? "xl:grid-cols-[minmax(0,1fr)_140px]" : "xl:grid-cols-[minmax(0,1fr)_0px]",
        )}
      >
        <div className="flex min-w-0 flex-col overflow-hidden">
          <DraftSync draftKey={draftKey} />
          <ThreadToolbar
            detailsOpen={detailsOpen}
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
              <ConversationContent>
                {renderedMessages.length === 0 ? (
                  <EmptyConversationState mode={mode} />
                ) : (
                  renderedMessages.map(({ versions, ...message }) => {
                    const isReasoningStreaming = message.metadata?.status === "streaming";

                    return (
                      <MessageBranch defaultBranch={0} key={message.key}>
                        <MessageBranchContent>
                          {versions.map((version) => (
                            <Message from={message.from} key={`${message.key}-${version.id}`}>
                              <div>
                                {message.sources?.length ? (
                                  <Sources>
                                    <SourcesTrigger count={message.sources.length} />
                                    <SourcesContent>
                                      {message.sources.map((source) => (
                                        <Source href={source.href} key={source.href} title={source.title} />
                                      ))}
                                    </SourcesContent>
                                  </Sources>
                                ) : null}
                                {message.reasoning ? (
                                  <Reasoning isStreaming={isReasoningStreaming}>
                                    <ReasoningTrigger getThinkingMessage={getChainOfThoughtLabel} />
                                    <ReasoningContent>{message.reasoning.content}</ReasoningContent>
                                  </Reasoning>
                                ) : null}
                                <MessageContent>
                                  <MessageResponse>{version.content}</MessageResponse>
                                </MessageContent>
                                {message.from === "assistant" ? <MessageUsage message={message} /> : null}
                              </div>
                            </Message>
                          ))}
                        </MessageBranchContent>
                        {versions.length > 1 ? (
                          <MessageBranchSelector>
                            <MessageBranchPrevious />
                            <MessageBranchPage />
                            <MessageBranchNext />
                          </MessageBranchSelector>
                        ) : null}
                      </MessageBranch>
                    );
                  })
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="grid shrink-0 gap-4 pt-4">
              {/* Show suggestions only when no messages and not archived */}
              {renderedMessages.length === 0 && !isArchived ? (
                <div className="px-4 pb-2">
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
              {/* Message Queue Display */}
              {messageQueue.length > 0 && !isArchived && (
                <div className="px-4 pb-2">
                  <Queue>
                    <QueueSection>
                      <QueueSectionTrigger>
                        <QueueSectionLabel count={messageQueue.length} label="queued messages" />
                      </QueueSectionTrigger>
                      <QueueSectionContent>
                        <QueueList>
                          {messageQueue.map((queuedMessage, index) => (
                            <QueueItem key={index}>
                              <QueueItemIndicator />
                              <QueueItemContent className="flex-1">
                                <span className="truncate">
                                  {queuedMessage.text ||
                                    (queuedMessage.files.length > 0
                                      ? `${queuedMessage.files.length} file(s)`
                                      : "Message")}
                                </span>
                              </QueueItemContent>
                              <Button
                                className="h-6 w-6"
                                onClick={() => setMessageQueue((prev) => prev.filter((_, i) => i !== index))}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <XIcon className="size-3" />
                              </Button>
                            </QueueItem>
                          ))}
                        </QueueList>
                      </QueueSectionContent>
                    </QueueSection>
                  </Queue>
                </div>
              )}
              <div className="w-full p-2">
                <PromptInput globalDrop multiple onSubmit={handleSend}>
                  <PromptInputHeader>
                    <PromptInputAttachmentsDisplay />
                  </PromptInputHeader>
                  <PromptInputBody>
                    <div className="flex items-start w-full px-2 justify-between">
                      <PromptInputTextarea className="max-w-xl w-full" disabled={isArchived} />
                      <span className="text-muted-foreground text-xs">
                        {/* 
                          Rough token estimation:
                          - 0.25 multiplier assumes ~4 chars per token (approximation for English text)
                          - 1000 tokens per file is a conservative estimate for file processing overhead
                          Note: This is a heuristic and actual token counts may vary by model/tokenizer
                        */}
                        {Math.round(
                          controller.textInput.value.length * 0.25 + attachments.files.length * 1000,
                        ).toLocaleString()}{" "}
                        tokens
                      </span>
                    </div>
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>
                      <SpeechInput
                        className="shrink-0"
                        onTranscriptionChange={handleTranscriptionChange}
                        size="icon-sm"
                        variant="ghost"
                      />
                      <PromptInputButton
                        onClick={() => setUseWebSearch((current) => !current)}
                        variant={useWebSearch ? "default" : "secondary"}
                      >
                        <GlobeIcon size={16} />
                        <span>Search</span>
                      </PromptInputButton>

                      <PromptInputButton
                        aria-label="Toggle chain of thought"
                        disabled={!reasoningSupported || isArchived}
                        onClick={() => setReasoningEnabled(!reasoningEnabled)}
                        variant={reasoningEnabled ? "default" : "secondary"}
                      >
                        <BrainIcon className="size-3.5" />
                        <span>{reasoningEnabled ? "Reasoning on" : "Reasoning off"}</span>
                      </PromptInputButton>
                      <PromptInputSelect
                        disabled={!reasoningEnabled || !reasoningSupported || isArchived}
                        onValueChange={(value: string) => setReasoningLevel(value as ChatReasoningLevel)}
                        value={reasoningLevel}
                      >
                        <PromptInputSelectTrigger>
                          <PromptInputSelectValue placeholder="Reasoning level" />
                        </PromptInputSelectTrigger>
                        <PromptInputSelectContent>
                          {CHAT_REASONING_LEVELS.map((level) => (
                            <PromptInputSelectItem key={level} value={level}>
                              {formatReasoningLevelLabel(level)}
                            </PromptInputSelectItem>
                          ))}
                        </PromptInputSelectContent>
                      </PromptInputSelect>

                      <ModelPicker model={model} models={allowedModels} onChange={setModel} />
                    </PromptInputTools>
                    <div className="flex items-center gap-2">
                      {/* Context Token Usage Display */}
                      <Context
                        maxTokens={selectedModelData?.contextWindow ?? 128000}
                        modelId={model}
                        // Rough token estimation: 0.25 chars/token ratio + 1000 tokens per file attachment
                        usedTokens={controller.textInput.value.length * 0.25 + attachments.files.length * 1000}
                      >
                        <ContextTrigger />

                        <ContextContent>
                          <ContextContentHeader />
                          <ContextContentBody>
                            <ContextInputUsage />
                            <ContextOutputUsage />
                            <ContextReasoningUsage />
                          </ContextContentBody>
                          <ContextContentFooter />
                        </ContextContent>
                      </Context>
                      <PromptInputSubmit
                        disabled={isSubmitDisabled}
                        onStop={isSubmitting ? stop : undefined}
                        status={status}
                      />
                    </div>
                  </PromptInputFooter>
                </PromptInput>
                <p className={cn("text-muted-foreground mt-2 text-xs", mode === "landing" ? "block" : "hidden")}>
                  Threads are created automatically after the first successful response and then moved to their own
                  route.
                </p>
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
          reasoningEnabled={reasoningEnabled}
          reasoningLevel={reasoningLevel}
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

export function ChatWorkspace({ mode, thread = null, initialMessages = [] }: ChatWorkspaceProps) {
  const draftKey = createThreadDraftKey(thread?.id ?? null);
  const initialDraft = getThreadDraftSnapshot(draftKey) ?? { attachments: [], text: "" };
  const workspaceKey = `${draftKey}:${thread?.lastMessageAt?.toISOString?.() ?? "landing"}:${initialMessages.length}:${thread?.isArchived ? "archived" : "active"}`;

  return (
    <PromptInputProvider
      initialAttachments={initialDraft.attachments}
      initialInput={initialDraft.text}
      key={workspaceKey}
    >
      <ChatWorkspaceInner initialMessages={initialMessages} mode={mode} thread={thread} />
    </PromptInputProvider>
  );
}
