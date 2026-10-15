import { BrandLogo } from "@/shared/components/layout/brand/brand-logo";
import { PATH } from "@/shared/config/routes";

export default function HeaderLogo() {
  return <BrandLogo href={PATH.ROOT} showTagline size="lg" />;
}
