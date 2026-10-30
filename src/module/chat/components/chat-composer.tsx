"use client";

import type { ChatStatus, FileUIPart } from "ai";
import { ArrowUpIcon, BrainIcon, GaugeIcon, GlobeIcon, MoreHorizontal, SquareIcon, XIcon } from "lucide-react";
import { useMemo } from "react";
import type { RouterOutputs, UnwrapApiData } from "@/core/api/api.client";
import { AssetFileIcon } from "@/module/assets/asset-file-icon";
import type { PromptInputMessage } from "@/shared/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  type PromptInputProps,
  PromptInputTextarea,
  usePromptInputAttachments,
  usePromptInputController,
} from "@/shared/components/ai-elements/prompt-input";
import { SpeechInput } from "@/shared/components/ai-elements/speech-input";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/components/ui/attachment";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { InputGroupAddon, InputGroupButton } from "@/shared/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Progress } from "@/shared/components/ui/progress";
import { Spinner } from "@/shared/components/ui/spinner";
import {
  CHAT_REASONING_EFFORTS,
  CHAT_TEMPERATURE_PRESETS,
  type ChatReasoningEffort,
  type ChatTemperaturePreset,
  formatReasoningEffortLabel,
  formatTemperaturePresetLabel,
} from "../chat.runtime";

type AllowedModel = UnwrapApiData<RouterOutputs["chat"]["models"]>[number];

type ChatComposerProps = {
  accept: string;
  allowedModels: AllowedModel[];
  isArchived: boolean;
  isMobile: boolean;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  isUploadingAssets: boolean;
  mode: "landing" | "thread";
  model: string;
  onModelChange: (modelId: string) => void;
  onReasoningEnabledChange: (enabled: boolean) => void;
  onReasoningEffortChange: (effort: ChatReasoningEffort) => void;
  onStop: () => void;
  onSubmit: PromptInputProps["onSubmit"];
  onTemperatureChange: (preset: ChatTemperaturePreset) => void;
  onTranscriptionChange: (transcript: string) => void;
  onWebSearchChange: (enabled: boolean) => void;
  reasoningEffort: ChatReasoningEffort;
  reasoningEffortSupported: boolean;
  reasoningEnabled: boolean;
  reasoningSupported: boolean;
  selectedModel?: AllowedModel;
  status: ChatStatus;
  temperaturePreset: ChatTemperaturePreset;
  useWebSearch: boolean;
  webSearchSupported: boolean;
  measuredPromptTokens: number;
  measuredCompletionTokens: number;
  measuredReasoningTokens: number;
  draftTokenEstimate: number;
  onError: NonNullable<PromptInputProps["onError"]>;
};

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;

  return (
    <InputGroupAddon align="block-start" className="flex-wrap gap-2">
      {attachments.files.map((attachment: FileUIPart & { id: string }) => (
        <Attachment key={attachment.id} size="sm" state="done">
          <AttachmentMedia>
            <AssetFileIcon name={attachment.filename ?? "attachment"} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{attachment.filename ?? "Attachment"}</AttachmentTitle>
            <AttachmentDescription>{attachment.mediaType}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              aria-label={`Remove ${attachment.filename ?? "attachment"}`}
              onClick={() => attachments.remove(attachment.id)}
            >
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </InputGroupAddon>
  );
}

function ModelPicker({
  model,
  models,
  onChange,
}: {
  model: string;
  models: AllowedModel[];
  onChange: (value: string) => void;
}) {
  const groupedModels = useMemo(
    () => ({
      Available: models.filter((item) => item.runtimeAvailable),
      Unavailable: models.filter((item) => !item.runtimeAvailable),
    }),
    [models],
  );
  const selectedModel = models.find((item) => item.id === model) ?? models[0];

  if (!selectedModel) return <InputGroupButton disabled>No model</InputGroupButton>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <InputGroupButton
          aria-label={`Model: ${selectedModel.displayName}`}
          className="max-w-44 min-w-0"
          size="sm"
          variant="secondary"
        >
          <span className="truncate">{selectedModel.displayName}</span>
          {!selectedModel.runtimeAvailable ? <Badge variant="outline">Offline</Badge> : null}
        </InputGroupButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuRadioGroup onValueChange={onChange} value={model}>
          {Object.entries(groupedModels).map(([group, items]) =>
            items.length ? (
              <DropdownMenuGroup key={group}>
                <DropdownMenuLabel>{group}</DropdownMenuLabel>
                {items.map((item) => (
                  <DropdownMenuRadioItem disabled={!item.runtimeAvailable} key={item.id} value={item.id}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{item.displayName}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{item.description}</span>
                    </div>
                    <Badge variant="outline">{item.provider}</Badge>
                    <Badge variant="secondary">×{(item.creditMultiplierBps / 10000).toFixed(2)}</Badge>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ) : null,
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatComposer({
  accept,
  allowedModels,
  isArchived,
  isMobile,
  isSubmitting,
  isSubmitDisabled,
  isUploadingAssets,
  mode,
  model,
  onModelChange,
  onReasoningEnabledChange,
  onReasoningEffortChange,
  onStop,
  onSubmit,
  onTemperatureChange,
  onTranscriptionChange,
  onWebSearchChange,
  reasoningEffort,
  reasoningEffortSupported,
  reasoningEnabled,
  reasoningSupported,
  selectedModel,
  status,
  temperaturePreset,
  useWebSearch,
  webSearchSupported,
  measuredPromptTokens,
  measuredCompletionTokens,
  measuredReasoningTokens,
  draftTokenEstimate,
  onError,
}: ChatComposerProps) {
  const controller = usePromptInputController();
  const isWaitingForResponse = status === "submitted";
  const canStopGeneration = status === "streaming";

  return (
    <div className="w-full">
      <PromptInput
        accept={accept}
        clearOnSubmit={false}
        globalDrop={!isUploadingAssets && !isArchived}
        maxFileSize={10 * 1024 * 1024}
        maxFiles={5}
        multiple
        onError={onError}
        onSubmit={onSubmit}
      >
        <ComposerAttachments />
        <PromptInputTextarea
          autoFocus={!isMobile && mode === "landing" && !controller.textInput.value}
          className="min-h-16 max-h-48 w-full min-w-0 px-3 py-2"
          disabled={isArchived || isUploadingAssets}
        />
        <InputGroupAddon align="block-end" className="flex-nowrap justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger disabled={isUploadingAssets || isArchived} />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Add documents" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <SpeechInput
              className="shrink-0"
              disabled={isArchived || isUploadingAssets}
              onTranscriptionChange={onTranscriptionChange}
              size="icon-sm"
              variant="ghost"
            />
            <InputGroupButton
              aria-label="Google Search"
              aria-pressed={useWebSearch}
              className="hidden shrink-0 lg:inline-flex"
              disabled={!webSearchSupported || isArchived}
              onClick={() => onWebSearchChange(!useWebSearch)}
              title={webSearchSupported ? "Use Google Search for this response" : "Web search requires a Google model"}
              size="sm"
              variant={useWebSearch ? "default" : "secondary"}
            >
              <GlobeIcon size={16} />
              <span>Search</span>
            </InputGroupButton>
            <InputGroupButton
              aria-label="Toggle reasoning"
              aria-pressed={reasoningEnabled}
              className="hidden shrink-0 lg:inline-flex"
              disabled={!reasoningSupported || isArchived}
              onClick={() => onReasoningEnabledChange(!reasoningEnabled)}
              size="sm"
              variant={reasoningEnabled ? "default" : "secondary"}
            >
              <BrainIcon className="size-3.5" />
              <span>{reasoningEnabled ? "Reasoning on" : "Reasoning off"}</span>
            </InputGroupButton>
            <div className="hidden shrink-0 md:block">
              <ModelPicker model={model} models={allowedModels} onChange={onModelChange} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton aria-label="More chat options" className="shrink-0" size="icon-sm" variant="ghost">
                  <MoreHorizontal className="size-4" />
                  <span className="hidden sm:inline">More</span>
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="md:hidden">
                  <DropdownMenuLabel>Model</DropdownMenuLabel>
                  <DropdownMenuRadioGroup onValueChange={onModelChange} value={model}>
                    {allowedModels
                      .filter((item) => item.runtimeAvailable)
                      .map((item) => (
                        <DropdownMenuRadioItem key={item.id} value={item.id}>
                          {item.displayName}
                        </DropdownMenuRadioItem>
                      ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={useWebSearch}
                    disabled={!webSearchSupported || isArchived}
                    onCheckedChange={(checked) => onWebSearchChange(checked === true)}
                  >
                    Google Search
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={reasoningEnabled}
                    disabled={!reasoningSupported || isArchived}
                    onCheckedChange={(checked) => onReasoningEnabledChange(checked === true)}
                  >
                    Reasoning
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                </div>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Temperature · {formatTemperaturePresetLabel(temperaturePreset)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      onValueChange={(value) => onTemperatureChange(value as ChatTemperaturePreset)}
                      value={temperaturePreset}
                    >
                      {CHAT_TEMPERATURE_PRESETS.map((level) => (
                        <DropdownMenuRadioItem key={level} value={level}>
                          {formatTemperaturePresetLabel(level)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    disabled={!reasoningEnabled || !reasoningSupported || !reasoningEffortSupported}
                  >
                    Reasoning effort · {formatReasoningEffortLabel(reasoningEffort)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      onValueChange={(value) => onReasoningEffortChange(value as ChatReasoningEffort)}
                      value={reasoningEffort}
                    >
                      {CHAT_REASONING_EFFORTS.map((effort) => (
                        <DropdownMenuRadioItem key={effort} value={effort}>
                          {formatReasoningEffortLabel(effort)} effort
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <InputGroupButton
                  aria-label="Open token usage details"
                  className="shrink-0"
                  size="sm"
                  title="Token usage"
                  variant="ghost"
                >
                  <GaugeIcon className="size-4" />
                  <span className="hidden sm:inline">Usage</span>
                </InputGroupButton>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">Last request input</span>
                  <span className="text-muted-foreground">
                    {measuredPromptTokens > 0 ? `${measuredPromptTokens.toLocaleString()} measured` : "Not measured"}
                  </span>
                </div>
                {measuredPromptTokens > 0 ? (
                  <Progress
                    aria-label="Last request input tokens compared with the selected model context window"
                    value={Math.min(100, (measuredPromptTokens / (selectedModel?.contextWindow ?? 128000)) * 100)}
                  />
                ) : null}
                <div className="grid gap-1 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Output</span>
                    <span>
                      {measuredPromptTokens > 0
                        ? `${measuredCompletionTokens.toLocaleString()} measured`
                        : "Not measured"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Reasoning</span>
                    <span>
                      {measuredPromptTokens > 0
                        ? `${measuredReasoningTokens.toLocaleString()} measured`
                        : "Not measured"}
                    </span>
                  </div>
                </div>
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  Draft estimate: ~{draftTokenEstimate.toLocaleString()} tokens. It excludes conversation history and
                  document context.
                </p>
              </PopoverContent>
            </Popover>
            <InputGroupButton
              aria-label={
                canStopGeneration ? "Stop generation" : isWaitingForResponse ? "Sending message" : "Send message"
              }
              className="shrink-0"
              disabled={isWaitingForResponse || (!isSubmitting && isSubmitDisabled)}
              onClick={canStopGeneration ? onStop : undefined}
              size="icon-sm"
              type={isSubmitting ? "button" : "submit"}
              variant={canStopGeneration ? "destructive" : "default"}
            >
              {isWaitingForResponse ? (
                <Spinner />
              ) : canStopGeneration ? (
                <SquareIcon className="size-4" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      </PromptInput>
      <p className={`mt-2 text-xs text-muted-foreground ${mode === "landing" ? "block" : "hidden"}`}>
        Threads are created automatically after the first successful response and then moved to their own route.
      </p>
    </div>
  );
}
