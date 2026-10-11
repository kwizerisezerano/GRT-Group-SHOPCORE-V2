import ComplianceFramework from "@/components/public-experience/ComplianceFramework";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function ComplianceFrameworkPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Compliance Foundation"
      title="A governance foundation designed for accountable business operations."
      description="ShopCore is being developed around tenant isolation, identity control, operational traceability, secure administration, responsible support, resilient synchronization, and regional fiscal readiness where correctly configured."
    >
      <ComplianceFramework
        tone="trust"
        title="A governance foundation designed for accountable business operations."
        description="ShopCore is being developed around tenant isolation, identity control, operational traceability, secure administration, responsible support, resilient synchronization, and regional fiscal readiness where correctly configured."
      />
    </PublicExperienceLayout>
  );
}
