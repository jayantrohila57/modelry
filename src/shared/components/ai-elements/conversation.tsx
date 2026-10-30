"use client";

import { MessageScroller } from "@shadcn/react/message-scroller";
import type { UIMessage } from "ai";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import { createContext, useCallback, useContext, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/lib/utils";

const ConversationViewportContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useConversationViewport() {
  return useContext(ConversationViewportContext);
}

export type ConversationProps = ComponentProps<typeof MessageScroller.Root>;

export const Conversation = ({ children, className, ...props }: ConversationProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  return (
    <ConversationViewportContext.Provider value={viewportRef}>
      <MessageScroller.Provider autoScroll defaultScrollPosition="last-anchor" scrollEdgeThreshold={80}>
        <MessageScroller.Root
          className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
          {...props}
        >
          {children}
        </MessageScroller.Root>
      </MessageScroller.Provider>
    </ConversationViewportContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<typeof MessageScroller.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => {
  const viewportRef = useConversationViewport();

  return (
    <MessageScroller.Viewport
      aria-label="Chat messages"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain data-[pending-scroll]:invisible"
      preserveScrollOnPrepend
      ref={viewportRef ?? undefined}
    >
      <MessageScroller.Content
        className={cn("mx-auto flex w-full max-w-3xl flex-col gap-8 p-4", className)}
        {...props}
      />
    </MessageScroller.Viewport>
  );
};

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof MessageScroller.Button>;

export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
  return (
    <MessageScroller.Button
      aria-label="Scroll to latest message"
      className={cn(
        "absolute bottom-4 left-1/2 z-10 inline-flex size-10 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-opacity hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring inert:pointer-events-none inert:opacity-0",
        className,
      )}
      type="button"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </MessageScroller.Button>
  );
};

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export type ConversationDownloadProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  messages: UIMessage[];
  filename?: string;
  formatMessage?: (message: UIMessage, index: number) => string;
};

const defaultFormatMessage = (message: UIMessage): string => {
  const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
  messages: UIMessage[],
  formatMessage: (message: UIMessage, index: number) => string = defaultFormatMessage,
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

export const ConversationDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  className,
  children,
  ...props
}: ConversationDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename, formatMessage]);

  return (
    <Button
      className={cn("absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted", className)}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </Button>
  );
};
