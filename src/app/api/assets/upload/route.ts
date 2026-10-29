import { handleUpload } from "@vercel/blob/client";
import { getServerSession } from "@/core/auth/auth.server";
import { serverEnv } from "@/shared/config/env.server";
import { getAllowedMimeTypes, getAssetFileType, isAssetPathOwnedByUser } from "@/module/assets/assets.domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { session, user } = await getServerSession();
  if (!session || !user?.id) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await handleUpload({
      token: serverEnv.BLOB_READ_WRITE_TOKEN,
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAssetPathOwnedByUser(pathname, user.id)) {
          throw new Error("Invalid asset upload path.");
        }
        const fileType = getAssetFileType(pathname);
        if (fileType === "other") throw new Error("This file type is not supported for document analysis.");

        return {
          addRandomSuffix: true,
          allowedContentTypes: getAllowedMimeTypes(fileType),
          maximumSizeInBytes: serverEnv.MAX_UPLOAD_FILE_SIZE_BYTES,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to authorize file upload." },
      { status: 400 },
    );
  }
}
