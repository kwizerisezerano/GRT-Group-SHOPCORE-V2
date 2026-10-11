import SecurityResponseCenter from "@/components/public-experience/SecurityResponseCenter";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function SecurityResponsePage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Security Response"
      title="Privacy, security, and operational response"
      description="A structured reporting and escalation framework for suspected unauthorized access, tenant-data concerns, compromised devices, support-access risks, synchronization incidents, and critical operational disruption."
    >
      <SecurityResponseCenter
        tone="trust"
        title="Privacy, security, and operational response"
        description="A structured reporting and escalation framework for suspected unauthorized access, tenant-data concerns, compromised devices, support-access risks, synchronization incidents, and critical operational disruption."
      />
    </PublicExperienceLayout>
  );
}
