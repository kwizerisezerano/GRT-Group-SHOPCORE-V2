import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  Globe2,
  Headphones,
  Laptop,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Network,
  PackageCheck,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InquiryStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "converted"
  | "closed"
  | "rejected"
  | "spam";

type InquiryPriority = "low" | "normal" | "high" | "urgent";

type SalesInquiry = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  city: string | null;
  business_type: string;
  current_software: string | null;
  employee_count: number | null;
  branch_count: number | null;
  warehouse_count: number | null;
  monthly_transactions: string | null;
  preferred_timeline: string | null;
  deployment_model: string;
  modules: string[];
  needs_offline: boolean;
  needs_desktop: boolean;
  needs_ebm: boolean;
  needs_migration: boolean;
  message: string;
  consent_given: boolean;
  source: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  assigned_to: string | null;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  qualified_at: string | null;
  converted_at: string | null;
  closed_at: string | null;
  internal_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type SalesInquiryEvent = {
  id: string;
  inquiry_id: string;
  actor_user_id: string | null;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  previous_priority: string | null;
  new_priority: string | null;
  notes: string | null;
  created_at: string;
};

type StatusFilter = InquiryStatus | "all";
type PriorityFilter = InquiryPriority | "all";

const STATUS_OPTIONS: Array<{
  value: InquiryStatus;
  label: string;
  className: string;
}> = [
  {
    value: "new",
    label: "New",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "reviewing",
    label: "Reviewing",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  {
    value: "contacted",
    label: "Contacted",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  {
    value: "qualified",
    label: "Qualified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    value: "proposal",
    label: "Proposal",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  {
    value: "negotiation",
    label: "Negotiation",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    value: "converted",
    label: "Converted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "closed",
    label: "Closed",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "rejected",
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  {
    value: "spam",
    label: "Spam",
    className: "border-slate-300 bg-slate-200 text-slate-700",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: InquiryPriority;
  label: string;
  className: string;
}> = [
  {
    value: "low",
    label: "Low",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "normal",
    label: "Normal",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "high",
    label: "High",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    value: "urgent",
    label: "Urgent",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
];

const TIMELINE_LABELS: Record<string, string> = {
  immediate: "As soon as possible",
  one_month: "Within one month",
  three_months: "Within three months",
  six_months: "Within six months",
  planning: "Still planning",
};

const TRANSACTION_LABELS: Record<string, string> = {
  under_1000: "Under 1,000",
  "1000_5000": "1,000–5,000",
  "5000_20000": "5,000–20,000",
  "20000_100000": "20,000–100,000",
  over_100000: "More than 100,000",
};

const DEPLOYMENT_LABELS: Record<string, string> = {
  cloud: "Cloud",
  desktop: "Desktop",
  hybrid: "Hybrid",
  "multi-branch": "Multi-branch",
  "multi-company": "Multi-company",
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Retail store",
  supermarket: "Supermarket",
  wholesale: "Wholesale",
  distribution: "Distribution",
  pharmacy: "Pharmacy",
  hardware: "Hardware store",
  hospitality: "Hospitality",
  services: "Professional services",
  other: "Other",
};

const statusStyle = (status: InquiryStatus) =>
  STATUS_OPTIONS.find((item) => item.value === status) ?? STATUS_OPTIONS[0];

const priorityStyle = (priority: InquiryPriority) =>
  PRIORITY_OPTIONS.find((item) => item.value === priority) ??
  PRIORITY_OPTIONS[1];

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const buildCsvValue = (value: unknown) => {
  const text = Array.isArray(value)
    ? value.join(", ")
    : value === null || value === undefined
      ? ""
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
};

async function fetchSalesInquiries() {
  const { data, error } = await (supabase as any)
    .from("sales_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as SalesInquiry[];
}

async function fetchInquiryEvents(inquiryId: string) {
  const { data, error } = await (supabase as any)
    .from("sales_inquiry_events")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Unable to load sales enquiry history:", error);
    return [];
  }

  return (data ?? []) as SalesInquiryEvent[];
}

export default function SalesInquiries() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("all");
  const [selectedInquiry, setSelectedInquiry] =
    useState<SalesInquiry | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [deleteInquiry, setDeleteInquiry] =
    useState<SalesInquiry | null>(null);

  const inquiriesQuery = useQuery({
    queryKey: ["platform-sales-inquiries"],
    queryFn: fetchSalesInquiries,
  });

  const eventsQuery = useQuery({
    queryKey: ["platform-sales-inquiry-events", selectedInquiry?.id],
    queryFn: () => fetchInquiryEvents(selectedInquiry!.id),
    enabled: Boolean(selectedInquiry?.id),
  });

  const inquiries = inquiriesQuery.data ?? [];

  const filteredInquiries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const matchesSearch =
        !query ||
        [
          inquiry.company_name,
          inquiry.contact_name,
          inquiry.email,
          inquiry.phone,
          inquiry.country,
          inquiry.city,
          inquiry.business_type,
          inquiry.current_software,
          inquiry.message,
          ...(inquiry.modules ?? []),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" || inquiry.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || inquiry.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [inquiries, priorityFilter, search, statusFilter]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    return {
      total: inquiries.length,
      new: inquiries.filter((item) => item.status === "new").length,
      active: inquiries.filter((item) =>
        [
          "reviewing",
          "contacted",
          "qualified",
          "proposal",
          "negotiation",
        ].includes(item.status),
      ).length,
      converted: inquiries.filter((item) => item.status === "converted")
        .length,
      urgent: inquiries.filter((item) => item.priority === "urgent").length,
      recent: inquiries.filter(
        (item) => new Date(item.created_at).getTime() >= sevenDaysAgo,
      ).length,
    };
  }, [inquiries]);

  const updateInquiryMutation = useMutation({
    mutationFn: async ({
      inquiry,
      updates,
      eventType,
      eventNotes,
    }: {
      inquiry: SalesInquiry;
      updates: Partial<SalesInquiry>;
      eventType: string;
      eventNotes?: string;
    }) => {
      const now = new Date().toISOString();

      const lifecycleUpdates: Partial<SalesInquiry> = { ...updates };

      if (
        updates.status === "contacted" &&
        !inquiry.first_contacted_at
      ) {
        lifecycleUpdates.first_contacted_at = now;
      }

      if (updates.status === "contacted") {
        lifecycleUpdates.last_contacted_at = now;
      }

      if (updates.status === "qualified") {
        lifecycleUpdates.qualified_at = now;
      }

      if (updates.status === "converted") {
        lifecycleUpdates.converted_at = now;
      }

      if (
        updates.status === "closed" ||
        updates.status === "rejected" ||
        updates.status === "spam"
      ) {
        lifecycleUpdates.closed_at = now;
      }

      const { data, error } = await (supabase as any)
        .from("sales_inquiries")
        .update(lifecycleUpdates)
        .eq("id", inquiry.id)
        .select("*")
        .single();

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const eventPayload = {
        inquiry_id: inquiry.id,
        actor_user_id: user?.id ?? null,
        event_type: eventType,
        previous_status: inquiry.status,
        new_status:
          typeof updates.status === "string"
            ? updates.status
            : inquiry.status,
        previous_priority: inquiry.priority,
        new_priority:
          typeof updates.priority === "string"
            ? updates.priority
            : inquiry.priority,
        notes: eventNotes?.trim() || null,
      };

      const { error: eventError } = await (supabase as any)
        .from("sales_inquiry_events")
        .insert(eventPayload);

      if (eventError) {
        console.warn("Sales enquiry event was not recorded:", eventError);
      }

      return data as SalesInquiry;
    },
    onSuccess: async (updated) => {
      toast.success("Sales enquiry updated successfully.");

      setSelectedInquiry(updated);
      setNotes(updated.internal_notes ?? "");
      setRejectionReason(updated.rejection_reason ?? "");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["platform-sales-inquiries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["platform-sales-inquiry-events", updated.id],
        }),
      ]);
    },
    onError: (error: any) => {
      console.error("Failed to update sales enquiry:", error);
      toast.error(
        error?.message || "The sales enquiry could not be updated.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (inquiry: SalesInquiry) => {
      const { error } = await (supabase as any)
        .from("sales_inquiries")
        .delete()
        .eq("id", inquiry.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Sales enquiry deleted.");
      setDeleteInquiry(null);

      if (selectedInquiry?.id === deleteInquiry?.id) {
        setSelectedInquiry(null);
      }

      await queryClient.invalidateQueries({
        queryKey: ["platform-sales-inquiries"],
      });
    },
    onError: (error: any) => {
      console.error("Failed to delete sales enquiry:", error);
      toast.error(
        error?.message ||
          "Only rejected or spam enquiries can be deleted.",
      );
    },
  });

  const openInquiry = (inquiry: SalesInquiry) => {
    setSelectedInquiry(inquiry);
    setNotes(inquiry.internal_notes ?? "");
    setRejectionReason(inquiry.rejection_reason ?? "");
  };

  const updateStatus = (status: InquiryStatus) => {
    if (!selectedInquiry || status === selectedInquiry.status) return;

    const eventType =
      status === "contacted"
        ? "contacted"
        : status === "qualified"
          ? "qualified"
          : status === "proposal"
            ? "proposal_created"
            : status === "converted"
              ? "converted"
              : status === "closed"
                ? "closed"
                : status === "rejected"
                  ? "rejected"
                  : status === "spam"
                    ? "marked_spam"
                    : "status_changed";

    updateInquiryMutation.mutate({
      inquiry: selectedInquiry,
      updates: {
        status,
        rejection_reason:
          status === "rejected"
            ? rejectionReason.trim() || null
            : selectedInquiry.rejection_reason,
      },
      eventType,
      eventNotes:
        status === "rejected"
          ? rejectionReason.trim() || "Enquiry rejected."
          : `Status changed to ${statusStyle(status).label}.`,
    });
  };

  const updatePriority = (priority: InquiryPriority) => {
    if (!selectedInquiry || priority === selectedInquiry.priority) return;

    updateInquiryMutation.mutate({
      inquiry: selectedInquiry,
      updates: { priority },
      eventType: "priority_changed",
      eventNotes: `Priority changed to ${priorityStyle(priority).label}.`,
    });
  };

  const saveNotes = () => {
    if (!selectedInquiry) return;

    updateInquiryMutation.mutate({
      inquiry: selectedInquiry,
      updates: {
        internal_notes: notes.trim() || null,
      },
      eventType: "note_added",
      eventNotes: notes.trim() || "Internal notes cleared.",
    });
  };

  const exportInquiries = () => {
    const headers = [
      "Company",
      "Contact",
      "Email",
      "Phone",
      "Country",
      "City",
      "Business Type",
      "Status",
      "Priority",
      "Deployment",
      "Modules",
      "Branches",
      "Warehouses",
      "Employees",
      "Timeline",
      "Offline",
      "Desktop",
      "EBM",
      "Migration",
      "Created",
    ];

    const rows = filteredInquiries.map((inquiry) => [
      inquiry.company_name,
      inquiry.contact_name,
      inquiry.email,
      inquiry.phone,
      inquiry.country,
      inquiry.city,
      inquiry.business_type,
      inquiry.status,
      inquiry.priority,
      inquiry.deployment_model,
      inquiry.modules,
      inquiry.branch_count,
      inquiry.warehouse_count,
      inquiry.employee_count,
      inquiry.preferred_timeline,
      inquiry.needs_offline,
      inquiry.needs_desktop,
      inquiry.needs_ebm,
      inquiry.needs_migration,
      inquiry.created_at,
    ]);

    const csv = [
      headers.map(buildCsvValue).join(","),
      ...rows.map((row) => row.map(buildCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `shopcore_sales_inquiries_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success("Sales enquiries exported.");
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid max-h-[calc(100vh-13rem)] gap-0 overflow-y-auto xl:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                  <CircleDollarSign className="h-4 w-4" />
                  Enterprise Sales Operations
                </span>

                {metrics.urgent > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
                    <AlertTriangle className="h-4 w-4" />
                    {metrics.urgent} urgent
                  </span>
                ) : null}
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                Sales Enquiries
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-600">
                Review prospective customers, qualify implementation
                requirements, manage commercial stages, prioritize follow-up,
                preserve internal notes, and track conversion across the
                ShopCore sales pipeline.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => inquiriesQuery.refetch()}
                  variant="outline"
                  className="gap-2"
                  disabled={inquiriesQuery.isFetching}
                >
                  <RefreshCcw
                    className={[
                      "h-4 w-4",
                      inquiriesQuery.isFetching ? "animate-spin" : "",
                    ].join(" ")}
                  />
                  Refresh
                </Button>

                <Button
                  type="button"
                  onClick={exportInquiries}
                  variant="outline"
                  className="gap-2"
                  disabled={filteredInquiries.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#050816] p-6 text-white sm:p-8">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
              <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />

              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Sales pipeline posture
                </p>

                <h2 className="mt-3 text-xl font-black">
                  Commercial opportunity control
                </h2>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <PipelineMetric
                    label="New"
                    value={metrics.new}
                    icon={MessageSquare}
                    tone="blue"
                  />
                  <PipelineMetric
                    label="Active"
                    value={metrics.active}
                    icon={RefreshCcw}
                    tone="cyan"
                  />
                  <PipelineMetric
                    label="Converted"
                    value={metrics.converted}
                    icon={BadgeCheck}
                    tone="emerald"
                  />
                  <PipelineMetric
                    label="Last 7 days"
                    value={metrics.recent}
                    icon={CalendarDays}
                    tone="violet"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Total enquiries"
            value={metrics.total}
            detail="All recorded opportunities"
            icon={MessageSquare}
            tone="blue"
          />
          <MetricCard
            title="New enquiries"
            value={metrics.new}
            detail="Awaiting initial review"
            icon={Mail}
            tone="cyan"
          />
          <MetricCard
            title="Active pipeline"
            value={metrics.active}
            detail="Under sales engagement"
            icon={Network}
            tone="violet"
          />
          <MetricCard
            title="Converted"
            value={metrics.converted}
            detail="Successful opportunities"
            icon={BadgeCheck}
            tone="emerald"
          />
          <MetricCard
            title="Urgent follow-up"
            value={metrics.urgent}
            detail="High attention required"
            icon={AlertTriangle}
            tone="rose"
          />
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, contact, email, country, module, or requirement..."
                className="h-11 pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as PriorityFilter)
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="all">All priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Opportunity pipeline
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {filteredInquiries.length} of {inquiries.length} enquiries
              </p>
            </div>

            {(search ||
              statusFilter !== "all" ||
              priorityFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-950"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>

          {inquiriesQuery.isLoading ? (
            <div className="flex min-h-[340px] items-center justify-center">
              <div className="text-center">
                <RefreshCcw className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-bold text-slate-500">
                  Loading sales enquiries...
                </p>
              </div>
            </div>
          ) : inquiriesQuery.isError ? (
            <div className="flex min-h-[340px] items-center justify-center p-6">
              <div className="max-w-md text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  Enquiries could not be loaded
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  Check the `sales_inquiries` table, RLS policies, and Platform
                  Admin authorization.
                </p>
                <Button
                  type="button"
                  onClick={() => inquiriesQuery.refetch()}
                  className="mt-5"
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="flex min-h-[340px] items-center justify-center p-6">
              <div className="max-w-md text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  No matching enquiries
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  New Contact Sales submissions will appear here after they
                  pass the public insertion policy.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredInquiries.map((inquiry) => {
                const status = statusStyle(inquiry.status);
                const priority = priorityStyle(inquiry.priority);

                return (
                  <button
                    key={inquiry.id}
                    type="button"
                    onClick={() => openInquiry(inquiry)}
                    className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1.2fr_0.8fr_0.72fr_0.55fr_auto] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-sm font-black text-blue-700">
                        {getInitials(inquiry.company_name)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {inquiry.company_name}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                          {inquiry.contact_name} · {inquiry.email}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-black text-slate-700">
                        {BUSINESS_TYPE_LABELS[inquiry.business_type] ??
                          inquiry.business_type}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {inquiry.city
                          ? `${inquiry.city}, ${inquiry.country}`
                          : inquiry.country}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black text-slate-700">
                        {DEPLOYMENT_LABELS[inquiry.deployment_model] ??
                          inquiry.deployment_model}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {inquiry.modules?.slice(0, 2).join(", ") ||
                          "No modules"}
                        {inquiry.modules?.length > 2
                          ? ` +${inquiry.modules.length - 2}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-black",
                          status.className,
                        ].join(" ")}
                      >
                        {status.label}
                      </span>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-black",
                          priority.className,
                        ].join(" ")}
                      >
                        {priority.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatDate(inquiry.created_at)}
                      </span>

                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(selectedInquiry)}
        onOpenChange={(open) => {
          if (!open) setSelectedInquiry(null);
        }}
      >
        <DialogContent className="top-[calc(50%+2.5rem)] z-[120] max-h-[calc(100vh-7rem)] max-w-6xl overflow-hidden p-0">
          {selectedInquiry ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  Sales enquiry from {selectedInquiry.company_name}
                </DialogTitle>
                <DialogDescription>
                  Review and manage this ShopCore sales opportunity.
                </DialogDescription>
              </DialogHeader>

              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-lg font-black text-blue-700">
                      {getInitials(selectedInquiry.company_name)}
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                        Sales opportunity
                      </p>

                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                        {selectedInquiry.company_name}
                      </h2>

                      <p className="mt-2 text-sm font-medium text-slate-500">
                        Submitted {formatDate(selectedInquiry.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </a>

                    <a
                      href={`tel:${selectedInquiry.phone}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1220] px-4 text-sm font-black text-white transition hover:bg-[#111827]"
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid max-h-[calc(100vh-13rem)] gap-0 overflow-y-auto xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6 p-5 sm:p-6">
                  <DetailSection title="Contact and organization">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailItem
                        icon={UserRound}
                        label="Contact person"
                        value={selectedInquiry.contact_name}
                      />
                      <DetailItem
                        icon={Mail}
                        label="Email"
                        value={selectedInquiry.email}
                      />
                      <DetailItem
                        icon={Phone}
                        label="Telephone"
                        value={selectedInquiry.phone}
                      />
                      <DetailItem
                        icon={Globe2}
                        label="Location"
                        value={
                          selectedInquiry.city
                            ? `${selectedInquiry.city}, ${selectedInquiry.country}`
                            : selectedInquiry.country
                        }
                      />
                      <DetailItem
                        icon={Store}
                        label="Business type"
                        value={
                          BUSINESS_TYPE_LABELS[
                            selectedInquiry.business_type
                          ] ?? selectedInquiry.business_type
                        }
                      />
                      <DetailItem
                        icon={Laptop}
                        label="Current software"
                        value={
                          selectedInquiry.current_software || "Not provided"
                        }
                      />
                    </div>
                  </DetailSection>

                  <DetailSection title="Business footprint">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <StatItem
                        icon={UsersRound}
                        label="Employees"
                        value={selectedInquiry.employee_count}
                      />
                      <StatItem
                        icon={Building2}
                        label="Branches"
                        value={selectedInquiry.branch_count}
                      />
                      <StatItem
                        icon={Warehouse}
                        label="Warehouses"
                        value={selectedInquiry.warehouse_count}
                      />
                      <StatItem
                        icon={PackageCheck}
                        label="Transactions"
                        value={
                          TRANSACTION_LABELS[
                            selectedInquiry.monthly_transactions ?? ""
                          ] ??
                          selectedInquiry.monthly_transactions ??
                          "Not provided"
                        }
                      />
                    </div>
                  </DetailSection>

                  <DetailSection title="Solution requirements">
                    <div className="flex flex-wrap gap-2">
                      {(selectedInquiry.modules ?? []).map((module) => (
                        <span
                          key={module}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"
                        >
                          {module}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <RequirementItem
                        label="Offline operation"
                        active={selectedInquiry.needs_offline}
                      />
                      <RequirementItem
                        label="Windows desktop"
                        active={selectedInquiry.needs_desktop}
                      />
                      <RequirementItem
                        label="Rwanda EBM/VSDC"
                        active={selectedInquiry.needs_ebm}
                      />
                      <RequirementItem
                        label="Data migration"
                        active={selectedInquiry.needs_migration}
                      />
                    </div>
                  </DetailSection>

                  <DetailSection title="Deployment plan">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailItem
                        icon={Network}
                        label="Deployment model"
                        value={
                          DEPLOYMENT_LABELS[
                            selectedInquiry.deployment_model
                          ] ?? selectedInquiry.deployment_model
                        }
                      />
                      <DetailItem
                        icon={Clock3}
                        label="Preferred timeline"
                        value={
                          TIMELINE_LABELS[
                            selectedInquiry.preferred_timeline ?? ""
                          ] ??
                          selectedInquiry.preferred_timeline ??
                          "Not provided"
                        }
                      />
                    </div>
                  </DetailSection>

                  <DetailSection title="Business requirements">
                    <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600">
                      {selectedInquiry.message}
                    </p>
                  </DetailSection>

                  <DetailSection title="Activity history">
                    {eventsQuery.isLoading ? (
                      <p className="text-sm font-medium text-slate-500">
                        Loading activity history...
                      </p>
                    ) : (eventsQuery.data ?? []).length === 0 ? (
                      <p className="text-sm font-medium text-slate-500">
                        No recorded lifecycle events yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(eventsQuery.data ?? []).map((event) => (
                          <div
                            key={event.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black capitalize text-slate-900">
                                  {event.event_type.replace(/_/g, " ")}
                                </p>
                                {event.notes ? (
                                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                                    {event.notes}
                                  </p>
                                ) : null}
                              </div>

                              <span className="text-[10px] font-bold text-slate-400">
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailSection>
                </div>

                <aside className="space-y-6 border-t border-slate-200 bg-slate-50 p-5 sm:p-6 xl:border-l xl:border-t-0">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-black text-slate-950">
                      Pipeline controls
                    </h3>

                    <label className="mt-5 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Status
                      </span>

                      <select
                        value={selectedInquiry.status}
                        onChange={(event) =>
                          updateStatus(
                            event.target.value as InquiryStatus,
                          )
                        }
                        disabled={updateInquiryMutation.isPending}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-400"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-4 block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Priority
                      </span>

                      <select
                        value={selectedInquiry.priority}
                        onChange={(event) =>
                          updatePriority(
                            event.target.value as InquiryPriority,
                          )
                        }
                        disabled={updateInquiryMutation.isPending}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400"
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option
                            key={priority.value}
                            value={priority.value}
                          >
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedInquiry.status === "rejected" ? (
                      <label className="mt-4 block">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Rejection reason
                        </span>

                        <Textarea
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(event.target.value)
                          }
                          rows={4}
                          className="mt-2"
                          placeholder="Explain why this opportunity was rejected..."
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-black text-slate-950">
                      Internal notes
                    </h3>

                    <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                      Notes are visible only to authorized Platform Admin
                      personnel.
                    </p>

                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={7}
                      className="mt-4"
                      placeholder="Qualification notes, commercial observations, implementation risks, next steps..."
                    />

                    <Button
                      type="button"
                      onClick={saveNotes}
                      disabled={updateInquiryMutation.isPending}
                      className="mt-4 w-full"
                    >
                      Save internal notes
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-black text-slate-950">
                      Lifecycle timestamps
                    </h3>

                    <div className="mt-4 space-y-3">
                      <LifecycleRow
                        label="First contacted"
                        value={selectedInquiry.first_contacted_at}
                      />
                      <LifecycleRow
                        label="Last contacted"
                        value={selectedInquiry.last_contacted_at}
                      />
                      <LifecycleRow
                        label="Qualified"
                        value={selectedInquiry.qualified_at}
                      />
                      <LifecycleRow
                        label="Converted"
                        value={selectedInquiry.converted_at}
                      />
                      <LifecycleRow
                        label="Closed"
                        value={selectedInquiry.closed_at}
                      />
                    </div>
                  </div>

                  {["rejected", "spam"].includes(
                    selectedInquiry.status,
                  ) ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                      <Trash2 className="h-5 w-5 text-rose-700" />

                      <h3 className="mt-3 text-sm font-black text-rose-950">
                        Delete enquiry
                      </h3>

                      <p className="mt-2 text-xs font-medium leading-5 text-rose-800">
                        Only rejected and spam enquiries can be permanently
                        deleted.
                      </p>

                      <Button
                        type="button"
                        variant="destructive"
                        className="mt-4 w-full"
                        onClick={() =>
                          setDeleteInquiry(selectedInquiry)
                        }
                      >
                        Delete enquiry
                      </Button>
                    </div>
                  ) : null}
                </aside>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteInquiry)}
        onOpenChange={(open) => {
          if (!open) setDeleteInquiry(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete sales enquiry?</DialogTitle>
            <DialogDescription>
              This permanently removes the enquiry and its event history. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-950">
              {deleteInquiry?.company_name}
            </p>
            <p className="mt-1 text-xs font-medium text-rose-800">
              {deleteInquiry?.contact_name} · {deleteInquiry?.email}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteInquiry(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteInquiry) {
                  deleteMutation.mutate(deleteInquiry);
                }
              }}
            >
              {deleteMutation.isPending
                ? "Deleting..."
                : "Delete permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  icon: typeof MessageSquare;
  tone: "blue" | "cyan" | "violet" | "emerald" | "rose";
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={[
          "flex h-10 w-10 items-center justify-center rounded-xl border",
          tones[tone],
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-5 text-2xl font-black text-slate-950">{value}</p>
      <h2 className="mt-1 text-sm font-black text-slate-800">{title}</h2>
      <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
    </article>
  );
}

function PipelineMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof MessageSquare;
  tone: "blue" | "cyan" | "emerald" | "violet";
}) {
  const tones = {
    blue: "text-blue-300",
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    violet: "text-violet-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="flex items-center justify-between">
        <Icon className={["h-4 w-4", tones[tone]].join(" ")} />
        <span className="text-xl font-black text-white">{value}</span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-blue-700" />
      <p className="mt-3 text-lg font-black text-slate-950">
        {value ?? "—"}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function RequirementItem({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between rounded-xl border px-4 py-3",
        active
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50",
      ].join(" ")}
    >
      <span className="text-sm font-bold text-slate-700">{label}</span>

      {active ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : (
        <span className="text-xs font-black text-slate-400">
          Not required
        </span>
      )}
    </div>
  );
}

function LifecycleRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="text-right text-xs font-black text-slate-700">
        {value ? formatDate(value) : "Pending"}
      </span>
    </div>
  );
}