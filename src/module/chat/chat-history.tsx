import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { apiServer } from "@/core/api/api.server";
import { getServerSession } from "@/core/auth/auth.server";
import { normalizeChatSearchQuery } from "@/module/chat/chat.request.utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PATH } from "@/shared/config/routes";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

const PAGE_SIZE = 50;

export async function ChatHistoryPage({
  archived,
  searchParams,
}: {
  archived: boolean;
  searchParams: Promise<{ offset?: string | string[]; q?: string | string[] }>;
}) {
  const [{ offset: rawOffset, q: rawQuery }, { session }] = await Promise.all([searchParams, getServerSession()]);
  if (!session) redirect("/auth/sign-in");

  const search = normalizeChatSearchQuery(rawQuery);
  const offsetValue = Array.isArray(rawOffset) ? rawOffset[0] : rawOffset;
  const offset = Math.max(0, Number.parseInt(offsetValue ?? "0", 10) || 0);
  const response = await apiServer.chat.list({ archived, limit: PAGE_SIZE, offset, search });
  const threads = response.ok ? (response.data ?? []) : [];
  const hasPrevious = offset > 0;
  const hasNext = threads.length === PAGE_SIZE;
  const route = archived ? PATH.CHAT.ARCHIVE : PATH.CHAT.ALL;
  const pageHref = (nextOffset: number) =>
    `${route}?${new URLSearchParams({ ...(search ? { q: search } : {}), offset: String(nextOffset) })}` as Route;

  return (
    <section className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 overflow-hidden px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{archived ? "Archived chats" : "All chats"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived ? "Restore a conversation to continue it." : "Find and continue any conversation."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={PATH.CHAT.ROOT}>New chat</Link>
        </Button>
      </header>

      <form action={route} className="flex gap-2" method="get" role="search">
        <Input
          aria-label="Search conversations"
          autoComplete="off"
          defaultValue={search}
          name="q"
          placeholder="Search titles and messages"
        />
        <input name="offset" type="hidden" value="0" />
        <Button type="submit">Search</Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card">
        {!response.ok ? (
          <Alert className="m-4" variant="destructive">
            <AlertTitle>Could not load conversations</AlertTitle>
            <AlertDescription>
              {response.message || "Chat history is temporarily unavailable. Refresh the page to try again."}
            </AlertDescription>
          </Alert>
        ) : threads.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium">
              {search ? "No matching conversations" : archived ? "No archived chats" : "No conversations yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? "Try another title or phrase from a message."
                : "Your chats will appear here after your first message."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
                  href={PATH.CHAT.THREAD(thread.id)}
                >
                  <span className="min-w-0 truncate font-medium">{thread.title}</span>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={thread.lastMessageAt.toISOString()}
                  >
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                      thread.lastMessageAt,
                    )}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav aria-label="Conversation pages" className="flex items-center justify-between">
        <Button asChild disabled={!hasPrevious} variant="outline">
          {hasPrevious ? <Link href={pageHref(Math.max(0, offset - PAGE_SIZE))}>Previous</Link> : <span>Previous</span>}
        </Button>
        <span className="text-sm text-muted-foreground">
          {offset + 1}–{offset + threads.length}
        </span>
        <Button asChild disabled={!hasNext} variant="outline">
          {hasNext ? <Link href={pageHref(offset + PAGE_SIZE)}>Next</Link> : <span>Next</span>}
        </Button>
      </nav>
    </section>
  );
}
