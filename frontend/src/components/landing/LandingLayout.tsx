import { type ReactNode } from "react";
import EnterpriseNavbar from "@/components/landing/EnterpriseNavbar";
import OperatingFooter from "@/components/landing/OperatingFooter";
import { LandingExperienceProvider } from "@/contexts/LandingExperienceContext";
import { BusinessScenarioProvider } from "@/contexts/BusinessScenarioContext";

interface LandingLayoutProps {
  children: ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <BusinessScenarioProvider>
      <LandingExperienceProvider>
        <div className="shopcore-theme-scope min-h-screen bg-background text-foreground">
          <EnterpriseNavbar />

          <main>{children}</main>

          <OperatingFooter />
        </div>
      </LandingExperienceProvider>
    </BusinessScenarioProvider>
  );
}
