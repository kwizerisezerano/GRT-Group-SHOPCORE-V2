import TenantBoundaryMap from "@/components/public-experience/TenantBoundaryMap";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function TenantBoundaryPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Tenant Isolation"
      title="Every organization operates within an independently governed tenant boundary."
      description="Shared platform services support the ShopCore ecosystem, while user access, operational records, subscriptions, permissions, audit context, devices, and administrative responsibility remain tenant-scoped."
    >
      <TenantBoundaryMap
        tone="trust"
        title="Every organization operates within an independently governed tenant boundary."
        description="Shared platform services support the ShopCore ecosystem, while user access, operational records, subscriptions, permissions, audit context, devices, and administrative responsibility remain tenant-scoped."
      />
    </PublicExperienceLayout>
  );
}
