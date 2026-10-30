"use client";

import type { UIMessage } from "ai";
import { ArchiveRestore, ChevronLeft, ChevronRight, Edit3, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/utils/lib/utils";

type AllowedModelLike = {
  displayName: string;
  planCode: string;
  providerModel: string;
  source: "catalog" | "runtime";
};

type ChatMetaRailProps = {
  activePlan: string;
  availableModelsCount: number;
  balanceCredits: number;
  hasNoRuntimeModels: boolean;
  isArchived: boolean;
  isBusy: boolean;
  isLowBalance: boolean;
  messages: UIMessage[];
  mode: "landing" | "thread";
  onArchive: () => void;
  onAutoRename: () => void;
  onManageBilling: () => void;
  onRename: () => void;
  onRestore: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel?: AllowedModelLike;
  thread?: {
    id: string;
  } | null;
};

function RailBody({
  isArchived,
  isBusy,
  messages,
  mode,
  onArchive,
  onAutoRename,
  onRename,
  onRestore,
  thread,
}: Omit<ChatMetaRailProps, "open" | "onOpenChange">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      {isArchived ? (
        <Alert className="py-3">
          <ArchiveRestore className="size-4" />
          <AlertTitle>Thread Archived</AlertTitle>
          <AlertDescription>This conversation is read-only until restored.</AlertDescription>
          <Button className="mt-3 w-full" disabled={isBusy} onClick={onRestore} size="sm" type="button">
            <ArchiveRestore className="size-4" />
            Restore
          </Button>
        </Alert>
      ) : null}

      {thread ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Button className="w-fit" disabled={isBusy} onClick={onRename} size="sm" type="button" variant="outline">
              <Edit3 className="size-4" />
              Rename
            </Button>
            <Button
              className="w-fit"
              disabled={isBusy}
              onClick={onAutoRename}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCcw className="size-4" />
              Auto
            </Button>
            <Button className="w-fit" disabled={isBusy} onClick={onArchive} size="sm" type="button" variant="outline">
              <Trash2 className="size-4" />
              Archive
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground px-1 text-xs leading-5">
          Thread actions will appear once the conversation is created.
        </p>
      )}

      <div className="border-t pt-3">
        <p className="text-muted-foreground text-xs">Chat Info</p>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode</span>
            <span>{isArchived ? "Archived" : mode === "thread" ? "Active" : "New"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Messages</span>
            <Badge variant="secondary">{messages.length}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatMetaRail({ open, onOpenChange, ...props }: ChatMetaRailProps) {
  const [isCompact, setIsCompact] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (isCompact) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-[min(340px,calc(100vw-1rem))] max-w-sm p-0 sm:max-w-sm" side="right">
          <SheetHeader className="sr-only">
            <SheetTitle>Chat details</SheetTitle>
            <SheetDescription>Chat details, usage, and thread actions.</SheetDescription>
          </SheetHeader>
          <RailBody {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "hidden h-full border-l bg-background transition-all duration-200 ease-out xl:flex",
        open ? "w-[340px] translate-x-0 opacity-100" : "w-0 translate-x-6 opacity-0",
      )}
    >
      <div className={cn("min-w-[340px] flex-1", open ? "pointer-events-auto" : "pointer-events-none")}>
        <RailBody {...props} />
      </div>
    </aside>
  );
}

export function ChatMetaRailToggle({ open }: { open: boolean }) {
  return (
    <>
      {open ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
      <span>{open ? "Hide details" : "Show details"}</span>
    </>
  );
}
