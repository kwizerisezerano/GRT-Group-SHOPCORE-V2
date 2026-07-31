import IdentityJourneyTimeline from "@/components/public-experience/IdentityJourneyTimeline";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function IdentityJourneyPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Identity Governance"
      title="Access is governed throughout the complete identity lifecycle."
      description="ShopCore evaluates identity, authentication, tenant association, permission scope, device posture, module access, session monitoring, audit visibility, and revocation as connected controls."
    >
      <IdentityJourneyTimeline
        tone="trust"
        title="Access is governed throughout the complete identity lifecycle."
        description="ShopCore evaluates identity, authentication, tenant association, permission scope, device posture, module access, session monitoring, audit visibility, and revocation as connected controls."
      />
    </PublicExperienceLayout>
  );
}
