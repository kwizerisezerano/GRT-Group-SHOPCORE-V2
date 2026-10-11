import EnterpriseBlueprintCanvas from "@/components/public-experience/EnterpriseBlueprintCanvas";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function EnterpriseBlueprintPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Trust Architecture"
      title="The ShopCore trust architecture connects identity, tenant governance, business operations, and platform oversight."
      description="Cloud services, Platform Admin, tenant boundaries, business workspaces, operating modules, offline continuity, and governance controls form one connected Business Operating System."
    >
      <EnterpriseBlueprintCanvas
        tone="trust"
        title="The ShopCore trust architecture connects identity, tenant governance, business operations, and platform oversight."
        description="Cloud services, Platform Admin, tenant boundaries, business workspaces, operating modules, offline continuity, and governance controls form one connected Business Operating System."
      />
    </PublicExperienceLayout>
  );
}
