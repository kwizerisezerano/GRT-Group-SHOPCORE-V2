import type { LandingModuleId } from "@/data/landingDemoData";

export type BusinessScenarioId =
  | "retail"
  | "supermarket"
  | "pharmacy"
  | "hardware"
  | "electronics"
  | "fashion"
  | "wholesale"
  | "restaurant";

export type BusinessScenario = {
  id: BusinessScenarioId;
  name: string;
  label: string;
  description: string;
  primaryModule: LandingModuleId;
  businessName: string;
  branches: string[];
  products: string[];
  customersLabel: string;
  inventoryFocus: string;
  revenueLabel: string;
  alerts: string[];
  workflow: string[];
};

export const businessScenarios: BusinessScenario[] = [
  {
    id: "retail",
    name: "Retail Store",
    label: "Retail",
    description: "Daily shop operations with POS, stock, customers and reports.",
    primaryModule: "pos",
    businessName: "ShopCore Retail Group",
    branches: ["Kigali Main", "Remera", "Musanze", "Huye"],
    products: ["Rice 25kg", "Cooking Oil 5L", "Sugar 10kg", "Laptop Charger"],
    customersLabel: "Customers",
    inventoryFocus: "Stock availability",
    revenueLabel: "Daily sales",
    alerts: ["Low stock alert", "Receipt synchronized", "Transfer approved"],
    workflow: ["Scan product", "Take payment", "Deduct stock", "Update reports"],
  },
  {
    id: "supermarket",
    name: "Supermarket",
    label: "Supermarket",
    description: "High-volume checkout, perishable stock and branch replenishment.",
    primaryModule: "inventory",
    businessName: "FreshMart Supermarket",
    branches: ["Main Market", "Cold Room", "Express Lane", "Depot"],
    products: ["Fresh Milk", "Tomatoes", "Bread", "Cooking Oil"],
    customersLabel: "Loyalty members",
    inventoryFocus: "Perishable stock",
    revenueLabel: "Checkout revenue",
    alerts: ["Cold storage review", "Fresh produce reorder", "Lane sales update"],
    workflow: ["Checkout sale", "Update stock", "Review perishables", "Replenish shelves"],
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    label: "Pharmacy",
    description: "Batch, expiry, medicine inventory and patient purchase history.",
    primaryModule: "inventory",
    businessName: "MediStock Pharmacy",
    branches: ["Kigali Pharmacy", "Dispensary", "Storage", "Clinic Counter"],
    products: ["Paracetamol", "Amoxicillin", "Vitamin C", "Cough Syrup"],
    customersLabel: "Patients",
    inventoryFocus: "Batch and expiry control",
    revenueLabel: "Prescription sales",
    alerts: ["Expiry review required", "Controlled stock movement", "Batch count updated"],
    workflow: ["Select medicine", "Check batch", "Process sale", "Update patient record"],
  },
  {
    id: "hardware",
    name: "Hardware Store",
    label: "Hardware",
    description: "Bulk products, project orders, supplier purchasing and warehouse flow.",
    primaryModule: "warehouse",
    businessName: "BuildPro Hardware",
    branches: ["Main Yard", "Paint Store", "Steel Depot", "Delivery Desk"],
    products: ["Cement", "Steel Bars", "Paint 20L", "Roofing Sheets"],
    customersLabel: "Contractors",
    inventoryFocus: "Bulk stock control",
    revenueLabel: "Project orders",
    alerts: ["Bulk stock review", "Delivery order approved", "Supplier reorder needed"],
    workflow: ["Create order", "Reserve stock", "Approve delivery", "Update warehouse"],
  },
  {
    id: "electronics",
    name: "Electronics Store",
    label: "Electronics",
    description: "Serial-numbered products, warranties, accessories and customer service.",
    primaryModule: "crm",
    businessName: "TechHub Electronics",
    branches: ["Showroom", "Service Desk", "Accessories", "Warehouse"],
    products: ["Smartphone", "Laptop", "Power Bank", "Router"],
    customersLabel: "Warranty customers",
    inventoryFocus: "Serial number tracking",
    revenueLabel: "Device sales",
    alerts: ["Warranty record updated", "Accessory stock low", "Service ticket linked"],
    workflow: ["Sell device", "Capture serial", "Register warranty", "Update customer"],
  },
  {
    id: "fashion",
    name: "Fashion Store",
    label: "Fashion",
    description: "Sizes, colors, seasonal stock, promotions and customer loyalty.",
    primaryModule: "crm",
    businessName: "StyleLine Fashion",
    branches: ["Main Boutique", "Men Section", "Women Section", "Outlet"],
    products: ["Denim Jacket", "Sneakers", "Dress", "Handbag"],
    customersLabel: "Loyalty shoppers",
    inventoryFocus: "Size and color variants",
    revenueLabel: "Seasonal sales",
    alerts: ["Promotion active", "Variant stock low", "VIP purchase recorded"],
    workflow: ["Select item", "Apply promotion", "Record loyalty", "Update stock"],
  },
  {
    id: "wholesale",
    name: "Wholesale Distributor",
    label: "Wholesale",
    description: "Large orders, warehouse dispatch, supplier costs and customer credit.",
    primaryModule: "procurement",
    businessName: "PrimeSupply Wholesale",
    branches: ["Distribution Center", "Dispatch", "Bulk Storage", "Credit Desk"],
    products: ["Carton Oil", "Rice Pallet", "Sugar Bags", "Soap Cartons"],
    customersLabel: "Wholesale clients",
    inventoryFocus: "Bulk dispatch stock",
    revenueLabel: "Bulk order value",
    alerts: ["Customer credit review", "Dispatch approved", "Supplier cost updated"],
    workflow: ["Create bulk order", "Check credit", "Dispatch stock", "Update finance"],
  },
  {
    id: "restaurant",
    name: "Restaurant / Café",
    label: "Restaurant",
    description: "Food stock, kitchen usage, table orders, cash control and daily reports.",
    primaryModule: "pos",
    businessName: "UrbanBite Café",
    branches: ["Main Dining", "Kitchen", "Bar Counter", "Store Room"],
    products: ["Coffee", "Burger", "Juice", "Chicken Meal"],
    customersLabel: "Guests",
    inventoryFocus: "Ingredient consumption",
    revenueLabel: "Table sales",
    alerts: ["Ingredient stock low", "Kitchen order completed", "Cash session updated"],
    workflow: ["Take order", "Send to kitchen", "Collect payment", "Update stock"],
  },
];

export const defaultBusinessScenarioId: BusinessScenarioId = "retail";

export const getBusinessScenario = (id: BusinessScenarioId) =>
  businessScenarios.find((scenario) => scenario.id === id) ??
  businessScenarios[0];