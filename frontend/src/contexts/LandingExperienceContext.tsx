import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { landingModules } from "@/data/landingDemoData";
import type { LandingModuleId } from "@/data/landingDemoData";
import { useBusinessScenario } from "@/contexts/BusinessScenarioContext";
import {
  useLiveBusinessEngine,
  type LiveBusinessEngineState,
} from "@/hooks/useLiveBusinessEngine";

export type LandingBranch = "kigali-main" | "remera" | "musanze" | "huye";

export type LandingWorkspace =
  | "executive"
  | "retail"
  | "warehouse"
  | "finance"
  | "procurement"
  | "customer-office";

type LandingExperienceContextValue = {
  selectedModule: LandingModuleId;
  activeBranch: LandingBranch;
  activeWorkspace: LandingWorkspace;
  demoMode: boolean;
  interactionCount: number;
  highlightedWorkflow: string;

  selectModule: (module: LandingModuleId) => void;
  selectBranch: (branch: LandingBranch) => void;
  selectWorkspace: (workspace: LandingWorkspace) => void;
  setHighlightedWorkflow: (workflow: string) => void;
  pauseDemoMode: () => void;
  resumeDemoMode: () => void;
} & LiveBusinessEngineState;

const moduleCycle: LandingModuleId[] = [...landingModules];

const branchCycle: LandingBranch[] = [
  "kigali-main",
  "remera",
  "musanze",
  "huye",
];

const workspaceMap: Record<LandingModuleId, LandingWorkspace> = {
  pos: "retail",
  inventory: "warehouse",
  warehouse: "warehouse",
  crm: "customer-office",
  procurement: "procurement",
  finance: "finance",
  analytics: "executive",
  offline: "executive",
  ebm: "finance",
  security: "executive",
};

const workflowMap: Record<LandingModuleId, string> = {
  pos: "sale-to-stock-to-finance",
  inventory: "stock-alert-to-replenishment",
  warehouse: "receiving-to-transfer",
  crm: "customer-loyalty-to-repeat-sale",
  procurement: "purchase-order-to-receiving",
  finance: "cash-session-to-margin-report",
  analytics: "operations-to-executive-kpi",
  offline: "offline-queue-to-secure-sync",
  ebm: "sale-to-fiscal-receipt",
  security: "role-permission-to-audit-trail",
};

const LandingExperienceContext =
  createContext<LandingExperienceContextValue | null>(null);

export function LandingExperienceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedModule, setSelectedModule] = useState<LandingModuleId>("pos");
  const [activeBranch, setActiveBranch] =
    useState<LandingBranch>("kigali-main");
  const [activeWorkspace, setActiveWorkspace] =
    useState<LandingWorkspace>("retail");
  const [highlightedWorkflow, setHighlightedWorkflow] = useState(
    workflowMap.pos,
  );
  const { scenario } = useBusinessScenario();
  const [demoMode, setDemoMode] = useState(true);
  const [interactionCount, setInteractionCount] = useState(0);

  const liveEngine = useLiveBusinessEngine({
  selectedModule,
  activeBranch,
  demoMode,
  scenario,
});

  const registerInteraction = useCallback(() => {
    setInteractionCount((count) => count + 1);
    setDemoMode(false);
  }, []);

  const selectModule = useCallback(
    (module: LandingModuleId) => {
      registerInteraction();
      setSelectedModule(module);
      setActiveWorkspace(workspaceMap[module]);
      setHighlightedWorkflow(workflowMap[module]);
    },
    [registerInteraction],
  );

  const selectBranch = useCallback(
    (branch: LandingBranch) => {
      registerInteraction();
      setActiveBranch(branch);
    },
    [registerInteraction],
  );

  const selectWorkspace = useCallback(
    (workspace: LandingWorkspace) => {
      registerInteraction();
      setActiveWorkspace(workspace);
    },
    [registerInteraction],
  );

  const pauseDemoMode = useCallback(() => {
    setDemoMode(false);
  }, []);

  const resumeDemoMode = useCallback(() => {
    setDemoMode(true);
  }, []);

  useEffect(() => {
    if (!demoMode) return;

    const interval = window.setInterval(() => {
      setSelectedModule((current) => {
        const currentIndex = moduleCycle.indexOf(current);
        const nextModule =
          moduleCycle[(currentIndex + 1) % moduleCycle.length];

        setActiveWorkspace(workspaceMap[nextModule]);
        setHighlightedWorkflow(workflowMap[nextModule]);

        return nextModule;
      });

      setActiveBranch((current) => {
        const currentIndex = branchCycle.indexOf(current);
        return branchCycle[(currentIndex + 1) % branchCycle.length];
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [demoMode]);

  const value = useMemo<LandingExperienceContextValue>(
    () => ({
      selectedModule,
      activeBranch,
      activeWorkspace,
      demoMode,
      interactionCount,
      highlightedWorkflow,

      selectModule,
      selectBranch,
      selectWorkspace,
      setHighlightedWorkflow,
      pauseDemoMode,
      resumeDemoMode,

      ...liveEngine,
    }),
    [
      selectedModule,
      activeBranch,
      activeWorkspace,
      demoMode,
      interactionCount,
      highlightedWorkflow,
      selectModule,
      selectBranch,
      selectWorkspace,
      pauseDemoMode,
      resumeDemoMode,
      liveEngine,
    ],
  );

  return (
    <LandingExperienceContext.Provider value={value}>
      {children}
    </LandingExperienceContext.Provider>
  );
}

export function useLandingExperience() {
  const context = useContext(LandingExperienceContext);

  if (!context) {
    throw new Error(
      "useLandingExperience must be used inside LandingExperienceProvider",
    );
  }

  return context;
}