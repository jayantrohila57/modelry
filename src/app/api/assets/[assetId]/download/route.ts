import { get } from "@vercel/blob";
import { getServerSession } from "@/core/auth/auth.server";
import { getAssetContentDisposition } from "@/module/assets/assets.domain";
import { getAssetForUser } from "@/module/assets/assets.service";
import { jsonFailure } from "@/shared/config/api.utils";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { session, user } = await getServerSession();
  if (!session || !user?.id) {
    return jsonFailure({ message: "Authentication required", code: "UNAUTHORIZED", kind: "auth", httpStatus: 401 });
  }

  try {
    const { assetId } = await params;
    const asset = await getAssetForUser(user.id, assetId);
    if (!asset.pathname) {
      return jsonFailure({
        message: "File is no longer available",
        code: "NOT_FOUND",
        kind: "not_found",
        httpStatus: 404,
      });
    }
    const blob = await get(asset.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return jsonFailure({
        message: "File is no longer available",
        code: "NOT_FOUND",
        kind: "not_found",
        httpStatus: 404,
      });
    }

    const disposition = asset.fileType === "html" ? "attachment" : "inline";
    return new Response(blob.stream, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": getAssetContentDisposition(asset.name, disposition),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonFailure({ message: "File not found", code: "NOT_FOUND", kind: "not_found", httpStatus: 404 });
  }
}
