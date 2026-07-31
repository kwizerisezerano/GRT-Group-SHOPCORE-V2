export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  reorderLevel: number;
  unit: string;
  status: "active" | "inactive" | "low_stock" | "out_of_stock";
  image?: string;
  description?: string;
  taxRate: number;
  createdAt: string;
}

export const categories = [
  "Beverages & Soft Drinks",
  "Bakeries",
  "Butchery",
  "Canned & Packaged Foods",
  "Baby Products",
  "Agriculture & Outdoor",
  "Cleaning Supplies",
  "Clothing & Fashion",
  "Automotive",
  "Dairy Products",
  "Books & Magazines",
  "Computers & Accessories",
  "Deli & Ready-to-Eat Foods",
  "Electronics",
  "Farm Supplies",
  "Fitness & Sports",
  "Floral & Garden",
  "Frozen Foods",
  "Furnitures",
  "Gifts & Toys",
  "Grocery & Food Staples",
  "Hardware & Tools",
  "Health & Pharmacy",
  "Home Appliances",
  "Home Décor",
  "Household Products",
  "Hygiene & Sanitation",
  "Jewelry & Accessories",
  "Kitchen & Dining",
  "Laundry Products",
  "Liquor & Alcohol",
  "Luggage & Travel",
  "Meat & Seafood",
  "Mobile Phones & Accessories",
  "Office Supplies",
  "Organic & Healthy Foods",
  "Party & Event Supplies",
  "Personal Care & Beauty",
  "Pet Supplies",
  "Plastics & Storage",
  "Rice, Grains & Cereals",
  "School Supplies",
  "Shoes & Footwear",
  "Snacks & Confectionery",
  "Stationery",
  "Tea & Coffee",
  "Toys & Games",
  "Travel Accessories",
  "TV & Audio",
  "Vegetables & Fruits",
  "Wellness & Supplements",
  "Luxury Products",
  "Local Products",
  "Imported Products",
  "Sauces & Condiments",
  "Confectionery & Cookies",
  "Alcoholic Beverages & Wines",
  "Meat & Processed Foods",

];

export const brands = [
"Royco",
"Maggi",
"Golden Fry",
"Basmati",
"Heinz",
"Del Monte",
"Hellmann",
"Nali",
"Peptang",
"Blue Band",
"Nutella",
"Skippy",
"Bonne Maman",
"Oreo",
"Bourbon",
"McVitie",
"Britannia",
"Parle",
  "Apple",
  "Samsung",
  "Sony",
  "LG",
  "Dell",
  "HP",
  "Lenovo",
  "Bose",
  "JBL",
  "Anker",
  "Xiaomi",
  "Google",
  "Microsoft",
  "Logitech",
  "Canon",
];

export const units = [
  "Piece",
  "Box",
  "Carton",
  "Pack",
  "Set",
  "Pair",
  "Kg",
  "Litre",
];

/**
 * Production build:
 * Product data comes from Supabase using tenant_id filtering.
 * No demo products should exist in a new workspace.
 */
export const mockProducts: Product[] = [];