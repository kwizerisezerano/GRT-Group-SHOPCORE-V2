export interface Sale {
  id: string;
  invoiceNo: string;
  customerName: string;
  items: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  paymentMethod: "cash" | "card" | "mobile" | "bank" | "credit";
  status: "completed" | "pending" | "cancelled" | "refunded" | "draft";
  branch: string;
  cashier: string;
  date: string;
  notes?: string;
}

export const mockSales: Sale[] = [
  { id: "SL-001", invoiceNo: "INV-2024-0847", customerName: "Walk-in Customer", items: 3, subtotal: 1547.00, tax: 247.52, discount: 0, total: 1794.52, paid: 1794.52, due: 0, paymentMethod: "cash", status: "completed", branch: "Main Store", cashier: "John Doe", date: "2024-12-10" },
  { id: "SL-002", invoiceNo: "INV-2024-0848", customerName: "Sarah Johnson", items: 1, subtotal: 1199.00, tax: 191.84, discount: 50, total: 1340.84, paid: 1340.84, due: 0, paymentMethod: "card", status: "completed", branch: "Main Store", cashier: "Jane Smith", date: "2024-12-10" },
  { id: "SL-003", invoiceNo: "INV-2024-0849", customerName: "Michael Chen", items: 5, subtotal: 876.00, tax: 140.16, discount: 0, total: 1016.16, paid: 500, due: 516.16, paymentMethod: "credit", status: "pending", branch: "Downtown Branch", cashier: "John Doe", date: "2024-12-09" },
  { id: "SL-004", invoiceNo: "INV-2024-0850", customerName: "Emily Davis", items: 2, subtotal: 448.00, tax: 71.68, discount: 20, total: 499.68, paid: 499.68, due: 0, paymentMethod: "mobile", status: "completed", branch: "Main Store", cashier: "Jane Smith", date: "2024-12-09" },
  { id: "SL-005", invoiceNo: "INV-2024-0851", customerName: "Robert Wilson", items: 1, subtotal: 2499.00, tax: 399.84, discount: 0, total: 2898.84, paid: 0, due: 2898.84, paymentMethod: "credit", status: "pending", branch: "Mall Outlet", cashier: "Alex Brown", date: "2024-12-08" },
  { id: "SL-006", invoiceNo: "INV-2024-0852", customerName: "Walk-in Customer", items: 4, subtotal: 326.00, tax: 52.16, discount: 0, total: 378.16, paid: 378.16, due: 0, paymentMethod: "cash", status: "completed", branch: "Main Store", cashier: "John Doe", date: "2024-12-08" },
  { id: "SL-007", invoiceNo: "INV-2024-0853", customerName: "Lisa Anderson", items: 2, subtotal: 1548.00, tax: 247.68, discount: 100, total: 1695.68, paid: 1695.68, due: 0, paymentMethod: "bank", status: "completed", branch: "Downtown Branch", cashier: "Jane Smith", date: "2024-12-07" },
  { id: "SL-008", invoiceNo: "INV-2024-0854", customerName: "David Kim", items: 1, subtotal: 349.00, tax: 55.84, discount: 0, total: 404.84, paid: 404.84, due: 0, paymentMethod: "card", status: "refunded", branch: "Main Store", cashier: "Alex Brown", date: "2024-12-07" },
  { id: "SL-009", invoiceNo: "INV-2024-0855", customerName: "Walk-in Customer", items: 6, subtotal: 594.00, tax: 95.04, discount: 30, total: 659.04, paid: 659.04, due: 0, paymentMethod: "cash", status: "completed", branch: "Mall Outlet", cashier: "John Doe", date: "2024-12-06" },
  { id: "SL-010", invoiceNo: "INV-2024-0856", customerName: "Jennifer Lopez", items: 3, subtotal: 2147.00, tax: 343.52, discount: 0, total: 2490.52, paid: 1000, due: 1490.52, paymentMethod: "credit", status: "pending", branch: "Main Store", cashier: "Jane Smith", date: "2024-12-06" },
  { id: "SL-011", invoiceNo: "INV-2024-0857", customerName: "Walk-in Customer", items: 2, subtotal: 148.00, tax: 23.68, discount: 0, total: 171.68, paid: 171.68, due: 0, paymentMethod: "mobile", status: "completed", branch: "Downtown Branch", cashier: "Alex Brown", date: "2024-12-05" },
  { id: "SL-012", invoiceNo: "INV-2024-0858", customerName: "Mark Taylor", items: 1, subtotal: 899.00, tax: 143.84, discount: 0, total: 1042.84, paid: 0, due: 1042.84, paymentMethod: "credit", status: "cancelled", branch: "Main Store", cashier: "John Doe", date: "2024-12-05" },
  { id: "SL-013", invoiceNo: "INV-2024-0859", customerName: "Susan White", items: 4, subtotal: 1236.00, tax: 197.76, discount: 60, total: 1373.76, paid: 1373.76, due: 0, paymentMethod: "card", status: "completed", branch: "Mall Outlet", cashier: "Jane Smith", date: "2024-12-04" },
  { id: "SL-014", invoiceNo: "INV-2024-0860", customerName: "Walk-in Customer", items: 2, subtotal: 98.00, tax: 15.68, discount: 0, total: 113.68, paid: 113.68, due: 0, paymentMethod: "cash", status: "completed", branch: "Main Store", cashier: "Alex Brown", date: "2024-12-04" },
  { id: "SL-015", invoiceNo: "INV-2024-0861", customerName: "Patricia Green", items: 3, subtotal: 747.00, tax: 119.52, discount: 0, total: 866.52, paid: 866.52, due: 0, paymentMethod: "bank", status: "completed", branch: "Downtown Branch", cashier: "John Doe", date: "2024-12-03" },
];
