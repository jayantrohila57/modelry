import { redirect } from "next/navigation";
import { getServerSession } from "@/core/auth/auth.server";
import { getSignInDestination } from "@/module/auth/auth.callback";
import { AssetsLibrary } from "@/module/assets/assets.library";
import { PATH } from "@/shared/config/routes";

export const metadata = {
  title: "Assets",
  description: "Organize documents and analyze them with AI.",
};

export default async function AssetsPage() {
  const { session } = await getServerSession();
  if (!session) redirect(getSignInDestination(PATH.ASSETS.ROOT));
  return <AssetsLibrary />;
}
