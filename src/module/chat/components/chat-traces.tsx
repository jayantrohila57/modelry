"use client";

import { ArrowUpRightIcon, BrainIcon, GlobeIcon, WrenchIcon } from "lucide-react";
import { useState } from "react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/shared/components/ui/trace";
import type { ChatWorkspaceMessage } from "../chat.data";

function formatPart(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ChatReasoningTrace({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [open, setOpen] = useState<boolean>();
  const line = (
    <TraceLine status={isStreaming ? "running" : undefined}>
      <TraceIcon>
        <BrainIcon />
      </TraceIcon>
      <TraceTitle>{isStreaming ? "Reasoning in progress" : "Reasoning"}</TraceTitle>
    </TraceLine>
  );

  if (!content) return line;

  return (
    <Trace>
      <TraceCollapsible open={open ?? isStreaming} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="whitespace-pre-wrap text-xs">{content}</TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

type ToolPart = NonNullable<ChatWorkspaceMessage["toolParts"]>[number];

function getToolState(state: string) {
  if (state === "output-error" || state === "output-denied") return "error" as const;
  if (state === "input-available") return "running" as const;
  if (state === "input-streaming" || state === "approval-requested") return "pending" as const;
  return undefined;
}

function getToolTitle(part: ToolPart) {
  const name = part.toolName.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  if (part.state === "output-error" || part.state === "output-denied") return `Failed: ${name}`;
  if (part.state === "output-available" || part.state === "approval-responded") return `Completed: ${name}`;
  if (part.state === "input-available") return `Running: ${name}`;
  if (part.state === "input-streaming") return `Preparing: ${name}`;
  if (part.state === "approval-requested") return `Waiting for approval: ${name}`;
  return name;
}

function ToolTraceRow({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState<boolean>();
  const status = getToolState(part.state);
  const isActive = part.state === "input-available" || part.state === "input-streaming";
  const hasDetails = part.input !== undefined || part.output !== undefined || part.errorText !== undefined;
  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <WrenchIcon />
      </TraceIcon>
      <TraceTitle>{getToolTitle(part)}</TraceTitle>
    </TraceLine>
  );

  if (!hasDetails) return line;

  return (
    <TraceCollapsible open={open ?? isActive} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="grid gap-2 text-xs">
        {part.input !== undefined ? <TraceValue label="Input" value={formatPart(part.input)} /> : null}
        {part.output !== undefined ? <TraceValue label="Output" value={formatPart(part.output)} /> : null}
        {part.errorText ? <TraceValue error label="Error" value={part.errorText} /> : null}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function TraceValue({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className={error ? "font-medium text-destructive" : "font-medium text-muted-foreground"}>{label}</span>
      <pre
        className={`max-h-64 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2 font-mono text-[11px] ${error ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </pre>
    </div>
  );
}

export function ChatToolTrace({ parts }: { parts: NonNullable<ChatWorkspaceMessage["toolParts"]> }) {
  if (!parts.length) return null;
  return (
    <Trace>
      {parts.map((part, index) => (
        <ToolTraceRow key={`${part.toolName}-${index}`} part={part} />
      ))}
    </Trace>
  );
}

export function ChatSourcesTrace({ sources }: { sources: NonNullable<ChatWorkspaceMessage["sources"]> }) {
  const uniqueSources = sources.filter(
    (source, index, all) => all.findIndex((other) => other.href === source.href) === index,
  );
  if (!uniqueSources.length) return null;

  return (
    <Trace>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <GlobeIcon />
            </TraceIcon>
            <TraceTitle>Used {uniqueSources.length} sources</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {uniqueSources.map((source) => (
              <a href={source.href} key={source.href} rel="noreferrer" target="_blank">
                <TraceLine>
                  <TraceTitle>
                    {source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </TraceTitle>
                  <TraceIcon>
                    <ArrowUpRightIcon />
                  </TraceIcon>
                </TraceLine>
              </a>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
