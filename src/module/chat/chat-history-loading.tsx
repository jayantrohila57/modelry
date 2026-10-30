import { Skeleton } from "@/shared/components/ui/skeleton";

export function ChatHistoryLoading() {
  return (
    <section
      aria-label="Loading conversations"
      className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="space-y-0 rounded-lg border p-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="flex items-center justify-between gap-4 border-b px-2 py-3 last:border-0" key={index}>
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </section>
  );
}
