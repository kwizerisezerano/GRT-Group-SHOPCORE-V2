import EnterpriseNavbar from "@/components/landing/EnterpriseNavbar";
import HeroWorkspace from "@/components/landing/HeroWorkspace";
import CommandCenter from "@/components/landing/CommandCenter";
import ModuleExplorer from "@/components/landing/ModuleExplorer";
import BranchIntelligenceMap from "@/components/landing/BranchIntelligenceMap";
import ExecutiveIntelligenceLayer from "@/components/landing/ExecutiveIntelligenceLayer";
import WorkspaceEcosystem from "@/components/landing/WorkspaceEcosystem";
import EnterpriseProofLayer from "@/components/landing/EnterpriseProofLayer";
import OfflineEngine from "@/components/landing/OfflineEngine";
import EBMIntegration from "@/components/landing/EBMIntegration";
import SecurityCenter from "@/components/landing/SecurityCenter";
import PricingWorkspace from "@/components/landing/PricingWorkspace";
import EnterpriseConversionLayer from "@/components/landing/EnterpriseConversionLayer";
import OperatingFooter from "@/components/landing/OperatingFooter";
import ActivityCenter from "@/components/landing/live/ActivityCenter";

import { LandingExperienceProvider } from "@/contexts/LandingExperienceContext";
import { BusinessScenarioProvider } from "@/contexts/BusinessScenarioContext";

function OperatingSystemLandingContent() {
  return (
    <div className="shopcore-theme-scope min-h-screen bg-background text-foreground">
      <EnterpriseNavbar />

      <main>
        <HeroWorkspace />

        <CommandCenter />

        <ModuleExplorer />

        <WorkspaceEcosystem />

        <BranchIntelligenceMap />

        <ExecutiveIntelligenceLayer />

        <OfflineEngine />

        <EBMIntegration />

        <SecurityCenter />

        <EnterpriseProofLayer />

        <PricingWorkspace />

        <EnterpriseConversionLayer />
      </main>

      <ActivityCenter />

      <OperatingFooter />
    </div>
  );
}

export default function OperatingSystemLanding() {
  return (
    <BusinessScenarioProvider>
      <LandingExperienceProvider>
        <OperatingSystemLandingContent />
      </LandingExperienceProvider>
    </BusinessScenarioProvider>
  );
}
