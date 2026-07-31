import DataLifecycleMap from "@/components/public-experience/DataLifecycleMap";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function DataLifecyclePage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Data Lifecycle"
      title="Business information moves through a controlled operating lifecycle."
      description="From collection and validation through processing, audit, retention, review, export, and eligible removal, each stage remains connected to tenant scope, operational purpose, and accountable administration."
    >
      <DataLifecycleMap
        tone="trust"
        title="Business information moves through a controlled operating lifecycle."
        description="From collection and validation through processing, audit, retention, review, export, and eligible removal, each stage remains connected to tenant scope, operational purpose, and accountable administration."
      />
    </PublicExperienceLayout>
  );
}
