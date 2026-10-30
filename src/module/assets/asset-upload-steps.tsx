import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { Progress } from "@/shared/components/ui/progress";
import { AssetFileIcon } from "./asset-file-icon";
import type { AssetUploadProgress } from "./assets.upload";

export function AssetUploadSteps({
  name,
  sizeBytes,
  progress,
}: {
  name: string;
  sizeBytes: number;
  progress: AssetUploadProgress;
}) {
  const isFailed = progress.stage === "failed";
  const isReady = progress.stage === "ready";
  const humanSize =
    sizeBytes < 1024 * 1024
      ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
      : `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <p role="status" className="sr-only">
        {name}: {progress.message}
        {progress.error ? `. ${progress.error}` : ""}
      </p>
      <AssetFileIcon name={name} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {humanSize} · {progress.message}
            </p>
          </div>
          {isFailed ? <AlertCircle className="size-4 text-destructive" aria-label="Upload failed" /> : null}
          {isReady ? <Check className="size-4 text-emerald-600" aria-label="Analysis complete" /> : null}
          {!isFailed && !isReady ? (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="In progress" />
          ) : null}
        </div>
        <Progress
          value={progress.progress}
          className={isFailed ? "[&_[data-slot=progress-indicator]]:bg-destructive" : ""}
        />
        {progress.error ? <p className="text-xs text-destructive">{progress.error}</p> : null}
      </div>
      <span aria-hidden="true" className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {progress.progress}%
      </span>
    </div>
  );
}
