export interface Expense {
  id: string;
  reference: string;
  title: string;
  category: string;
  amount: number;
  branch: string;
  paidTo: string;
  paymentMethod: "cash" | "card" | "bank" | "mobile";
  status: "approved" | "pending" | "rejected";
  isRecurring: boolean;
  date: string;
  approvedBy?: string;
  notes?: string;
  attachments?: number;
}

export const expenseCategories = [
  "Rent",
  "Utilities",
  "Salaries",
  "Transport",
  "Marketing",
  "Maintenance",
  "Supplies",
  "Insurance",
  "Taxes",
  "Miscellaneous",
];

export const paymentMethods = ["cash", "card", "bank", "mobile"] as const;
export const expenseStatuses = ["approved", "pending", "rejected"] as const;

export const mockExpenses: Expense[] = [];