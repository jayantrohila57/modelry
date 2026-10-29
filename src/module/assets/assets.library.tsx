"use client";

import { FilePlus2, FolderPlus, LayoutGrid, List, MoreHorizontal, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage, getApiResponseData, getApiResponseMessage } from "@/core/api/api.client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Progress } from "@/shared/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ASSET_FILE_TYPES } from "./assets.domain";
import { AssetFileIcon } from "./asset-file-icon";
import { AssetUploadSteps } from "./asset-upload-steps";
import { uploadAndProcessAsset, type AssetUploadProgress } from "./assets.upload";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type AssetItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  fileType: string;
  category: string;
  folderId: string | null;
  summary: string | null;
  processingStatus: string;
  processingProgress: number;
  processingError: string | null;
  indexedAt: Date | null;
  createdAt: Date;
};

type AssetFolder = { id: string; name: string; createdAt: Date };
type AssetUploadItem = { id: string; name: string; sizeBytes: number; progress: AssetUploadProgress };
type AssetListData = { assets: AssetItem[]; folders: AssetFolder[]; categories: string[] };

function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function AssetStatus({ asset }: { asset: AssetItem }) {
  if (asset.processingStatus === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (asset.processingStatus === "failed") return <Badge variant="destructive">Needs attention</Badge>;
  return (
    <div className="flex min-w-24 items-center gap-2 text-xs text-muted-foreground">
      <Progress value={asset.processingProgress} className="w-14" />
      {asset.processingStatus === "queued" ? "Waiting" : `${asset.processingProgress}%`}
    </div>
  );
}

function AssetCard({
  asset,
  folders,
  layout,
  onRename,
  onCategory,
  onMove,
  onDelete,
  onRetry,
}: {
  asset: AssetItem;
  folders: AssetFolder[];
  layout: "grid" | "list";
  onRename: (asset: AssetItem) => void;
  onCategory: (asset: AssetItem) => void;
  onMove: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
  onRetry: (asset: AssetItem) => void;
}) {
  return (
    <article className={`group relative flex min-w-0 gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/30 ${layout === "list" ? "items-center" : "flex-col"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <a className="flex min-w-0 items-center gap-3" href={`/api/assets/${asset.id}/download`} target="_blank" rel="noreferrer">
          <AssetFileIcon name={asset.name} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium" title={asset.name}>{asset.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{formatSize(asset.sizeBytes)} · {formatDate(asset.createdAt)}</span>
          </span>
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for ${asset.name}`} className="size-8 shrink-0" size="icon" variant="ghost"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onRename(asset)}><Pencil className="size-4" />Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCategory(asset)}><FilePlus2 className="size-4" />Change category</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove(asset)}><FolderPlus className="size-4" />Move to folder</DropdownMenuItem>
            {asset.processingStatus === "failed" ? <DropdownMenuItem onSelect={() => onRetry(asset)}><Upload className="size-4" />Retry analysis</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(asset)}><Trash2 className="size-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={`min-w-0 ${layout === "list" ? "flex flex-1 items-center justify-between gap-4" : "space-y-3"}`}>
        {layout === "grid" ? <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{asset.summary || "Document analysis will appear here."}</p> : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="max-w-40 truncate">{asset.category}</Badge>
          <Badge variant="outline" className="uppercase">{asset.fileType}</Badge>
          {asset.folderId ? <Badge variant="secondary" className="max-w-32 truncate">{folders.find((folder) => folder.id === asset.folderId)?.name ?? "Folder"}</Badge> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {layout === "list" && asset.summary ? <p className="hidden max-w-md truncate text-sm text-muted-foreground xl:block">{asset.summary}</p> : null}
          <AssetStatus asset={asset} />
        </div>
      </div>
      {asset.processingError ? <p className="text-xs text-destructive">{asset.processingError}</p> : null}
    </article>
  );
}

export function AssetsLibrary() {
  const utils = apiClient.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [fileType, setFileType] = useState("all");
  const [category, setCategory] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [uploads, setUploads] = useState<AssetUploadItem[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<AssetFolder | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [moveFolderId, setMoveFolderId] = useState("root");
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<AssetFolder | null>(null);

  const assetsQuery = apiClient.assets.list.useQuery({
    search: search.trim() || undefined,
    folderId: selectedFolder === "all" ? undefined : selectedFolder,
  }, { refetchInterval: 2500 });
  const viewerQuery = apiClient.viewer.session.useQuery(undefined, { refetchOnWindowFocus: false });
  const viewerData = getApiResponseData(viewerQuery.data) as { user?: { id: string } | null } | null;
  const createAsset = apiClient.assets.create.useMutation();
  const createFolder = apiClient.assets.createFolder.useMutation({
    onSuccess: (response) => {
      toast.success(getApiResponseMessage(response, "Folder created."));
      setFolderDialogOpen(false);
      setFolderName("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't create the folder.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const renameFolder = apiClient.assets.renameFolder.useMutation({
    onSuccess: () => {
      toast.success("Folder renamed.");
      setRenamingFolder(null);
      setFolderName("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't rename the folder.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const deleteFolder = apiClient.assets.deleteFolder.useMutation({
    onSuccess: () => {
      toast.success("Folder deleted. Its files are now in All assets.");
      setFolderToDelete(null);
      if (selectedFolder === folderToDelete?.id) setSelectedFolder("all");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete the folder.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const renameAsset = apiClient.assets.rename.useMutation({
    onSuccess: () => {
      toast.success("Asset renamed.");
      setEditingAsset(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't rename the asset.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const categorizeAsset = apiClient.assets.categorize.useMutation({
    onSuccess: () => {
      toast.success("Category updated.");
      setEditingAsset(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update the category.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const moveAsset = apiClient.assets.move.useMutation({
    onSuccess: () => {
      toast.success("Asset moved.");
      setEditingAsset(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't move the asset.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });
  const deleteAsset = apiClient.assets.delete.useMutation({
    onSuccess: (response) => {
      toast.success(getApiResponseMessage(response, "Asset deleted."));
      setAssetToDelete(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete the asset.")),
    onSettled: () => void utils.assets.list.invalidate(),
  });

  const data = getApiResponseData(assetsQuery.data) as AssetListData | null;
  const filteredAssets = useMemo(() => (data?.assets ?? []).filter((asset) =>
    (fileType === "all" || asset.fileType === fileType) && (category === "all" || asset.category === category),
  ), [category, data?.assets, fileType]);

  async function startUploads(files: File[]) {
    const selectedFiles = files.slice(0, 5);
    if (files.length > 5) toast.error("Upload up to 5 files at a time.");
    const items = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      sizeBytes: file.size,
      progress: { stage: "uploading" as const, progress: 0, message: "Starting secure upload" },
    }));
    setUploads((current) => [...items, ...current].slice(0, 10));

    for (const [index, file] of selectedFiles.entries()) {
      const item = items[index]!;
      try {
        await uploadAndProcessAsset({
          file,
          userId: viewerData?.user?.id ?? "",
          folderId: selectedFolder !== "all" && selectedFolder !== "root" ? selectedFolder : undefined,
          maxSizeBytes: MAX_UPLOAD_BYTES,
          createAsset: (input) => createAsset.mutateAsync(input),
          onProgress: (progress) => setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry)),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload or analysis failed.";
        setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress: { stage: "failed", progress: entry.progress.progress, message: "Upload or analysis failed", error: message } } : entry));
        toast.error(`${file.name}: ${message}`);
      }
    }
    void utils.assets.list.invalidate();
  }

  async function retryAnalysis(asset: AssetItem) {
    try {
      const response = await fetch(`/api/assets/${asset.id}/process`, { method: "POST" });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Document analysis failed.");
      toast.success("Document analysis finished.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document analysis failed.");
    } finally {
      void utils.assets.list.invalidate();
    }
  }

  function submitFolder() {
    const name = folderName.trim();
    if (!name) return;
    if (renamingFolder) renameFolder.mutate({ folderId: renamingFolder.id, name });
    else createFolder.mutate({ name });
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Assets</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Store and organize documents, then ask chat to find details across their content.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setRenamingFolder(null); setFolderName(""); setFolderDialogOpen(true); }}><FolderPlus className="size-4" />New folder</Button>
          <Button onClick={() => fileInput.current?.click()}><Upload className="size-4" />Upload files</Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ASSET_FILE_TYPES.map((type) => `.${type}`).join(",")}
            className="sr-only"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length) void startUploads(files);
            }}
          />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-card p-3">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</p>
            <Button aria-label="Create folder" className="size-7" size="icon" variant="ghost" onClick={() => setFolderDialogOpen(true)}><FolderPlus className="size-4" /></Button>
          </div>
          <div className="space-y-1">
            {[
              { id: "all", name: "All assets" },
              { id: "root", name: "Unfiled" },
              ...(data?.folders ?? []),
            ].map((folder) => (
              <div key={folder.id} className="group flex items-center gap-1">
                <Button className="min-w-0 flex-1 justify-start truncate" variant={selectedFolder === folder.id ? "secondary" : "ghost"} onClick={() => setSelectedFolder(folder.id)}>
                  <span className="truncate">{folder.name}</span>
                </Button>
                {folder.id !== "all" && folder.id !== "root" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button aria-label={`Actions for ${folder.name}`} className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" size="icon" variant="ghost"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setRenamingFolder(folder as AssetFolder); setFolderName(folder.name); setFolderDialogOpen(true); }}>Rename</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={() => setFolderToDelete(folder as AssetFolder)}>Delete folder</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search assets" className="pl-9" placeholder="Search files and summaries" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select value={fileType} onValueChange={(value) => setFileType(value ?? "all")}>
              <SelectTrigger className="w-32"><SelectValue placeholder="File type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem>{ASSET_FILE_TYPES.map((type) => <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category} onValueChange={(value) => setCategory(value ?? "all")}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{(data?.categories ?? []).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <div className="ml-auto flex gap-1">
              <Button aria-label="Grid view" className="size-8" size="icon" variant={layout === "grid" ? "secondary" : "ghost"} onClick={() => setLayout("grid")}><LayoutGrid className="size-4" /></Button>
              <Button aria-label="List view" className="size-8" size="icon" variant={layout === "list" ? "secondary" : "ghost"} onClick={() => setLayout("list")}><List className="size-4" /></Button>
            </div>
          </div>

          {uploads.length ? <div className="grid gap-3">{uploads.map((item) => <AssetUploadSteps key={item.id} name={item.name} sizeBytes={item.sizeBytes} progress={item.progress} />)}</div> : null}

          {assetsQuery.isLoading ? <div className="rounded-2xl border p-10 text-center text-sm text-muted-foreground">Loading assets…</div> : null}
          {assetsQuery.isError ? <div className="rounded-2xl border border-destructive/30 p-6 text-sm text-destructive">{getApiErrorMessage(assetsQuery.error, "Assets couldn't be loaded.")}</div> : null}
          {!assetsQuery.isLoading && filteredAssets.length ? (
            <div className={layout === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
              {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} folders={data?.folders ?? []} layout={layout} onRename={(target) => { setEditingAsset(target); setDialogValue(target.name); setMoveFolderId("rename"); }} onCategory={(target) => { setEditingAsset(target); setDialogValue(target.category); setMoveFolderId("category"); }} onMove={(target) => { setEditingAsset(target); setMoveFolderId(target.folderId ?? "root"); setDialogValue(""); }} onDelete={setAssetToDelete} onRetry={retryAnalysis} />)}
            </div>
          ) : null}
          {!assetsQuery.isLoading && !assetsQuery.isError && filteredAssets.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted"><FilePlus2 className="size-5 text-muted-foreground" /></div>
              <h2 className="font-medium">No assets here yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Upload a document or choose another folder. Supported files can be summarized and searched from chat.</p>
              <Button className="mt-4" onClick={() => fileInput.current?.click()}><Upload className="size-4" />Upload a document</Button>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog open={folderDialogOpen} onOpenChange={(open) => { setFolderDialogOpen(open); if (!open) setRenamingFolder(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{renamingFolder ? "Rename folder" : "Create folder"}</DialogTitle><DialogDescription>Use folders to organize your assets. Categories are generated from document content and can be changed on each asset.</DialogDescription></DialogHeader>
          <Label htmlFor="asset-folder-name">Folder name</Label>
          <Input id="asset-folder-name" autoFocus maxLength={80} value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitFolder(); }} />
          <DialogFooter><Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button><Button disabled={!folderName.trim() || createFolder.isPending || renameFolder.isPending} onClick={submitFolder}>{renamingFolder ? "Save changes" : "Create folder"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingAsset)} onOpenChange={(open) => { if (!open) setEditingAsset(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveFolderId === "category" ? "Change category" : moveFolderId === "rename" ? "Rename asset" : "Move asset"}</DialogTitle>
            <DialogDescription>{editingAsset?.name}</DialogDescription>
          </DialogHeader>
          {moveFolderId === "category" ? <><Label htmlFor="asset-category">Category</Label><Input id="asset-category" maxLength={80} value={dialogValue} onChange={(event) => setDialogValue(event.target.value)} /></> : null}
          {moveFolderId === "rename" ? <><Label htmlFor="asset-name">File name</Label><Input id="asset-name" maxLength={255} value={dialogValue} onChange={(event) => setDialogValue(event.target.value)} /></> : null}
          {moveFolderId !== "category" && moveFolderId !== "rename" ? <><Label htmlFor="asset-move-folder">Folder</Label><Select value={moveFolderId} onValueChange={(value) => value && setMoveFolderId(value)}><SelectTrigger id="asset-move-folder"><SelectValue placeholder="Choose a folder" /></SelectTrigger><SelectContent><SelectItem value="root">Unfiled</SelectItem>{(data?.folders ?? []).map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectContent></Select></> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAsset(null)}>Cancel</Button>
            <Button disabled={renameAsset.isPending || categorizeAsset.isPending || moveAsset.isPending} onClick={() => {
              if (!editingAsset) return;
              if (moveFolderId === "category") categorizeAsset.mutate({ assetId: editingAsset.id, category: dialogValue.trim() });
              else if (moveFolderId === "rename") renameAsset.mutate({ assetId: editingAsset.id, name: dialogValue.trim() });
              else moveAsset.mutate({ assetId: editingAsset.id, folderId: moveFolderId === "root" ? null : moveFolderId });
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(assetToDelete)} onOpenChange={(open) => { if (!open) setAssetToDelete(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this asset?</AlertDialogTitle><AlertDialogDescription>The file and its searchable AI index will be permanently deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => assetToDelete && deleteAsset.mutate({ assetId: assetToDelete.id })}>Delete asset</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(folderToDelete)} onOpenChange={(open) => { if (!open) setFolderToDelete(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this folder?</AlertDialogTitle><AlertDialogDescription>Assets in this folder will move to Unfiled. Their files and AI indexes will remain available.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => folderToDelete && deleteFolder.mutate({ folderId: folderToDelete.id })}>Delete folder</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
