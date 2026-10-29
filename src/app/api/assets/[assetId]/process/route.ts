import { TRPCError } from "@trpc/server";
import { getServerSession } from "@/core/auth/auth.server";
import { processAsset } from "@/module/assets/assets.ingestion";
import { jsonFailure, jsonSuccess } from "@/shared/config/api.utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { session, user } = await getServerSession();
  if (!session || !user?.id) {
    return jsonFailure({
      message: "Authentication required",
      code: "UNAUTHORIZED",
      kind: "auth",
      httpStatus: 401,
    });
  }

  try {
    const { assetId } = await params;
    const result = await processAsset(user.id, assetId);
    return jsonSuccess(result, "Document analysis finished.");
  } catch (error) {
    const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
    const httpStatus = code === "NOT_FOUND" ? 404 : code === "BAD_REQUEST" ? 400 : 500;
    return jsonFailure({
      message: error instanceof Error ? error.message : "Document analysis failed.",
      code,
      kind: httpStatus === 500 ? "server" : "validation",
      httpStatus,
      status: "failed",
    });
  }
}
