import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Package, Tags, Layers, Ruler, Warehouse, ClipboardList,
  ArrowLeftRight, ShoppingCart, Truck, Receipt, Monitor, Users, Heart,
  CreditCard, BarChart3, UserCog, Building2, Bell, Settings, Shield,
  Store, Plus, Search, Box, FileText, HelpCircle,
} from "lucide-react";

const pages = [
  { name: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Navigate" },
  { name: "Products", url: "/products", icon: Package, group: "Navigate" },
  { name: "Categories", url: "/categories", icon: Tags, group: "Navigate" },
  { name: "Brands", url: "/brands", icon: Layers, group: "Navigate" },
  { name: "Units", url: "/units", icon: Ruler, group: "Navigate" },
  { name: "Stock Overview", url: "/inventory", icon: Warehouse, group: "Navigate" },
  { name: "Adjustments", url: "/stock-adjustments", icon: ClipboardList, group: "Navigate" },
  { name: "Transfers", url: "/transfers", icon: ArrowLeftRight, group: "Navigate" },
  { name: "Stock Counts", url: "/stock-counts", icon: Box, group: "Navigate" },
  { name: "Point of Sale", url: "/pos", icon: Monitor, group: "Navigate" },
  { name: "Sales", url: "/sales", icon: Receipt, group: "Navigate" },
  { name: "Quotations", url: "/quotations", icon: FileText, group: "Navigate" },
  { name: "Purchases", url: "/purchases", icon: ShoppingCart, group: "Navigate" },
  { name: "Suppliers", url: "/suppliers", icon: Truck, group: "Navigate" },
  { name: "Customers", url: "/customers", icon: Users, group: "Navigate" },
  { name: "Loyalty", url: "/loyalty", icon: Heart, group: "Navigate" },
  { name: "Staff", url: "/staff", icon: UserCog, group: "Navigate" },
  { name: "Expenses", url: "/expenses", icon: CreditCard, group: "Navigate" },
  { name: "Reports", url: "/reports", icon: BarChart3, group: "Navigate" },
  { name: "Branches", url: "/branches", icon: Building2, group: "Navigate" },
  { name: "Warehouses", url: "/warehouses", icon: Store, group: "Navigate" },
  { name: "Notifications", url: "/notifications", icon: Bell, group: "Navigate" },
  { name: "Support", url: "/support", icon: HelpCircle, group: "Navigate" },
  { name: "Settings", url: "/settings", icon: Settings, group: "Navigate" },
  { name: "Activity Logs", url: "/activity-logs", icon: Shield, group: "Navigate" },
];

const actions = [
  { name: "New Sale", url: "/pos", icon: Plus, group: "Quick Actions" },
  { name: "Add Product", url: "/products", icon: Plus, group: "Quick Actions" },
  { name: "Add Customer", url: "/customers", icon: Plus, group: "Quick Actions" },
  { name: "New Purchase Order", url: "/purchases", icon: Plus, group: "Quick Actions" },
  { name: "Record Expense", url: "/expenses", icon: Plus, group: "Quick Actions" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted rounded-lg border hover:bg-secondary transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search or jump to...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            {actions.map((action) => (
              <CommandItem
                key={action.name}
                onSelect={() => handleSelect(action.url)}
                className="cursor-pointer"
              >
                <action.icon className="mr-2 h-4 w-4 text-accent" />
                {action.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            {pages.map((page) => (
              <CommandItem
                key={page.name}
                onSelect={() => handleSelect(page.url)}
                className="cursor-pointer"
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
