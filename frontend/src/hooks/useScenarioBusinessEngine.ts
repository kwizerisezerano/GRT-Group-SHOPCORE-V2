import { useMemo } from "react";
import type { BusinessScenario } from "@/data/BusinessScenarios";

export function useScenarioBusinessEngine(scenario?: BusinessScenario) {
  return useMemo(() => {
    const active = scenario;

    return {
      businessName: active?.businessName ?? "ShopCore Retail Group",
      branches: active?.branches ?? ["Kigali Main", "Remera", "Musanze", "Huye"],
      products: active?.products ?? ["Rice 25kg", "Cooking Oil 5L", "Sugar 10kg"],
      alerts: active?.alerts ?? ["Low stock alert", "Receipt synchronized"],
      workflow: active?.workflow ?? [
        "Scan product",
        "Take payment",
        "Deduct stock",
        "Update reports",
      ],
      customersLabel: active?.customersLabel ?? "Customers",
      inventoryFocus: active?.inventoryFocus ?? "Stock availability",
      revenueLabel: active?.revenueLabel ?? "Daily sales",
      primaryModule: active?.primaryModule ?? "pos",
    };
  }, [scenario]);
}