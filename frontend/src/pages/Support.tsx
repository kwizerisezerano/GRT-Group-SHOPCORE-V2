import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  HelpCircle,
  Plus,
  Search,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Mail,
  Phone,
  Ticket,
  Send,
  Trash2,
  Eye,
  Headphones,
  Filter,
  UploadCloud,
  Database,
  RotateCcw,
  Pencil,
  Paperclip,
  Download,
  Timer,
  Bot,
  CalendarClock,
  BarChart3,
  Zap,
  Target,
  Star,
  X,
  FileText,
  Image as ImageIcon,
  FileArchive,
  UserPlus,
  Activity,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {  PageContainer,
  SectionCard,
  StatGrid,
  type StatItem,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "hsl(var(--primary))";

const BTN_PRIMARY = "h-10 rounded-xl bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary";
const BTN_SUCCESS = "h-10 rounded-xl bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700";
const BTN_WARNING = "h-10 rounded-xl bg-orange-600 px-4 text-white shadow-sm hover:bg-orange-700";
const BTN_DANGER = "h-10 rounded-xl bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-700";
const BTN_INFO = "h-10 rounded-xl bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary";
const BTN_PURPLE = "h-10 rounded-xl bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary";

const SUPPORT_CACHE_KEY = "support_tickets";
const SUPPORT_NOTES_CACHE_KEY = "support_ticket_notes";
const SUPPORT_ATTACHMENTS_CACHE_KEY = "support_ticket_attachments";
const SUPPORT_TIMELINE_CACHE_KEY = "support_ticket_timeline";

interface SupportAttachment {
  id: string;
  ticket_id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  created_at: string;
  sync_status?: "synced" | "pending" | "pending_delete";
}

interface SupportNote {
  id: string;
  ticket_id: string;
  note: string;
  internal: boolean;
  created_by?: string | null;
  created_at: string;
  sync_status?: "synced" | "pending" | "pending_update" | "pending_delete";
}

interface SupportTimelineItem {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  type: "created" | "updated" | "assigned" | "note" | "attachment" | "status" | "deleted";
  created_at: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "pending" | "resolved";
  message: string;
  createdAt: string;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string | null;
  user_id?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  sla_due_at?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  satisfaction?: number | null;
  operation?: "create" | "update" | "delete";
  sync_status?: "synced" | "pending" | "pending_update" | "pending_delete";
  created_offline_at?: string;
  updated_offline_at?: string;
}

const supportAgents = [
  "Unassigned",
  "Support Admin",
  "POS Specialist",
  "Inventory Specialist",
  "Finance Specialist",
  "EBM Specialist",
  "Developer Team",
];

const knowledgeArticles = [
  {
    title: "Fix POS receipt printing and long blank paper",
    category: "POS",
    level: "Popular",
    summary: "Check paper size, ESC/POS cut commands, browser print margins, and receipt width settings.",
  },
  {
    title: "Set up offline selling and sync recovery",
    category: "Offline Sync",
    level: "Enterprise",
    summary: "How offline records are cached, queued, and synced when internet returns.",
  },
  {
    title: "Configure RRA EBM / VSDC readiness",
    category: "EBM / Fiscal",
    level: "Compliance",
    summary: "Prepare certificates, taxpayer documents, test cases, and integration settings.",
  },
  {
    title: "Manage user roles and permissions",
    category: "Security",
    level: "Admin",
    summary: "Assign owner, admin, staff, and viewer roles without breaking module access.",
  },
  {
    title: "Inventory import, stock counts, and transfer checks",
    category: "Inventory",
    level: "Guide",
    summary: "Best practices for products, warehouses, branches, and reconciliation.",
  },
];

const initialTickets: SupportTicket[] = [
  {
    id: "TCK-1001",
    subject: "POS receipt printing setup",
    category: "POS",
    priority: "high",
    status: "open",
    message: "Need help configuring receipt printing for the POS module.",
    createdAt: "Today",
    created_at: new Date().toISOString(),
    assigned_to: "POS Specialist",
    sla_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    sync_status: "synced",
  },
  {
    id: "TCK-1002",
    subject: "Product image upload guide",
    category: "Inventory",
    priority: "medium",
    status: "pending",
    message: "Need clarification on product image storage and display.",
    createdAt: "Yesterday",
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    assigned_to: "Inventory Specialist",
    sla_due_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    sync_status: "synced",
  },
  {
    id: "TCK-1003",
    subject: "User role permissions",
    category: "Security",
    priority: "low",
    status: "resolved",
    message: "How do I assign admin and cashier access?",
    createdAt: "This week",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_to: "Support Admin",
    resolved_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    satisfaction: 98,
    sync_status: "synced",
  },
];

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function makeCacheKey(base: string, tenantId?: string | null) {
  return tenantId ? `${base}_${tenantId}` : base;
}

function isPendingSync(ticket: SupportTicket | SupportNote | SupportAttachment | any) {
  const status = String(ticket?.sync_status || "").toLowerCase();
  return (
    String(ticket?.id || "").startsWith("offline-") ||
    !!ticket?.created_offline_at ||
    !!ticket?.updated_offline_at ||
    status.includes("pending")
  );
}

function isDeletedTicket(ticket: SupportTicket | any) {
  return ticket?.operation === "delete" || ticket?.sync_status === "pending_delete";
}

function getTicketTime(ticket: SupportTicket) {
  const value = ticket.updated_offline_at || ticket.updated_at || ticket.created_offline_at || ticket.created_at || ticket.createdAt;
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortTickets(tickets: SupportTicket[]) {
  return [...tickets].sort((a, b) => getTicketTime(b) - getTicketTime(a));
}

function dedupeTickets(rows: SupportTicket[]) {
  const map = new Map<string, SupportTicket>();

  for (const row of rows || []) {
    const key = String(row.id || `${row.subject}-${row.createdAt}` || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    map.set(key, getTicketTime(row) >= getTicketTime(existing) ? { ...existing, ...row } : { ...row, ...existing });
  }

  return sortTickets(Array.from(map.values()).filter((ticket) => !isDeletedTicket(ticket)));
}

function formatTicketDate(ticket: SupportTicket) {
  if (ticket.createdAt && !ticket.createdAt.includes("T")) return ticket.createdAt;

  const value = ticket.created_at || ticket.created_offline_at || ticket.updated_offline_at || ticket.createdAt;
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ticket.createdAt || "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSlaHours(priority: SupportTicket["priority"]) {
  if (priority === "critical") return 2;
  if (priority === "high") return 6;
  if (priority === "medium") return 24;
  return 72;
}

function buildSlaDueAt(priority: SupportTicket["priority"]) {
  return new Date(Date.now() + getSlaHours(priority) * 60 * 60 * 1000).toISOString();
}

function getSlaStatus(ticket: SupportTicket) {
  if (ticket.status === "resolved") return "resolved";
  const due = ticket.sla_due_at ? new Date(ticket.sla_due_at).getTime() : 0;
  if (!due) return "not-set";
  const remaining = due - Date.now();
  if (remaining < 0) return "breached";
  if (remaining < 2 * 60 * 60 * 1000) return "warning";
  return "on-track";
}

function getPriorityBadge(priority: SupportTicket["priority"]) {
  if (priority === "critical") {
    return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">Critical</Badge>;
  }

  if (priority === "high") {
    return <Badge variant="outline" className="rounded-full border-orange-500/30 bg-orange-500/10 text-orange-600">High</Badge>;
  }

  if (priority === "medium") {
    return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Medium</Badge>;
  }

  return <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">Low</Badge>;
}

function getStatusBadge(status: SupportTicket["status"]) {
  if (status === "resolved") {
    return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Resolved</Badge>;
  }

  if (status === "pending") {
    return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Pending</Badge>;
  }

  return <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">Open</Badge>;
}

function getSlaBadge(ticket: SupportTicket) {
  const status = getSlaStatus(ticket);
  if (status === "resolved") {
    return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">SLA Met</Badge>;
  }
  if (status === "breached") {
    return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">SLA Breached</Badge>;
  }
  if (status === "warning") {
    return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Near Breach</Badge>;
  }
  if (status === "on-track") {
    return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">On Track</Badge>;
  }
  return <Badge variant="outline" className="rounded-full">SLA Not Set</Badge>;
}

function normalizeTicketForSave(ticket: SupportTicket, tenantId?: string | null, userId?: string | null) {
  const now = new Date().toISOString();
  const isOfflineTicket = String(ticket.id || "").startsWith("offline-");

  return {
    ...ticket,
    tenant_id: ticket.tenant_id || tenantId || null,
    user_id: ticket.user_id || userId || null,
    operation: isOfflineTicket ? "create" : ticket.operation || "update",
    sync_status: isOfflineTicket ? "pending" : ticket.sync_status || "pending_update",
    updated_at: now,
    updated_offline_at: now,
  } as SupportTicket;
}

function getAttachmentIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("zip") || type.includes("rar")) return FileArchive;
  return FileText;
}

function getAiSuggestion(ticket?: SupportTicket | null) {
  const text = `${ticket?.subject || ""} ${ticket?.message || ""} ${ticket?.category || ""}`.toLowerCase();
  if (!ticket) return "Select a ticket to generate a support suggestion.";
  if (text.includes("printer") || text.includes("receipt")) {
    return "Suggested fix: verify thermal paper width, browser print margins, printer driver, ESC/POS cut command, and receipt CSS width. Check if long blank paper is caused by page size mismatch.";
  }
  if (text.includes("offline") || text.includes("sync")) {
    return "Suggested fix: inspect pending queue records, confirm cached tenant/profile data, then retry sync after reconnect. Check duplicate IDs and failed Supabase operations.";
  }
  if (text.includes("ebm") || text.includes("vsdc") || text.includes("rra")) {
    return "Suggested fix: verify RRA VSDC credentials, taxpayer TIN, certificate status, payload signing, and test-case compliance before retrying fiscal receipt sync.";
  }
  if (text.includes("role") || text.includes("permission") || text.includes("user")) {
    return "Suggested fix: confirm tenant_members, user_roles, role_permissions, and RLS policies are aligned. Re-assign the role from User Management and refresh auth context.";
  }
  return "Suggested fix: collect steps to reproduce, screenshots, affected module, user role, browser/desktop version, and whether the issue happens online, offline, or after sync.";
}

export default function Support() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [timeline, setTimeline] = useState<SupportTimelineItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<SupportTicket | null>(null);
  const [editTicket, setEditTicket] = useState<SupportTicket | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteInternal, setNoteInternal] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<"knowledge" | "analytics" | "ai" | "channels">("knowledge");

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("medium");
  const [message, setMessage] = useState("");
  const [assignedTo, setAssignedTo] = useState("Unassigned");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;

  const ticketCacheKey = useMemo(() => makeCacheKey(SUPPORT_CACHE_KEY, tenantId), [tenantId]);
  const notesCacheKey = useMemo(() => makeCacheKey(SUPPORT_NOTES_CACHE_KEY, tenantId), [tenantId]);
  const attachmentsCacheKey = useMemo(() => makeCacheKey(SUPPORT_ATTACHMENTS_CACHE_KEY, tenantId), [tenantId]);
  const timelineCacheKey = useMemo(() => makeCacheKey(SUPPORT_TIMELINE_CACHE_KEY, tenantId), [tenantId]);

  const addTimeline = async (ticketId: string, title: string, description: string, type: SupportTimelineItem["type"]) => {
    const item: SupportTimelineItem = {
      id: makeLocalId("support-timeline"),
      ticket_id: ticketId,
      title,
      description,
      type,
      created_at: new Date().toISOString(),
    };
    const next = [item, ...timeline];
    setTimeline(next);
    await saveCachedTable(timelineCacheKey, next);
  };

  const saveTicketsToCache = async (nextTickets: SupportTicket[]) => {
    const clean = dedupeTickets(nextTickets);
    setTickets(clean);
    await saveCachedTable(ticketCacheKey, clean);
    await saveCachedTable(SUPPORT_CACHE_KEY, clean);

    queryClient.invalidateQueries({ queryKey: ["support"] }).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveNotesToCache = async (nextNotes: SupportNote[]) => {
    setNotes(nextNotes);
    await saveCachedTable(notesCacheKey, nextNotes);
  };

  const saveAttachmentsToCache = async (nextAttachments: SupportAttachment[]) => {
    setAttachments(nextAttachments);
    await saveCachedTable(attachmentsCacheKey, nextAttachments);
  };

  useEffect(() => {
    const loadCachedSupport = async () => {
      const [cachedTickets, cachedNotes, cachedAttachments, cachedTimeline] = await Promise.all([
        getCachedTable(ticketCacheKey),
        getCachedTable(notesCacheKey),
        getCachedTable(attachmentsCacheKey),
        getCachedTable(timelineCacheKey),
      ]);

      if (Array.isArray(cachedTickets) && cachedTickets.length > 0) {
        setTickets(dedupeTickets(cachedTickets as SupportTicket[]));
      } else {
        await saveCachedTable(ticketCacheKey, initialTickets);
      }

      if (Array.isArray(cachedNotes)) setNotes(cachedNotes as SupportNote[]);
      if (Array.isArray(cachedAttachments)) setAttachments(cachedAttachments as SupportAttachment[]);
      if (Array.isArray(cachedTimeline)) setTimeline(cachedTimeline as SupportTimelineItem[]);
    };

    loadCachedSupport().catch(() => undefined);
  }, [ticketCacheKey, notesCacheKey, attachmentsCacheKey, timelineCacheKey]);

  const stats = useMemo(() => {
    const activeTickets = tickets.filter((ticket) => !isDeletedTicket(ticket));
    const open = activeTickets.filter((ticket) => ticket.status === "open").length;
    const pending = activeTickets.filter((ticket) => ticket.status === "pending").length;
    const resolved = activeTickets.filter((ticket) => ticket.status === "resolved").length;
    const critical = activeTickets.filter((ticket) => ticket.priority === "critical" || ticket.priority === "high").length;
    const pendingSync = activeTickets.filter(isPendingSync).length + notes.filter(isPendingSync).length + attachments.filter(isPendingSync).length;
    const breached = activeTickets.filter((ticket) => getSlaStatus(ticket) === "breached").length;
    const nearBreach = activeTickets.filter((ticket) => getSlaStatus(ticket) === "warning").length;
    const assigned = activeTickets.filter((ticket) => ticket.assigned_to && ticket.assigned_to !== "Unassigned").length;
    const resolutionRate = activeTickets.length > 0 ? Math.round((resolved / activeTickets.length) * 100) : 0;
    const slaCompliant = activeTickets.length > 0 ? Math.round(((activeTickets.length - breached) / activeTickets.length) * 100) : 100;
    const avgSatisfaction = activeTickets.filter((ticket) => ticket.satisfaction).length > 0
      ? Math.round(activeTickets.reduce((sum, ticket) => sum + Number(ticket.satisfaction || 0), 0) / activeTickets.filter((ticket) => ticket.satisfaction).length)
      : 98;

    return {
      total: activeTickets.length,
      open,
      pending,
      resolved,
      avgResponse: offlineModeActive ? "Offline" : "2 hrs",
      satisfaction: `${avgSatisfaction}%`,
      critical,
      pendingSync,
      breached,
      nearBreach,
      assigned,
      resolutionRate,
      slaCompliant,
      attachmentCount: attachments.length,
      noteCount: notes.length,
    };
  }, [tickets, notes, attachments, offlineModeActive]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (isDeletedTicket(ticket)) return false;

      const q = search.toLowerCase();

      const matchesSearch =
        ticket.subject.toLowerCase().includes(q) ||
        ticket.category.toLowerCase().includes(q) ||
        ticket.message.toLowerCase().includes(q) ||
        ticket.priority.toLowerCase().includes(q) ||
        ticket.status.toLowerCase().includes(q) ||
        ticket.id.toLowerCase().includes(q) ||
        String(ticket.assigned_to || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const pendingStatus = isPendingSync(ticket);
      const matchesSync = syncFilter === "all" || (syncFilter === "pending" && pendingStatus) || (syncFilter === "synced" && !pendingStatus);

      return matchesSearch && matchesStatus && matchesPriority && matchesSync;
    });
  }, [tickets, search, statusFilter, priorityFilter, syncFilter]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    tickets.filter((ticket) => !isDeletedTicket(ticket)).forEach((ticket) => map.set(ticket.category, (map.get(ticket.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [tickets]);

  const priorityData = useMemo(() => {
    const active = tickets.filter((ticket) => !isDeletedTicket(ticket));
    return ["critical", "high", "medium", "low"].map((key) => ({
      key,
      count: active.filter((ticket) => ticket.priority === key).length,
    }));
  }, [tickets]);

  const resetForm = () => {
    setSubject("");
    setCategory("General");
    setPriority("medium");
    setMessage("");
    setAssignedTo("Unassigned");
    setEditTicket(null);
  };

  const openCreateTicket = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditTicket = (ticket: SupportTicket) => {
    setEditTicket(ticket);
    setSubject(ticket.subject);
    setCategory(ticket.category);
    setPriority(ticket.priority);
    setMessage(ticket.message);
    setAssignedTo(ticket.assigned_to || "Unassigned");
    setDialogOpen(true);
  };

  const createOrUpdateTicket = async () => {
    if (!subject.trim()) {
      toast.error("Ticket subject is required");
      return;
    }

    if (!message.trim()) {
      toast.error("Ticket message is required");
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editTicket) {
        const updatedTicket = normalizeTicketForSave(
          {
            ...editTicket,
            subject: subject.trim(),
            category,
            priority,
            message: message.trim(),
            assigned_to: assignedTo,
            assigned_by: assignedTo !== editTicket.assigned_to ? user?.id || null : editTicket.assigned_by,
            assigned_at: assignedTo !== editTicket.assigned_to ? now : editTicket.assigned_at,
            sla_due_at: editTicket.priority !== priority ? buildSlaDueAt(priority) : editTicket.sla_due_at,
          },
          tenantId,
          user?.id
        );

        await saveTicketsToCache(tickets.map((ticket) => (ticket.id === editTicket.id ? updatedTicket : ticket)));
        await savePending("support_tickets", updatedTicket);
        await addTimeline(editTicket.id, "Ticket updated", "Ticket details, assignment, or SLA settings were updated.", "updated");
        toast.success(offlineModeActive ? "Ticket updated offline. It will sync when internet returns." : "Ticket updated.");
      } else {
        const newTicket: SupportTicket = {
          id: makeLocalId("offline-ticket"),
          subject: subject.trim(),
          category,
          priority,
          status: "open",
          message: message.trim(),
          createdAt: now,
          created_at: now,
          tenant_id: tenantId || null,
          user_id: user?.id || null,
          assigned_to: assignedTo,
          assigned_by: assignedTo !== "Unassigned" ? user?.id || null : null,
          assigned_at: assignedTo !== "Unassigned" ? now : null,
          sla_due_at: buildSlaDueAt(priority),
          operation: "create",
          sync_status: "pending",
          created_offline_at: now,
          updated_offline_at: now,
        };

        await saveTicketsToCache([newTicket, ...tickets]);
        await savePending("support_tickets", newTicket);
        await addTimeline(newTicket.id, "Ticket created", `${category} support request created with ${priority} priority.`, "created");
        toast.success(offlineModeActive ? "Support ticket created offline. It will sync when internet returns." : "Support ticket created and queued.");
      }

      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      if (isNetworkError(error)) {
        toast.success("Saved locally. It will sync when internet returns.");
        setDialogOpen(false);
        resetForm();
        return;
      }

      toast.error(error?.message || "Failed to save ticket");
    }
  };

  const updateTicketStatus = async (id: string, status: SupportTicket["status"]) => {
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return;

    const updatedTicket = normalizeTicketForSave(
      {
        ...target,
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : target.resolved_at,
        first_response_at: target.first_response_at || new Date().toISOString(),
      },
      tenantId,
      user?.id
    );

    await saveTicketsToCache(tickets.map((ticket) => (ticket.id === id ? updatedTicket : ticket)));
    await savePending("support_tickets", updatedTicket);
    await addTimeline(id, "Status updated", `Ticket marked as ${status}.`, "status");

    toast.success(status === "resolved" ? "Ticket marked as resolved" : `Ticket marked as ${status}`);
  };

  const assignTicket = async (ticket: SupportTicket, agent: string) => {
    const updatedTicket = normalizeTicketForSave(
      {
        ...ticket,
        assigned_to: agent,
        assigned_by: user?.id || null,
        assigned_at: new Date().toISOString(),
      },
      tenantId,
      user?.id
    );

    await saveTicketsToCache(tickets.map((item) => (item.id === ticket.id ? updatedTicket : item)));
    await savePending("support_tickets", updatedTicket);
    await addTimeline(ticket.id, "Ticket assigned", `Assigned to ${agent}.`, "assigned");
    toast.success(`Ticket assigned to ${agent}`);
  };

  const deleteTicket = async (id: string) => {
    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return;

    if (String(id).startsWith("offline-")) {
      await saveTicketsToCache(tickets.filter((ticket) => ticket.id !== id));
      await addTimeline(id, "Ticket deleted", "Offline ticket deleted locally.", "deleted");
      toast.success("Offline ticket deleted locally");
      return;
    }

    const deletedTicket = normalizeTicketForSave(
      {
        ...target,
        operation: "delete",
        sync_status: "pending_delete",
      },
      tenantId,
      user?.id
    );

    await saveTicketsToCache(tickets.map((ticket) => (ticket.id === id ? deletedTicket : ticket)));
    await savePending("support_tickets", deletedTicket);
    await addTimeline(id, "Ticket deleted", "Ticket deletion queued for sync.", "deleted");
    toast.success("Ticket deletion queued for sync");
  };

  const addNote = async (ticket: SupportTicket) => {
    const cleanNote = noteText.trim();
    if (!cleanNote) {
      toast.error("Write a note first");
      return;
    }

    const note: SupportNote = {
      id: makeLocalId("support-note"),
      ticket_id: ticket.id,
      note: cleanNote,
      internal: noteInternal,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      sync_status: "pending",
    };

    await saveNotesToCache([note, ...notes]);
    await savePending("support_notes", note as any);
    await addTimeline(ticket.id, noteInternal ? "Internal note added" : "Reply note added", cleanNote, "note");
    setNoteText("");
    toast.success(noteInternal ? "Internal note saved" : "Reply note saved");
  };

  const addAttachments = async (files: FileList | null, ticket: SupportTicket | null) => {
    if (!files || !ticket) return;
    const now = new Date().toISOString();
    const newAttachments: SupportAttachment[] = Array.from(files).map((file) => ({
      id: makeLocalId("support-attachment"),
      ticket_id: ticket.id,
      name: file.name,
      type: file.type || "file",
      size: file.size,
      url: `offline://${file.name}`,
      created_at: now,
      sync_status: "pending",
    }));

    await saveAttachmentsToCache([...newAttachments, ...attachments]);
    for (const attachment of newAttachments) {
      await savePending("support_attachments", attachment as any);
      await addTimeline(ticket.id, "Attachment added", attachment.name, "attachment");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(`${newAttachments.length} attachment${newAttachments.length === 1 ? "" : "s"} saved offline and queued`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSyncFilter("all");
  };

  const selectedTicketNotes = viewTicket ? notes.filter((note) => note.ticket_id === viewTicket.id && note.sync_status !== "pending_delete") : [];
  const selectedTicketAttachments = viewTicket ? attachments.filter((attachment) => attachment.ticket_id === viewTicket.id && attachment.sync_status !== "pending_delete") : [];
  const selectedTicketTimeline = viewTicket ? timeline.filter((item) => item.ticket_id === viewTicket.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];

const statCards: StatItem[] = [
    { label: "Tickets", value: stats.total, icon: Ticket, tone: "indigo", helper: "all support cases" },
    {
      label: "Open",
      value: stats.open,
      icon: MessageCircle,
      tone: stats.open > 0 ? "amber" : "sky",
      helper: "awaiting a reply",
    },
    {
      label: "Resolved",
      value: stats.resolved,
      icon: CheckCircle2,
      tone: "emerald",
      helper: `${stats.resolutionRate}% resolution rate`,
    },
    {
      label: "SLA Risk",
      value: stats.breached + stats.nearBreach,
      icon: Timer,
      tone: stats.breached > 0 ? "rose" : stats.nearBreach > 0 ? "amber" : "teal",
      helper: `${stats.slaCompliant}% within SLA`,
    },
    {
      label: "Pending Sync",
      value: stats.pendingSync,
      icon: UploadCloud,
      tone: stats.pendingSync > 0 ? "amber" : "cyan",
      helper: "offline changes",
    },
  ];

    return (
    <PageBackground image={warehouseBg} opacity={0}>
      <PageShell title="Support" description="Raise, assign and resolve support tickets, with SLA tracking and a knowledge base.">
        <PageContainer>

          <StatGrid items={statCards} columns={5} />

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-[46px] flex-1 items-center gap-3 rounded-xl border border-border bg-background/90 px-4 shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input placeholder="Search ticket subject, category, message, agent, status, priority, or ID..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/40 text-foreground xl:w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-orange-500/25 bg-orange-500/10 text-orange-700 xl:w-44"><AlertTriangle className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/40 text-foreground xl:w-40"><Database className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Button className={BTN_WARNING} onClick={resetFilters}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
              <Button onClick={openCreateTicket} className={BTN_PRIMARY}><Plus className="mr-2 h-4 w-4" />New Ticket</Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {filteredTickets.length === 0 ? (
                <div className="rounded-3xl border border-border bg-muted/40 py-10 text-center text-foreground shadow-sm">
                  <HelpCircle className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p className="font-medium">No support tickets found</p>
                  <p className="text-sm">Create a new ticket when you need help.</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const ticketNotes = notes.filter((note) => note.ticket_id === ticket.id && note.sync_status !== "pending_delete").length;
                  const ticketAttachments = attachments.filter((attachment) => attachment.ticket_id === ticket.id && attachment.sync_status !== "pending_delete").length;
                  return (
                    <div key={ticket.id} className="overflow-hidden rounded-3xl border border-border bg-muted/40 shadow-sm transition hover:shadow-md">
                      <div className={`h-1.5 ${ticket.priority === "critical" ? "bg-rose-500" : ticket.priority === "high" ? "bg-orange-500" : ticket.priority === "medium" ? "bg-amber-500" : "bg-primary"}`} />
                      <div className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ticket.priority === "critical" ? "bg-rose-500/10 text-rose-600" : ticket.priority === "high" ? "bg-orange-500/10 text-orange-600" : ticket.priority === "medium" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-muted-foreground"}`}>
                              <Ticket className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-black">{ticket.subject}</h3>
                                {getStatusBadge(ticket.status)}
                                {getPriorityBadge(ticket.priority)}
                                {getSlaBadge(ticket)}
                                {isPendingSync(ticket) && <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground"><UploadCloud className="mr-1 h-3 w-3" />Pending Sync</Badge>}
                              </div>

                              <p className="text-sm leading-6 text-muted-foreground">{ticket.message}</p>

                              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">{ticket.id}</span>
                                <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">{ticket.category}</span>
                                <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">Agent: {ticket.assigned_to || "Unassigned"}</span>
                                <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">Due: {formatShortDate(ticket.sla_due_at)}</span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1"><CalendarClock className="h-3.5 w-3.5" />{formatTicketDate(ticket)}</span>
                                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1"><MessageCircle className="h-3.5 w-3.5" />{ticketNotes} notes</span>
                                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1"><Paperclip className="h-3.5 w-3.5" />{ticketAttachments} files</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <Select value={ticket.assigned_to || "Unassigned"} onValueChange={(value) => assignTicket(ticket, value)}>
                              <SelectTrigger className="h-9 w-[156px] rounded-xl text-xs"><UserPlus className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {supportAgents.map((agent) => <SelectItem key={agent} value={agent}>{agent}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            {ticket.status !== "resolved" && <Button size="icon" className="rounded-xl" onClick={() => updateTicketStatus(ticket.id, "resolved")} title="Mark resolved"><CheckCircle2 className="h-4 w-4" /></Button>}
                            <Button size="icon" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary" title="View" onClick={() => setViewTicket(ticket)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="rounded-xl" title="Edit" onClick={() => openEditTicket(ticket)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="icon" className="rounded-xl" onClick={() => deleteTicket(ticket.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border bg-card p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "knowledge", label: "Knowledge", icon: BookOpen },
                    { id: "analytics", label: "Analytics", icon: BarChart3 },
                    { id: "ai", label: "Guidance", icon: Target },
                    { id: "channels", label: "Channels", icon: Headphones },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeSideTab === tab.id;
                    return (
                      <button key={tab.id} type="button" onClick={() => setActiveSideTab(tab.id as typeof activeSideTab)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                        <Icon className="mx-auto mb-1 h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeSideTab === "knowledge" && (
                <SectionCard
                  icon={BookOpen}
                  title="Knowledge Base"
                  description="Smart help topics."
                >
                  <div className="space-y-3">
                    {knowledgeArticles.map((article) => (
                      <div key={article.title} className="rounded-xl border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-bold">{article.title}</p>
                          <Badge variant="outline" className="rounded-full text-[10px]">{article.level}</Badge>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">{article.summary}</p>
                        <p className="mt-2 text-[10px] font-semibold text-primary">{article.category}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {activeSideTab === "analytics" && (
                <div className="space-y-4">
                  <SectionCard
                    icon={BarChart3}
                    title="Priority Mix"
                  >
                    <div className="space-y-3">
                      {priorityData.map((item) => {
                        const percent = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                        return (
                          <div key={item.key}>
                            <div className="mb-1 flex justify-between text-xs"><span className="capitalize text-muted-foreground">{item.key}</span><span className="font-bold">{item.count}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Target}
                    tone="emerald"
                    title="Category Load"
                  >
                    <div className="space-y-3">
                      {categoryData.map(([name, count]) => {
                        const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                          <div key={name} className="rounded-xl border bg-muted/30 p-3">
                            <div className="mb-2 flex justify-between text-xs"><span>{name}</span><span className="font-bold">{count}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeSideTab === "ai" && (
                <SectionCard
                  icon={Target}
                  title="Support Guidance"
                  description="Local smart suggestions."
                >
                  <div className="rounded-xl border bg-muted/60 p-4 text-sm leading-6 text-foreground">
                    <Target className="mb-2 h-5 w-5" />
                    Select a ticket and open it to see contextual AI support guidance, possible causes, and recommended troubleshooting steps.
                  </div>
                  <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
                    Future upgrade: connect this panel to ShopCore diagnostics for live module checks, log analysis, and prepared support replies.
                  </div>
                </SectionCard>
              )}

              {activeSideTab === "channels" && (
                <div className="space-y-4">
                  <SectionCard
                    icon={Headphones}
                    title="Support Channels"
                  >
                    <div className="space-y-3">
                      {[
                        { label: "In-App Tickets", icon: MessageCircle, status: "Active" },
                        { label: "Email Support", icon: Mail, status: "Available" },
                        { label: "Phone Support", icon: Phone, status: "Pro Plan" },
                        { label: "Live Chat", icon: Zap, status: "Coming Soon" },
                      ].map((channel) => {
                        const Icon = channel.icon;
                        return (
                          <div key={channel.label} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-primary" />{channel.label}</div>
                            <Badge variant="outline" className="rounded-full">{channel.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Star}
                    tone="amber"
                    title="Priority Guide"
                  >
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Critical:</span> system down, data loss, login failure.</p>
                      <p><span className="font-semibold text-foreground">High:</span> POS, payment, or stock workflow blocked.</p>
                      <p><span className="font-semibold text-foreground">Medium:</span> feature issue or setup help.</p>
                      <p><span className="font-semibold text-foreground">Low:</span> general question or improvement request.</p>
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          </div>
        </PageContainer>

        <Dialog open={!!viewTicket} onOpenChange={() => { setViewTicket(null); setNoteText(""); }}>
          <DialogContent className="max-w-5xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewTicket?.subject}</DialogTitle>
              <DialogDescription>{viewTicket?.id} · {viewTicket ? formatTicketDate(viewTicket) : "—"}</DialogDescription>
            </DialogHeader>

            {viewTicket && (
              <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[1fr_340px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {getStatusBadge(viewTicket.status)}
                    {getPriorityBadge(viewTicket.priority)}
                    {getSlaBadge(viewTicket)}
                    {isPendingSync(viewTicket) && <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">Pending Sync</Badge>}
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="mb-2 text-xs text-muted-foreground">Message</p>
                    <p className="text-sm leading-6">{viewTicket.message}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Category</p><p className="font-bold">{viewTicket.category}</p></div>
                    <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Assigned To</p><p className="font-bold">{viewTicket.assigned_to || "Unassigned"}</p></div>
                    <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">SLA Due</p><p className="font-bold">{formatShortDate(viewTicket.sla_due_at)}</p></div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h4 className="font-bold">Attachments</h4></div>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()}><Paperclip className="mr-2 h-4 w-4" />Add File</Button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => addAttachments(event.target.files, viewTicket)} />
                    {selectedTicketAttachments.length === 0 ? (
                      <div className="rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">No attachments yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedTicketAttachments.map((attachment) => {
                          const Icon = getAttachmentIcon(attachment.type);
                          return (
                            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                                <div className="min-w-0"><p className="truncate text-sm font-semibold">{attachment.name}</p><p className="text-xs text-muted-foreground">{fileSize(attachment.size)} · {isPendingSync(attachment) ? "Pending upload" : "Uploaded"}</p></div>
                              </div>
                              <Button variant="ghost" size="icon" disabled={attachment.url.startsWith("offline://")}><Download className="h-4 w-4" /></Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><h4 className="font-bold">Notes & Replies</h4></div>
                    <Textarea className="min-h-[90px] rounded-xl" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add internal note or customer reply..." />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button variant={noteInternal ? "default" : "outline"} className="rounded-xl" style={noteInternal ? { background: NAVY } : undefined} onClick={() => setNoteInternal(!noteInternal)}>
                        {noteInternal ? "Internal Note" : "Customer Reply"}
                      </Button>
                      <Button className="rounded-xl" style={{ background: NAVY }} onClick={() => addNote(viewTicket)}><Send className="mr-2 h-4 w-4" />Save Note</Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {selectedTicketNotes.length === 0 ? (
                        <p className="rounded-xl bg-muted/30 p-3 text-center text-sm text-muted-foreground">No notes yet.</p>
                      ) : (
                        selectedTicketNotes.map((note) => (
                          <div key={note.id} className="rounded-xl border bg-muted/20 p-3">
                            <div className="mb-1 flex items-center justify-between"><Badge variant="outline" className="rounded-full">{note.internal ? "Internal" : "Reply"}</Badge><span className="text-[10px] text-muted-foreground">{formatShortDate(note.created_at)}</span></div>
                            <p className="text-sm leading-6">{note.note}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/60 p-4 text-foreground">
                    <div className="mb-2 flex items-center gap-2"><Bot className="h-4 w-4" /><p className="font-bold">AI Suggestion</p></div>
                    <p className="text-sm leading-6">{getAiSuggestion(viewTicket)}</p>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h4 className="font-bold">Ticket Timeline</h4></div>
                    <div className="space-y-3">
                      {selectedTicketTimeline.length === 0 ? (
                        <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">No timeline events yet.</div>
                      ) : (
                        selectedTicketTimeline.map((event) => (
                          <div key={event.id} className="relative border-l-2 border-primary/20 pl-4">
                            <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                            <p className="text-sm font-bold">{event.title}</p>
                            <p className="text-xs leading-5 text-muted-foreground">{event.description}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{formatShortDate(event.created_at)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              {viewTicket && viewTicket.status !== "resolved" && <Button variant="outline" onClick={() => { updateTicketStatus(viewTicket.id, "resolved"); setViewTicket(null); }}><CheckCircle2 className="mr-2 h-4 w-4" />Mark Resolved</Button>}
              <Button variant="outline" onClick={() => setViewTicket(null)}><X className="mr-2 h-4 w-4" />Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editTicket ? "Edit Support Ticket" : "New Support Ticket"}</DialogTitle>
              <DialogDescription>{editTicket ? "Update this support request. Offline updates are saved locally and synced later." : "Describe the issue, set priority, assign an owner, and create an SLA-tracked support request."}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Subject *</label>
                <Input className="rounded-xl border-border bg-muted/40 placeholder:text-muted-foreground" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Example: POS receipt printer not working" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="POS">POS</SelectItem>
                    <SelectItem value="Inventory">Inventory</SelectItem>
                    <SelectItem value="Reports">Reports</SelectItem>
                    <SelectItem value="Users & Roles">Users & Roles</SelectItem>
                    <SelectItem value="Billing">Billing</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="EBM / Fiscal">EBM / Fiscal</SelectItem>
                    <SelectItem value="Offline Sync">Offline Sync</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={(value) => setPriority(value as SupportTicket["priority"])}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Assign To</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{supportAgents.map((agent) => <SelectItem key={agent} value={agent}>{agent}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Message *</label>
                <Textarea className="min-h-[120px] rounded-xl border-border bg-muted/40 placeholder:text-muted-foreground" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain what happened, what you expected, and any error message you saw..." />
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-sm md:col-span-2">
                <div className="flex items-start gap-3">
                  <Timer className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-bold">SLA target</p>
                    <p className="text-muted-foreground">{priority.toUpperCase()} priority tickets are due in {getSlaHours(priority)} hours. Offline tickets keep this SLA locally and sync later.</p>
                  </div>
                </div>
              </div>

              {offlineModeActive && <div className="md:col-span-2 rounded-xl border bg-amber-500/10 p-3 text-sm text-amber-700">This ticket will be saved locally first and synced when internet returns.</div>}
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button className={BTN_PRIMARY} onClick={createOrUpdateTicket}><Send className="mr-2 h-4 w-4" />{editTicket ? "Save Changes" : "Submit Ticket"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </PageBackground>
  );
}
