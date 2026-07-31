import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  businessScenarios,
  defaultBusinessScenarioId,
  getBusinessScenario,
  type BusinessScenario,
  type BusinessScenarioId,
} from "@/data/BusinessScenarios";

type BusinessScenarioContextValue = {
  scenarioId: BusinessScenarioId;
  scenario: BusinessScenario;
  scenarios: BusinessScenario[];
  selectScenario: (scenarioId: BusinessScenarioId) => void;
};

const BusinessScenarioContext =
  createContext<BusinessScenarioContextValue | null>(null);

export function BusinessScenarioProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [scenarioId, setScenarioId] = useState<BusinessScenarioId>(
    defaultBusinessScenarioId,
  );

  const selectScenario = useCallback((nextScenarioId: BusinessScenarioId) => {
    setScenarioId(nextScenarioId);
  }, []);

  const scenario = useMemo(() => getBusinessScenario(scenarioId), [scenarioId]);

  const value = useMemo<BusinessScenarioContextValue>(
    () => ({
      scenarioId,
      scenario,
      scenarios: businessScenarios,
      selectScenario,
    }),
    [scenarioId, scenario, selectScenario],
  );

  return (
    <BusinessScenarioContext.Provider value={value}>
      {children}
    </BusinessScenarioContext.Provider>
  );
}

export function useBusinessScenario() {
  const context = useContext(BusinessScenarioContext);

  if (!context) {
    throw new Error(
      "useBusinessScenario must be used inside BusinessScenarioProvider",
    );
  }

  return context;
}