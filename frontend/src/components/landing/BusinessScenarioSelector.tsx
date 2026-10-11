import {
  Building2,
  Cpu,
  Hammer,
  Package,
  Pill,
  Shirt,
  ShoppingBasket,
  Store,
  Utensils,
} from "lucide-react";
import { useBusinessScenario } from "@/contexts/BusinessScenarioContext";
import type { BusinessScenarioId } from "@/data/BusinessScenarios";

const iconMap: Record<BusinessScenarioId, React.ElementType> = {
  retail: Store,
  supermarket: ShoppingBasket,
  pharmacy: Pill,
  hardware: Hammer,
  electronics: Cpu,
  fashion: Shirt,
  wholesale: Package,
  restaurant: Utensils,
};

export default function BusinessScenarioSelector() {
  const { scenarioId, scenario, scenarios, selectScenario } =
    useBusinessScenario();

  return (
    <div className="w-full max-w-[650px] rounded-[1.75rem] border border-border bg-card/95 p-5 text-foreground shadow-[0_28px_90px_-55px_rgba(15,23,42,0.55)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center text-foreground">
          <Building2 className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
            Business scenario
          </p>
          <p className="truncate text-base font-black text-slate-900 dark:!text-blue-100">
            {scenario.name}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((item) => {
          const Icon = iconMap[item.id];
          const active = item.id === scenarioId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectScenario(item.id)}
              className={[
                "min-w-0 rounded-2xl border px-3 py-3 text-left transition",
                active
                  ? "border-border bg-muted text-foreground shadow-sm ring-2 ring-border"
                  : "border-border bg-card text-foreground hover:border-border hover:bg-muted/50 hover:text-foreground dark:hover:border-border dark:hover:bg-muted/50 dark:hover:text-foreground",
              ].join(" ")}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />

                <span className="truncate text-[12px] font-black">
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-muted-foreground">
        {scenario.description}
      </p>
    </div>
  );
}