import {
  AudioLines,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Presentation,
  Shapes,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

const fileTypeStyles: Record<string, string> = {
  docx: "bg-blue-500 text-white",
  doc: "bg-blue-500 text-white",
  csv: "bg-emerald-500 text-white",
  fig: "bg-violet-500 text-white",
  gif: "bg-violet-500 text-white",
  html: "bg-orange-500 text-white",
  jpg: "bg-amber-500 text-white",
  jpeg: "bg-amber-500 text-white",
  mp3: "bg-pink-500 text-white",
  mp4: "bg-blue-500 text-white",
  md: "bg-slate-500 text-white",
  ods: "bg-emerald-500 text-white",
  odp: "bg-rose-500 text-white",
  pdf: "bg-red-500 text-white",
  png: "bg-amber-500 text-white",
  ppt: "bg-rose-500 text-white",
  pptx: "bg-rose-500 text-white",
  rtf: "bg-blue-500 text-white",
  svg: "bg-amber-500 text-white",
  tex: "bg-violet-500 text-white",
  txt: "bg-slate-500 text-white",
  wav: "bg-pink-500 text-white",
  webp: "bg-amber-500 text-white",
  xls: "bg-emerald-500 text-white",
  xlsx: "bg-emerald-500 text-white",
  zip: "bg-slate-500 text-white",
};

export function AssetFileIcon({
  name,
  fileType: knownType,
  className = "",
}: {
  name: string;
  fileType?: string;
  className?: string;
}) {
  const extension = name.includes(".") ? name.split(".").at(-1) : undefined;
  const fileType = (knownType ?? extension)?.trim().toLowerCase() || "file";
  const Icon = ["xlsx", "ods", "xls", "csv"].includes(fileType)
    ? FileSpreadsheet
    : ["ppt", "pptx", "odp"].includes(fileType)
      ? Presentation
      : ["epub", "zip"].includes(fileType)
        ? FileArchive
        : ["mp3", "wav", "m4a"].includes(fileType)
          ? AudioLines
          : ["mp4", "mov", "avi"].includes(fileType)
            ? Film
            : ["fig"].includes(fileType)
              ? Shapes
              : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileType)
                ? FileImage
                : FileText;

  return (
    <span
      className={`relative inline-flex size-10 shrink-0 items-center justify-center text-muted-foreground ${className}`}
    >
      <Icon className="size-8 stroke-[1.25]" aria-hidden="true" />
      <Badge
        className={`absolute -bottom-0.5 left-1/2 min-w-8 -translate-x-1/2 justify-center border-2 border-background px-1 py-0 text-[9px] leading-4 uppercase shadow-sm ${fileTypeStyles[fileType] ?? "bg-slate-500 text-white"}`}
      >
        {fileType.slice(0, 5)}
      </Badge>
    </span>
  );
}
