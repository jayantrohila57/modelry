import { getServerSession } from "@/core/auth/auth.server";
import { getAssetStatuses } from "@/module/assets/assets.service";
import { jsonFailure, jsonSuccess } from "@/shared/config/api.utils";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { session, user } = await getServerSession();
  if (!session || !user?.id) {
    return jsonFailure({ message: "Authentication required", code: "UNAUTHORIZED", kind: "auth", httpStatus: 401 });
  }

  const { assetId } = await params;
  const [asset] = await getAssetStatuses(user.id, [assetId]);
  if (!asset) {
    return jsonFailure({ message: "Asset not found", code: "NOT_FOUND", kind: "not_found", httpStatus: 404 });
  }
  return jsonSuccess(asset, "Asset processing state retrieved.");
}
