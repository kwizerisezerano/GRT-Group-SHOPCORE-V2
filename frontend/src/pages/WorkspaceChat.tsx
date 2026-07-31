import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Paperclip,
  Download,
  FileText,
  Trash2,
  Reply,
  X,
  MessageCircle,
  Users,
  Activity,
  Hash,
  Search,
  Smile,
  Image as ImageIcon,
  FileArchive,
  Copy,
  ShieldCheck,
  FolderOpen,
  Clock3,
  Pencil,
  Pin,
  PinOff,
  Megaphone,
  AtSign,
  Mic,
  Bell,
  CheckCheck,
  BarChart3,
  FileSearch,
  MessageSquareText,
  Wifi,
  WifiOff,
  Database,
  UploadCloud,
  Plus,
  Filter,
  ClipboardList,
  CheckSquare,
  Square,
  ListChecks,
  Vote,
  TimerReset,
  Video,
  PhoneCall,
  CalendarPlus,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { decryptData } from "@/lib/encryption";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const db = supabase as any;
const BUCKET = "workspace-chat";
const NAVY = "#0b3d5c";

const CHANNELS = [
  { id: "general", name: "General", icon: Hash, hint: "Workspace-wide conversation" },
  { id: "sales", name: "Sales", icon: BarChart3, hint: "POS and sales updates" },
  { id: "inventory", name: "Inventory", icon: FolderOpen, hint: "Stock and warehouse updates" },
  { id: "purchasing", name: "Purchasing", icon: FileText, hint: "Supplier and PO discussions" },
  { id: "accounting", name: "Accounting", icon: ShieldCheck, hint: "Expenses and finance" },
  { id: "management", name: "Management", icon: ShieldCheck, hint: "Leadership announcements" },
];

const emojis = ["😀", "😁", "😂", "😊", "😍", "👍", "🙏", "👏", "🔥", "❤️", "✅", "🎉", "👀", "💯"];
const quickReactions = ["👍", "❤️", "😂", "🔥", "✅", "👀"];

type ChatMessage = {
  id: string;
  tenant_id: string | null;
  workspace_id: string | null;
  user_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  reply_to: string | null;
  is_deleted: boolean | null;
  created_at: string;
  updated_at: string | null;
  sync_status?: string | null;
  operation?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type WorkspaceMember = {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string | null;
  created_at: string | null;
};

type ReactionMap = Record<string, Record<string, string[]>>;

type LocalPin = {
  id: string;
  message_id: string;
  workspace_id: string;
  pinned_by: string;
  created_at: string;
};

type LocalTask = {
  id: string;
  workspace_id: string;
  title: string;
  status: "open" | "done";
  created_by: string;
  source_message_id?: string | null;
  created_at: string;
};

type LocalPoll = {
  id: string;
  workspace_id: string;
  question: string;
  options: string[];
  votes: Record<string, string>;
  created_by: string;
  created_at: string;
};

type WorkspaceMeeting = {
  id: string;
  tenant_id: string | null;
  workspace_id: string | null;
  created_by: string | null;
  title: string;
  meeting_type: string | null;
  meeting_url: string;
  scheduled_at: string | null;
  status: string | null;
  created_at: string;
  ended_at?: string | null;
  expires_at?: string | null;
  invite_code?: string | null;
  invite_url?: string | null;
  operation?: string | null;
  sync_status?: string | null;
};

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function canUseOnlineSupabase() {
  return isOnline() && !isOfflineMode();
}

function isOfflineLikeError(error: any) {
  return !canUseOnlineSupabase() || isNetworkError(error);
}

function fileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(type?: string | null) {
  if (type?.startsWith("image/")) return ImageIcon;
  if (type?.includes("zip") || type?.includes("rar")) return FileArchive;
  return FileText;
}

function createMeetingInviteCode(workspaceId: string) {
  const workspacePart = String(workspaceId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "workspace";
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `sc-${workspacePart}-${Date.now()}-${randomPart}`.toLowerCase();
}

function getMeetingInviteLink(meeting: WorkspaceMeeting) {
  return meeting.invite_url || meeting.meeting_url;
}

function getMeetingStatus(meeting: WorkspaceMeeting) {
  const status = String(meeting.status || "scheduled").toLowerCase();
  if (["ended", "cancelled", "canceled", "expired"].includes(status)) return status === "canceled" ? "cancelled" : status;

  const now = Date.now();
  const expiresAt = meeting.expires_at ? new Date(meeting.expires_at).getTime() : 0;
  if (expiresAt && expiresAt < now) return "expired";

  const scheduledAt = meeting.scheduled_at ? new Date(meeting.scheduled_at).getTime() : 0;
  if (scheduledAt && scheduledAt > now) return "scheduled";

  return status === "scheduled" ? "live" : status;
}

function getMeetingStatusClass(status: string) {
  if (status === "live") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "scheduled") return "border-blue-500/30 bg-blue-500/10 text-blue-700";
  if (status === "expired") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (status === "cancelled") return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function getBubbleSizeClass(message: ChatMessage) {
  if (message.attachment_url) return "w-full sm:w-[360px] max-w-full";

  const textLength = (message.message || "").trim().length;

  if (textLength <= 18) return "w-fit min-w-[72px]";
  if (textLength <= 55) return "w-fit min-w-[120px] max-w-[420px]";
  if (textLength <= 140) return "w-fit max-w-[560px]";

  return "w-full max-w-[640px]";
}

function messageChannel(message: ChatMessage) {
  const raw = String(message.message || "").toLowerCase();

  if (raw.includes("#sales") || raw.includes("sales")) return "sales";
  if (raw.includes("#inventory") || raw.includes("stock") || raw.includes("warehouse")) return "inventory";
  if (raw.includes("#purchasing") || raw.includes("supplier") || raw.includes("purchase")) return "purchasing";
  if (raw.includes("#accounting") || raw.includes("expense") || raw.includes("payment")) return "accounting";
  if (raw.includes("#management") || raw.includes("announcement")) return "management";

  return "general";
}

function isAnnouncement(message: ChatMessage) {
  return /^\s*(\[announcement\]|announcement:|📢)/i.test(message.message || "");
}

function extractMentions(value?: string | null) {
  const matches = String(value || "").match(/@[\w.-]+/g) || [];
  return [...new Set(matches)];
}

function isWorkspaceSchemaError(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist") ||
    message.includes("column")
  );
}

function normalizeWorkspaceMember(row: any, fallbackWorkspaceId: string): WorkspaceMember {
  return {
    id: String(row?.id || row?.user_id || makeLocalId("workspace-member")),
    user_id: String(row?.user_id || row?.id || ""),
    workspace_id: String(row?.workspace_id || row?.tenant_id || fallbackWorkspaceId),
    role: row?.role || "member",
    created_at: row?.created_at || null,
  };
}

function mergeById<T extends { id: string }>(incoming: T[], existing: T[]) {
  const map = new Map<string, T>();
  [...incoming, ...existing].forEach((row) => {
    if (!row?.id) return;
    if (!map.has(String(row.id))) map.set(String(row.id), row);
  });
  return Array.from(map.values());
}

async function safeWorkspaceSelect(table: string, workspaceId: string, tenantId?: string | null, limit = 1000, orderBy = "created_at", ascending = false) {
  const filters = [
    { column: "workspace_id", value: workspaceId },
    tenantId ? { column: "tenant_id", value: tenantId } : null,
  ].filter(Boolean) as Array<{ column: string; value: string }>;

  for (const filter of filters) {
    try {
      let query = db.from(table).select("*").eq(filter.column, filter.value).limit(limit);
      if (orderBy) query = query.order(orderBy, { ascending });
      const { data, error } = await query;
      if (error) throw error;
      return { data: data || [], error: null, source: filter.column };
    } catch (error: any) {
      if (!isWorkspaceSchemaError(error) && !isOfflineLikeError(error)) return { data: [], error, source: filter.column };
    }
  }

  return { data: [], error: null, source: "cache" };
}

async function safeWorkspaceUpdate(table: string, id: string, patch: Record<string, any>, workspaceId?: string | null) {
  try {
    let query = db.from(table).update(patch).eq("id", id);
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (error: any) {
    if (isWorkspaceSchemaError(error) || isOfflineLikeError(error)) return false;
    throw error;
  }
}

async function safeWorkspaceDelete(table: string, ids: string[], workspaceId?: string | null) {
  try {
    let query = db.from(table).delete().in("id", ids);
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (error: any) {
    if (isWorkspaceSchemaError(error) || isOfflineLikeError(error)) return false;
    throw error;
  }
}


export default function WorkspaceChat() {
  const { user, tenantId, tenantName } = useAuth();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [activeChannel, setActiveChannel] = useState("general");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [rightPanel, setRightPanel] = useState<"members" | "files" | "pins" | "analytics" | "tasks" | "polls" | "meetings" | "summary">("members");
  const [pins, setPins] = useState<LocalPin[]>([]);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [polls, setPolls] = useState<LocalPoll[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [composeMode, setComposeMode] = useState<"message" | "announcement">("message");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Yes\nNo");
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [meetings, setMeetings] = useState<WorkspaceMeeting[]>([]);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingType, setMeetingType] = useState<"video" | "audio">("video");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState("60");
  const [activeMeetingRoom, setActiveMeetingRoom] = useState<WorkspaceMeeting | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const activeWorkspaceId = workspaceId || tenantId;

  const profileIds = useMemo(() => {
    return [...new Set(messages.map((m) => m.user_id).filter(Boolean))];
  }, [messages]);

  const memberUserIds = useMemo(() => {
    return [...new Set(members.map((m) => m.user_id).filter(Boolean))];
  }, [members]);

  const allProfileIds = useMemo(() => {
    return [...new Set([...profileIds, ...memberUserIds])];
  }, [profileIds, memberUserIds]);

  const saveMessagesLocal = async (rows: ChatMessage[]) => {
    await saveCachedTable("workspace_messages", rows);
  };

  const loadLocalEnhancements = async () => {
    if (!activeWorkspaceId) return;

    const cachedPins = ((await getCachedTable("workspace_message_pins")) || []) as LocalPin[];
    setPins(cachedPins.filter((pin) => String(pin.workspace_id) === String(activeWorkspaceId)));

    const cachedReactions = ((await getCachedTable("workspace_message_reactions_local")) || {}) as ReactionMap;
    setReactions(cachedReactions || {});

    const cachedTasks = ((await getCachedTable("workspace_chat_tasks")) || []) as LocalTask[];
    setTasks(cachedTasks.filter((task) => String(task.workspace_id) === String(activeWorkspaceId)));

    const cachedPolls = ((await getCachedTable("workspace_chat_polls")) || []) as LocalPoll[];
    setPolls(cachedPolls.filter((poll) => String(poll.workspace_id) === String(activeWorkspaceId)));
  };

  const saveLocalPins = async (nextPins: LocalPin[]) => {
    const cachedPins = ((await getCachedTable("workspace_message_pins")) || []) as LocalPin[];
    const otherWorkspacePins = cachedPins.filter((pin) => String(pin.workspace_id) !== String(activeWorkspaceId));
    await saveCachedTable("workspace_message_pins", [...otherWorkspacePins, ...nextPins]);
    setPins(nextPins);
  };

  const saveLocalReactions = async (next: ReactionMap) => {
    await saveCachedTable("workspace_message_reactions_local", next as any);
    setReactions(next);
  };

  const saveLocalTasks = async (nextTasks: LocalTask[]) => {
    const cachedTasks = ((await getCachedTable("workspace_chat_tasks")) || []) as LocalTask[];
    const otherWorkspaceTasks = cachedTasks.filter((task) => String(task.workspace_id) !== String(activeWorkspaceId));
    await saveCachedTable("workspace_chat_tasks", [...otherWorkspaceTasks, ...nextTasks]);
    setTasks(nextTasks);
  };

  const saveLocalPolls = async (nextPolls: LocalPoll[]) => {
    const cachedPolls = ((await getCachedTable("workspace_chat_polls")) || []) as LocalPoll[];
    const otherWorkspacePolls = cachedPolls.filter((poll) => String(poll.workspace_id) !== String(activeWorkspaceId));
    await saveCachedTable("workspace_chat_polls", [...otherWorkspacePolls, ...nextPolls]);
    setPolls(nextPolls);
  };

  const loadCachedMessages = async () => {
    if (!activeWorkspaceId) return;

    const cached = await getCachedTable("workspace_messages");
    const localRows = ((cached || []) as ChatMessage[])
      .filter((message) => String(message.workspace_id || "") === String(activeWorkspaceId))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setMessages(localRows);
  };

  const loadCachedMembers = async () => {
    if (!activeWorkspaceId) return;

    const cached = await getCachedTable("workspace_members");
    const localRows = ((cached || []) as WorkspaceMember[]).filter(
      (member) => String(member.workspace_id || "") === String(activeWorkspaceId)
    );

    setMembers(localRows);
  };


  const loadOnlineOrCachedMembers = async () => {
    if (!activeWorkspaceId) return;

    if (!canUseOnlineSupabase()) {
      await loadCachedMembers();
      return;
    }

    try {
      const result = await safeWorkspaceSelect("workspace_members", activeWorkspaceId, tenantId, 5000, "created_at", false);
      if (result.error) throw result.error;

      if (Array.isArray(result.data) && result.data.length > 0) {
        const rows = (result.data as any[]).map((row) => normalizeWorkspaceMember(row, activeWorkspaceId));
        setMembers(rows);
        const cached = ((await getCachedTable("workspace_members")) || []) as WorkspaceMember[];
        const otherWorkspaces = cached.filter((member) => String(member.workspace_id || "") !== String(activeWorkspaceId));
        await saveCachedTable("workspace_members", [...otherWorkspaces, ...rows]);
        return;
      }

      if (tenantId) {
        const { data, error } = await db.from("tenant_members").select("id, user_id, role, tenant_id, created_at").eq("tenant_id", tenantId).limit(5000);
        if (error) throw error;
        const rows = ((data || []) as any[]).map((row) => normalizeWorkspaceMember(row, activeWorkspaceId));
        setMembers(rows);
        const cached = ((await getCachedTable("workspace_members")) || []) as WorkspaceMember[];
        const otherWorkspaces = cached.filter((member) => String(member.workspace_id || "") !== String(activeWorkspaceId));
        await saveCachedTable("workspace_members", [...otherWorkspaces, ...rows]);
        return;
      }

      await loadCachedMembers();
    } catch {
      await loadCachedMembers();
    }
  };

  const upsertLocalMessage = async (message: ChatMessage) => {
    const cached = ((await getCachedTable("workspace_messages")) || []) as ChatMessage[];
    const next = [
      message,
      ...cached.filter((row) => String(row.id) !== String(message.id)),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    await saveCachedTable("workspace_messages", next);
    setMessages((current) =>
      [
        message,
        ...current.filter((row) => String(row.id) !== String(message.id)),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );
  };

  const attachmentMessages = useMemo(
    () => messages.filter((m) => !!m.attachment_url && !m.is_deleted),
    [messages]
  );

  const attachmentCount = attachmentMessages.length;

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return messages.filter((m) => new Date(m.created_at).toDateString() === today).length;
  }, [messages]);

  const announcementMessages = useMemo(
    () => messages.filter((m) => !m.is_deleted && isAnnouncement(m)),
    [messages]
  );

  const pinnedMessages = useMemo(() => {
    return pins
      .map((pin) => messages.find((message) => message.id === pin.message_id))
      .filter(Boolean) as ChatMessage[];
  }, [pins, messages]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CHANNELS.forEach((channel) => {
      counts[channel.id] = messages.filter((message) => !message.is_deleted && messageChannel(message) === channel.id).length;
    });
    return counts;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();

    return messages.filter((m) => {
      const channelMatch = activeChannel === "general" || messageChannel(m) === activeChannel || messageChannel(m) === "general";
      if (!channelMatch) return false;

      if (!q) return true;

      const sender = profiles[m.user_id]?.display_name || m.user_id;
      return (
        m.message?.toLowerCase().includes(q) ||
        m.attachment_name?.toLowerCase().includes(q) ||
        sender.toLowerCase().includes(q)
      );
    });
  }, [messages, search, profiles, activeChannel]);

  const selectedMessages = useMemo(() => {
    const selected = new Set(selectedMessageIds);
    return messages.filter((message) => selected.has(message.id));
  }, [messages, selectedMessageIds]);

  const selectedDeletedCount = useMemo(
    () => selectedMessages.filter((message) => message.is_deleted).length,
    [selectedMessages]
  );

  const analytics = useMemo(() => {
    const activeMessages = messages.filter((m) => !m.is_deleted);
    const replyCount = activeMessages.filter((m) => !!m.reply_to).length;
    const mentionCount = activeMessages.reduce((sum, msg) => sum + extractMentions(msg.message).length, 0);
    const pendingCount = activeMessages.filter((m) => String(m.sync_status || "").includes("pending") || String(m.id).startsWith("offline-")).length;
    const fileStorage = activeMessages.reduce((sum, msg) => sum + Number(msg.attachment_size || 0), 0);

    const openTasks = tasks.filter((task) => task.status === "open").length;
    const doneTasks = tasks.filter((task) => task.status === "done").length;
    const completionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

    return {
      activeMessages: activeMessages.length,
      replyCount,
      mentionCount,
      pendingCount,
      fileStorage,
      announcementCount: announcementMessages.length,
      pinnedCount: pinnedMessages.length,
      taskCount: tasks.length,
      openTasks,
      doneTasks,
      completionRate,
      pollCount: polls.length,
      meetingCount: meetings.length,
      liveMeetings: meetings.filter((meeting) => getMeetingStatus(meeting) === "live").length,
      scheduledMeetings: meetings.filter((meeting) => getMeetingStatus(meeting) === "scheduled").length,
      historyMeetings: meetings.filter((meeting) => ["ended", "expired", "cancelled"].includes(getMeetingStatus(meeting))).length,
    };
  }, [messages, announcementMessages.length, pinnedMessages.length, tasks, polls.length, meetings.length]);

  const meetingGroups = useMemo(() => {
    const sorted = [...meetings].sort((a, b) => {
      const at = new Date(a.scheduled_at || a.created_at || 0).getTime();
      const bt = new Date(b.scheduled_at || b.created_at || 0).getTime();
      return bt - at;
    });

    return {
      live: sorted.filter((meeting) => getMeetingStatus(meeting) === "live"),
      scheduled: sorted.filter((meeting) => getMeetingStatus(meeting) === "scheduled"),
      history: sorted.filter((meeting) => ["ended", "expired", "cancelled"].includes(getMeetingStatus(meeting))),
    };
  }, [meetings]);

  const loadMessages = async () => {
    if (!activeWorkspaceId) return;

    if (!canUseOnlineSupabase()) {
      await loadCachedMessages();
      return;
    }

    try {
      const result = await safeWorkspaceSelect("workspace_messages", activeWorkspaceId, tenantId, 1000, "created_at", true);
      if (result.error) throw result.error;
      const onlineRows = (result.data || []) as unknown as ChatMessage[];
      const cachedRows = ((await getCachedTable("workspace_messages")) || []) as ChatMessage[];
      const localPendingRows = cachedRows.filter((row) => String(row.workspace_id || "") === String(activeWorkspaceId) && (String(row.sync_status || "").includes("pending") || String(row.id || "").startsWith("offline-")));
      const rows = mergeById(localPendingRows, onlineRows).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(rows);
      await saveMessagesLocal(rows);
    } catch (error: any) {
      await loadCachedMessages();
      if (!isWorkspaceSchemaError(error) && !isOfflineLikeError(error)) toast.error(error?.message || "Failed to load messages");
    }
  };

  const loadMeetings = async () => {
    if (!activeWorkspaceId) return;

    const cachedMeetings = ((await getCachedTable("workspace_meetings")) || []) as WorkspaceMeeting[];
    const cachedForWorkspace = cachedMeetings
      .filter((meeting) => String(meeting.workspace_id || meeting.tenant_id || "") === String(activeWorkspaceId) || String(meeting.tenant_id || "") === String(tenantId || ""))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (!canUseOnlineSupabase()) {
      setMeetings(cachedForWorkspace);
      return;
    }

    try {
      const result = await safeWorkspaceSelect("workspace_meetings", activeWorkspaceId, tenantId, 100, "created_at", false);
      if (result.error) throw result.error;
      const rows = (result.data || []) as WorkspaceMeeting[];
      setMeetings(rows);
      const otherMeetings = cachedMeetings.filter((meeting) => String(meeting.workspace_id || meeting.tenant_id || "") !== String(activeWorkspaceId) && String(meeting.tenant_id || "") !== String(tenantId || ""));
      await saveCachedTable("workspace_meetings", [...otherMeetings, ...rows]);
    } catch (error: any) {
      setMeetings(cachedForWorkspace);
      if (!isWorkspaceSchemaError(error) && !isOfflineLikeError(error)) toast.error(error?.message || "Failed to load workspace meetings");
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const resolveWorkspace = async () => {
      if (!canUseOnlineSupabase()) {
        if (!cancelled) setWorkspaceId(tenantId || null);
        return;
      }

      try {
        const { data, error } = await db.from("workspace_members").select("workspace_id, tenant_id, role").eq("user_id", user.id).limit(1).maybeSingle();
        if (error) throw error;
        if (!cancelled) setWorkspaceId(data?.workspace_id || data?.tenant_id || tenantId || null);
      } catch (error: any) {
        if (!cancelled) setWorkspaceId(tenantId || null);
      }
    };

    resolveWorkspace();

    return () => {
      cancelled = true;
    };
  }, [user?.id, tenantId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    loadLocalEnhancements();
    loadOnlineOrCachedMembers();
  }, [activeWorkspaceId, tenantId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    loadMessages();
    loadMeetings();

    if (!canUseOnlineSupabase()) return;

    const channel = supabase
      .channel(`workspace-chat-${activeWorkspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_messages",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (allProfileIds.length === 0) return;
    if (!canUseOnlineSupabase()) return;

    db.from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", allProfileIds)
      .then(({ data }: any) => {
        const map: Record<string, Profile> = {};
        ((data || []) as any[]).forEach((p) => {
          map[p.id] = {
            ...p,
            display_name: decryptData(p.display_name || '') || '',
          };
        });

        setProfiles(map);
      });
  }, [allProfileIds.join(",")]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeChannel]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const sendMessage = async (attachment?: {
    url: string;
    name: string;
    type: string;
    size: number;
  }) => {
    if (!user?.id) return toast.error("You must be signed in");
    if (!activeWorkspaceId) return toast.error("No active workspace");

    let cleanText = text.trim();

    if (composeMode === "announcement" && cleanText && !isAnnouncement({ message: cleanText } as ChatMessage)) {
      cleanText = `[ANNOUNCEMENT] ${cleanText}`;
    }

    if (activeChannel !== "general" && cleanText && !cleanText.toLowerCase().includes(`#${activeChannel}`)) {
      cleanText = `#${activeChannel} ${cleanText}`;
    }

    if (!cleanText && !attachment) {
      toast.error("Write a message or attach a file");
      return;
    }

    setSending(true);

    const now = new Date().toISOString();
    const payload: ChatMessage = {
      id: makeLocalId("offline-workspace-message"),
      tenant_id: tenantId || activeWorkspaceId,
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      message: cleanText || null,
      attachment_url: attachment?.url || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null,
      attachment_size: attachment?.size || null,
      reply_to: replyTo?.id || null,
      is_deleted: false,
      created_at: now,
      updated_at: null,
      sync_status: "pending",
      operation: "create",
      created_offline_at: now,
      updated_offline_at: now,
    };

    try {
      if (!canUseOnlineSupabase() || attachment?.url?.startsWith("offline://")) {
        await savePending("workspace_messages", payload);
        await upsertLocalMessage(payload);
        toast.success("Message saved offline and queued for sync.");
      } else {
        const { error } = await db.from("workspace_messages").insert({
          tenant_id: payload.tenant_id,
          workspace_id: payload.workspace_id,
          user_id: payload.user_id,
          message: payload.message,
          attachment_url: payload.attachment_url,
          attachment_name: payload.attachment_name,
          attachment_type: payload.attachment_type,
          attachment_size: payload.attachment_size,
          reply_to: payload.reply_to,
          is_deleted: false,
        });

        if (error) throw error;

        await loadMessages();
      }

      setText("");
      setReplyTo(null);
      setEmojiOpen(false);
      setComposeMode("message");
    } catch (error: any) {
      if (isOfflineLikeError(error)) {
        await savePending("workspace_messages", payload);
        await upsertLocalMessage(payload);
        toast.success("Network failed. Message queued offline.");
      } else {
        toast.error(error?.message || "Failed to send message");
      }
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user?.id) return toast.error("You must be signed in");
    if (!activeWorkspaceId) return toast.error("No active workspace");

    try {
      setUploading(true);

      if (!canUseOnlineSupabase()) {
        await sendMessage({
          url: `offline://${file.name}`,
          name: file.name,
          type: file.type || "file",
          size: file.size,
        });
        toast.info("File upload needs internet. A placeholder was saved offline.");
        return;
      }

      const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${activeWorkspaceId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;

      await sendMessage({
        url: data?.signedUrl || path,
        name: file.name,
        type: file.type || "file",
        size: file.size,
      });

      toast.success("File uploaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploadVoiceNote = async (audioBlob: Blob) => {
    if (!user?.id) return toast.error("You must be signed in");
    if (!activeWorkspaceId) return toast.error("No active workspace");

    const createdAt = new Date();
    const filename = `voice-note-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${createdAt.getTime()}.webm`;

    try {
      setUploading(true);

      if (!canUseOnlineSupabase()) {
        await sendMessage({
          url: `offline://${filename}`,
          name: filename,
          type: "audio/webm",
          size: audioBlob.size,
        });
        toast.info("Voice note saved offline. The audio file will need internet to upload.");
        return;
      }

      const path = `${activeWorkspaceId}/voice-notes/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, audioBlob, {
          cacheControl: "3600",
          contentType: "audio/webm",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;

      await sendMessage({
        url: data?.signedUrl || path,
        name: filename,
        type: "audio/webm",
        size: audioBlob.size,
      });

      toast.success("Voice note sent");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send voice note");
    } finally {
      setUploading(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!user?.id) return toast.error("You must be signed in");
    if (!activeWorkspaceId) return toast.error("No active workspace");

    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      toast.error("MediaRecorder is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });

      audioChunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        setRecordingStartedAt(null);

        if (audioBlob.size > 0) {
          await uploadVoiceNote(audioBlob);
        }
      };

      recorder.start();
      setRecording(true);
      setRecordingStartedAt(Date.now());
      toast.success("Recording started. Tap the microphone again to send.");
    } catch (error: any) {
      setRecording(false);
      setRecordingStartedAt(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(error?.message || "Microphone permission was denied");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      setRecordingStartedAt(null);
      return;
    }

    recorder.stop();
  };

  const toggleVoiceRecording = () => {
    if (recording) stopVoiceRecording();
    else startVoiceRecording();
  };

  const removeMessagesFromLocalState = async (ids: string[]) => {
    const cached = ((await getCachedTable("workspace_messages")) || []) as ChatMessage[];
    const nextCached = cached.filter((message) => !ids.includes(String(message.id)));
    await saveCachedTable("workspace_messages", nextCached);

    setMessages((current) => current.filter((message) => !ids.includes(String(message.id))));

    const nextPins = pins.filter((pin) => !ids.includes(String(pin.message_id)));
    await saveLocalPins(nextPins);

    const nextReactions = { ...reactions };
    ids.forEach((id) => delete nextReactions[id]);
    await saveLocalReactions(nextReactions);
  };

  const deleteMessage = async (message: ChatMessage) => {
    if (!user?.id) return toast.error("You must be signed in");

    if (message.is_deleted) {
      await hardDeleteMessages([message]);
      return;
    }

    if (message.user_id !== user.id) {
      toast.error("You can only delete your own messages");
      return;
    }

    const updatedAt = new Date().toISOString();
    const patch = {
      ...message,
      is_deleted: true,
      message: null,
      attachment_url: null,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
      operation: "update",
      sync_status: "pending",
      updated_offline_at: updatedAt,
    } as ChatMessage;

    try {
      // Always update the local UI first so the button feels responsive.
      await upsertLocalMessage(patch);

      if (!canUseOnlineSupabase() || String(message.id).startsWith("offline-")) {
        await savePending("workspace_messages", patch);
        toast.success("Message deletion queued offline.");
        return;
      }

      const deletedOnline = await safeWorkspaceUpdate("workspace_messages", message.id, { is_deleted: true, message: null, attachment_url: null, attachment_name: null, attachment_type: null, attachment_size: null, updated_at: updatedAt }, activeWorkspaceId);
      if (!deletedOnline) throw new Error("Workspace message delete was queued because the online schema is not ready.");

      await loadMessages();
      toast.success("Message deleted");
    } catch (error: any) {
      await savePending("workspace_messages", patch);
      await upsertLocalMessage(patch);
      toast.error(error?.message || "Delete was saved offline because online delete failed");
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectionMode(true);
    setSelectedMessageIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId]
    );
  };

  const clearMessageSelection = () => {
    setSelectedMessageIds([]);
    setSelectionMode(false);
  };

  const selectVisibleMessages = () => {
    setSelectionMode(true);
    setSelectedMessageIds(filteredMessages.map((message) => message.id));
  };

  const hardDeleteMessages = async (targetMessages: ChatMessage[]) => {
    if (!targetMessages.length) return;
    if (!activeWorkspaceId) return toast.error("No active workspace");

    const ids = targetMessages.map((message) => String(message.id));
    const onlineMessages = targetMessages.filter(
      (message) => canUseOnlineSupabase() && !String(message.id || "").startsWith("offline-")
    );
    const offlineMessages = targetMessages.filter(
      (message) => !canUseOnlineSupabase() || String(message.id || "").startsWith("offline-")
    );

    try {
      if (onlineMessages.length > 0) {
        const onlineIds = onlineMessages.map((message) => String(message.id));
        const deletedOnline = await safeWorkspaceDelete("workspace_messages", onlineIds, activeWorkspaceId);
        if (!deletedOnline) throw new Error("Workspace message delete was queued because the online schema is not ready.");
      }

      for (const message of offlineMessages) {
        const isLocalOnly = String(message.id || "").startsWith("offline-");
        if (!isLocalOnly) {
          await savePending("workspace_messages", {
            ...message,
            operation: "delete",
            sync_status: "pending_delete",
            updated_offline_at: new Date().toISOString(),
          });
        }
      }

      await removeMessagesFromLocalState(ids);
      clearMessageSelection();

      toast.success(
        targetMessages.length === 1
          ? "Message removed from workspace history."
          : `${targetMessages.length} messages removed from workspace history.`
      );
    } catch (error: any) {
      // Do not pretend the online delete worked. Keep a pending delete only for sync later.
      for (const message of targetMessages) {
        await savePending("workspace_messages", {
          ...message,
          operation: "delete",
          sync_status: "pending_delete",
          updated_offline_at: new Date().toISOString(),
        });
      }

      await removeMessagesFromLocalState(ids);
      clearMessageSelection();

      toast.error(
        error?.message
          ? `Permanent delete blocked online: ${error.message}. It was queued for sync.`
          : "Permanent delete was queued for sync."
      );
    }
  };

  const deleteSelectedMessages = async () => {
    if (!selectedMessages.length) return;
    await hardDeleteMessages(selectedMessages);
  };

  const copyMessage = async (message: ChatMessage) => {
    const value = message.message || message.attachment_url || "";
    if (!value) return;

    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  const updateMessage = async () => {
    if (!editingMessage) return;

    const cleanText = editText.trim();

    if (!cleanText) {
      toast.error("Message cannot be empty");
      return;
    }

    const updatedAt = new Date().toISOString();
    const patch = {
      ...editingMessage,
      message: cleanText,
      updated_at: updatedAt,
      operation: "update",
      sync_status: "pending",
      updated_offline_at: updatedAt,
    } as ChatMessage;

    try {
      if (!canUseOnlineSupabase() || editingMessage.id.startsWith("offline-")) {
        await savePending("workspace_messages", patch);
        await upsertLocalMessage(patch);
        setEditingMessage(null);
        setEditText("");
        toast.success("Message updated offline.");
        return;
      }

      const updatedOnline = await safeWorkspaceUpdate("workspace_messages", editingMessage.id, { message: cleanText, updated_at: updatedAt }, activeWorkspaceId);
      if (!updatedOnline) throw new Error("Workspace message update was queued because the online schema is not ready.");

      await loadMessages();
      setEditingMessage(null);
      setEditText("");
      toast.success("Message updated");
    } catch (error: any) {
      if (isOfflineLikeError(error)) {
        await savePending("workspace_messages", patch);
        await upsertLocalMessage(patch);
        setEditingMessage(null);
        setEditText("");
        toast.success("Network failed. Message updated offline.");
        return;
      }

      toast.error(error?.message || "Failed to update message");
    }
  };

  const togglePin = async (message: ChatMessage) => {
    if (!activeWorkspaceId || !user?.id) return;

    const exists = pins.some((pin) => pin.message_id === message.id);
    const next = exists
      ? pins.filter((pin) => pin.message_id !== message.id)
      : [
          {
            id: makeLocalId("pin"),
            message_id: message.id,
            workspace_id: activeWorkspaceId,
            pinned_by: user.id,
            created_at: new Date().toISOString(),
          },
          ...pins,
        ];

    await saveLocalPins(next);

    await savePending("workspace_message_pins", {
      id: exists ? pins.find((pin) => pin.message_id === message.id)?.id || makeLocalId("pin") : next[0]?.id,
      tenant_id: tenantId || activeWorkspaceId,
      workspace_id: activeWorkspaceId,
      message_id: message.id,
      pinned_by: user.id,
      operation: exists ? "delete" : "create",
      sync_status: exists ? "pending_delete" : "pending",
      created_at: new Date().toISOString(),
      updated_offline_at: new Date().toISOString(),
    }).catch(() => undefined);

    toast.success(exists ? "Message unpinned" : "Message pinned");
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user?.id) return;

    const currentEmojiUsers = reactions[messageId]?.[emoji] || [];
    const exists = currentEmojiUsers.includes(user.id);
    const nextEmojiUsers = exists
      ? currentEmojiUsers.filter((id) => id !== user.id)
      : [...currentEmojiUsers, user.id];

    const next: ReactionMap = {
      ...reactions,
      [messageId]: {
        ...(reactions[messageId] || {}),
        [emoji]: nextEmojiUsers,
      },
    };

    if (next[messageId]?.[emoji]?.length === 0) delete next[messageId][emoji];
    if (next[messageId] && Object.keys(next[messageId]).length === 0) delete next[messageId];
    await saveLocalReactions(next);

    await savePending("workspace_message_reactions", {
      id: makeLocalId("workspace-reaction"),
      tenant_id: tenantId || activeWorkspaceId,
      workspace_id: activeWorkspaceId,
      message_id: messageId,
      user_id: user.id,
      emoji,
      operation: exists ? "delete" : "create",
      sync_status: exists ? "pending_delete" : "pending",
      created_at: new Date().toISOString(),
      updated_offline_at: new Date().toISOString(),
    }).catch(() => undefined);
  };

  const reactToMessages = async (targetMessages: ChatMessage[], emoji: string) => {
    if (!user?.id || targetMessages.length === 0) return;

    const next: ReactionMap = { ...reactions };

    targetMessages.forEach((message) => {
      const currentEmojiUsers = next[message.id]?.[emoji] || [];
      const exists = currentEmojiUsers.includes(user.id);
      const nextEmojiUsers = exists
        ? currentEmojiUsers.filter((id) => id !== user.id)
        : [...currentEmojiUsers, user.id];

      next[message.id] = {
        ...(next[message.id] || {}),
        [emoji]: nextEmojiUsers,
      };

      if (next[message.id][emoji].length === 0) delete next[message.id][emoji];
      if (Object.keys(next[message.id]).length === 0) delete next[message.id];
    });

    await saveLocalReactions(next);
  };

  const createTask = async (sourceMessage?: ChatMessage) => {
    if (!activeWorkspaceId || !user?.id) return;

    const title = (sourceMessage?.message || taskTitle || text).trim();
    if (!title) {
      toast.error("Add task details first");
      return;
    }

    const nextTask: LocalTask = {
      id: makeLocalId("workspace-task"),
      workspace_id: activeWorkspaceId,
      title: title.replace(/^\[announcement\]\s*/i, ""),
      status: "open",
      created_by: user.id,
      source_message_id: sourceMessage?.id || null,
      created_at: new Date().toISOString(),
    };

    await saveLocalTasks([nextTask, ...tasks]);
    await savePending("workspace_tasks", {
      ...nextTask,
      tenant_id: tenantId || activeWorkspaceId,
      operation: "create",
      sync_status: "pending",
      updated_offline_at: new Date().toISOString(),
    }).catch(() => undefined);
    setTaskDialogOpen(false);
    setTaskTitle("");
    toast.success("Task created from chat");
  };

  const toggleTaskStatus = async (task: LocalTask) => {
    const next: LocalTask[] = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status: (item.status === "done" ? "open" : "done") as LocalTask["status"],
          }
        : item
    );

    await saveLocalTasks(next);
    const updated = next.find((item) => item.id === task.id);
    if (updated) {
      await savePending("workspace_tasks", {
        ...updated,
        tenant_id: tenantId || activeWorkspaceId,
        operation: String(updated.id).startsWith("workspace-task") ? "create" : "update",
        sync_status: "pending",
        updated_offline_at: new Date().toISOString(),
      }).catch(() => undefined);
    }
  };

  const deleteTask = async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    await saveLocalTasks(tasks.filter((item) => item.id !== taskId));

    if (task) {
      await savePending("workspace_tasks", {
        ...task,
        tenant_id: tenantId || activeWorkspaceId,
        operation: "delete",
        sync_status: "pending_delete",
        updated_offline_at: new Date().toISOString(),
      }).catch(() => undefined);
    }

    toast.success("Task deleted");
  };

  const createPoll = async () => {
    if (!activeWorkspaceId || !user?.id) return;
    const question = pollQuestion.trim();
    const options = pollOptions
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!question || options.length < 2) {
      toast.error("Add a question and at least two options");
      return;
    }

    const nextPoll: LocalPoll = {
      id: makeLocalId("workspace-poll"),
      workspace_id: activeWorkspaceId,
      question,
      options,
      votes: {},
      created_by: user.id,
      created_at: new Date().toISOString(),
    };

    await saveLocalPolls([nextPoll, ...polls]);
    await savePending("workspace_polls", {
      ...nextPoll,
      tenant_id: tenantId || activeWorkspaceId,
      operation: "create",
      sync_status: "pending",
      updated_offline_at: new Date().toISOString(),
    }).catch(() => undefined);
    setPollDialogOpen(false);
    setPollQuestion("");
    setPollOptions("Yes\nNo");
    toast.success("Poll created");
  };

  const votePoll = async (pollId: string, option: string) => {
    if (!user?.id) return;
    const next = polls.map((poll) =>
      poll.id === pollId ? { ...poll, votes: { ...poll.votes, [user.id]: option } } : poll
    );
    await saveLocalPolls(next);

    const updatedPoll = next.find((poll) => poll.id === pollId);
    if (updatedPoll) {
      await savePending("workspace_polls", {
        ...updatedPoll,
        tenant_id: tenantId || activeWorkspaceId,
        operation: String(updatedPoll.id).startsWith("workspace-poll") ? "create" : "update",
        sync_status: "pending",
        updated_offline_at: new Date().toISOString(),
      }).catch(() => undefined);
    }
  };

  const createMeeting = async () => {
    if (!activeWorkspaceId || !user?.id) return toast.error("No active workspace");

    const cleanTitle = meetingTitle.trim() || (meetingType === "audio" ? "Workspace Audio Meeting" : "Workspace Video Meeting");
    const safeWorkspace = String(activeWorkspaceId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    const inviteCode = createMeetingInviteCode(activeWorkspaceId);
    const meetingUrl = `https://meet.jit.si/shopcore-${safeWorkspace}-${inviteCode}`;
    const now = new Date();
    const scheduledDate = meetingTime ? new Date(meetingTime) : now;
    const duration = Math.max(15, Number(meetingDurationMinutes || 60));
    const expiresAt = new Date(scheduledDate.getTime() + duration * 60 * 1000).toISOString();

    const localMeeting: WorkspaceMeeting = {
      id: makeLocalId("workspace-meeting"),
      tenant_id: tenantId || activeWorkspaceId,
      workspace_id: activeWorkspaceId,
      created_by: user.id,
      title: cleanTitle,
      meeting_type: meetingType,
      meeting_url: meetingUrl,
      invite_code: inviteCode,
      invite_url: meetingUrl,
      scheduled_at: meetingTime || null,
      expires_at: expiresAt,
      ended_at: null,
      status: meetingTime ? "scheduled" : "live",
      created_at: now.toISOString(),
    };

    try {
      if (canUseOnlineSupabase()) {
        const { data, error } = await db
          .from("workspace_meetings")
          .insert({
            tenant_id: localMeeting.tenant_id,
            workspace_id: localMeeting.workspace_id,
            created_by: localMeeting.created_by,
            title: localMeeting.title,
            meeting_type: localMeeting.meeting_type,
            meeting_url: localMeeting.meeting_url,
            scheduled_at: localMeeting.scheduled_at,
            status: localMeeting.status,
            ended_at: localMeeting.ended_at,
            expires_at: localMeeting.expires_at,
            invite_code: localMeeting.invite_code,
            invite_url: localMeeting.invite_url,
          })
          .select()
          .single();

        if (error) throw error;

        const createdMeeting = (data || localMeeting) as WorkspaceMeeting;
        setMeetings((current) => [createdMeeting, ...current.filter((m) => m.id !== createdMeeting.id)]);

        const cachedMeetings = ((await getCachedTable("workspace_meetings")) || []) as WorkspaceMeeting[];
        await saveCachedTable("workspace_meetings", [createdMeeting, ...cachedMeetings.filter((m) => m.id !== createdMeeting.id)]);
      } else {
        await saveCachedTable("workspace_meetings", [localMeeting, ...meetings]);
        await savePending("workspace_meetings", { ...localMeeting, operation: "create", sync_status: "pending" });
        setMeetings((current) => [localMeeting, ...current]);
      }

      const inviteLink = getMeetingInviteLink(localMeeting);
      const meetingText = `${meetingType === "audio" ? "🎧" : "📹"} ${cleanTitle}
${meetingTime ? `Scheduled: ${new Date(meetingTime).toLocaleString()}
` : ""}Join meeting: ${inviteLink}`;
      setText((current) => (current.trim() ? `${current.trim()}

${meetingText}` : meetingText));
      setMeetingDialogOpen(false);
      setMeetingTitle("");
      setMeetingTime("");
      setMeetingDurationMinutes("60");
      setMeetingType("video");
      setRightPanel("meetings");
      toast.success("Meeting created with invite link.");
    } catch (error: any) {
      await saveCachedTable("workspace_meetings", [localMeeting, ...meetings]);
      await savePending("workspace_meetings", { ...localMeeting, operation: "create", sync_status: "pending" }).catch(() => undefined);
      setMeetings((current) => [localMeeting, ...current]);
      setMeetingDialogOpen(false);
      setMeetingTitle("");
      setMeetingTime("");
      setMeetingDurationMinutes("60");
      setMeetingType("video");
      setRightPanel("meetings");
      toast.success(isWorkspaceSchemaError(error) || isOfflineLikeError(error) ? "Meeting saved offline and will sync later." : error?.message || "Meeting saved offline for review.");
    }
  };

  const shareMeeting = (meeting: WorkspaceMeeting) => {
    const inviteLink = getMeetingInviteLink(meeting);
    const meetingText = `${meeting.meeting_type === "audio" ? "🎧" : "📹"} ${meeting.title}
${meeting.scheduled_at ? `Scheduled: ${new Date(meeting.scheduled_at).toLocaleString()}
` : ""}Join meeting: ${inviteLink}`;
    setText((current) => (current.trim() ? `${current.trim()}

${meetingText}` : meetingText));
    toast.success("Meeting invite added to composer");
  };

  const copyMeetingInvite = async (meeting: WorkspaceMeeting) => {
    const inviteLink = getMeetingInviteLink(meeting);
    if (!inviteLink) return toast.error("Meeting invite link is missing");
    await navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied");
  };

  const updateMeetingStatus = async (meeting: WorkspaceMeeting, status: "live" | "ended" | "cancelled") => {
    const patch: Partial<WorkspaceMeeting> = {
      status,
      ended_at: status === "ended" || status === "cancelled" ? new Date().toISOString() : meeting.ended_at || null,
    };

    const updatedMeeting = { ...meeting, ...patch } as WorkspaceMeeting;
    setMeetings((current) => current.map((item) => (item.id === meeting.id ? updatedMeeting : item)));

    const cachedMeetings = ((await getCachedTable("workspace_meetings")) || []) as WorkspaceMeeting[];
    await saveCachedTable(
      "workspace_meetings",
      cachedMeetings.map((item) => (item.id === meeting.id ? updatedMeeting : item)),
    );

    try {
      if (canUseOnlineSupabase() && !String(meeting.id).startsWith("workspace-meeting")) {
        const { error } = await db
          .from("workspace_meetings")
          .update(patch)
          .eq("id", meeting.id);
        if (error) throw error;
      } else {
        await savePending("workspace_meetings", { ...updatedMeeting, operation: "update", sync_status: "pending_update" });
      }
      toast.success(status === "ended" ? "Meeting moved to history" : status === "cancelled" ? "Meeting cancelled" : "Meeting marked live");
    } catch (error: any) {
      await savePending("workspace_meetings", { ...updatedMeeting, operation: "update", sync_status: "pending_update" });
      toast.success("Meeting status saved offline and will sync later");
    }
  };

  const openMeetingInsideShopCore = (meeting: WorkspaceMeeting) => {
    const inviteLink = getMeetingInviteLink(meeting);
    if (!inviteLink) {
      toast.error("Meeting link is missing");
      return;
    }

    setActiveMeetingRoom({ ...meeting, meeting_url: inviteLink });
  };

  const openMeetingInNewTab = (meeting: WorkspaceMeeting) => {
    const inviteLink = getMeetingInviteLink(meeting);
    if (!inviteLink) return;
    window.open(inviteLink, "_blank", "noopener,noreferrer");
  };

  const insertEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`);
    setEmojiOpen(false);
  };

  const insertMention = (member: WorkspaceMember) => {
    setText((current) => `${current}${current.endsWith(" ") || !current ? "" : " "}@${getSender(member.user_id).replace(/\s+/g, "")}`);
  };

  const getSender = (userId: string) => {
    const profile = profiles[userId];
    return profile?.display_name || userId.slice(0, 8);
  };

  const getReplyMessage = (id: string | null) => {
    if (!id) return null;
    return messages.find((m) => m.id === id) || null;
  };

  const startEditing = (message: ChatMessage) => {
    setEditingMessage(message);
    setEditText(message.message || "");
  };

  const activeChannelLabel = CHANNELS.find((channel) => channel.id === activeChannel)?.name || "General";

  return (
    <div className="animate-fade-in space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm overflow-hidden relative min-h-[180px]">
          <div className="absolute -right-8 -top-8 h-16 w-16 rounded-full bg-blue-300/25" />
          <div className="absolute right-6 top-20 h-10 w-10 rounded-full bg-cyan-300/20" />
          <div className="absolute -bottom-10 left-20 h-16 w-16 rounded-full bg-violet-300/20" />

          <div className="relative flex items-start gap-4">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <MessageCircle className="h-6 w-6" />
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-blue-50 ${canUseOnlineSupabase() ? "bg-emerald-500" : "bg-orange-500"}`} />
            </div>

            <div className="min-w-0 flex-1">
              <Badge className="mb-2 rounded-full border-blue-200 bg-blue-600 px-3 py-1 text-white hover:bg-blue-600">
                <MessageSquareText className="mr-1 h-3.5 w-3.5" />
                Workspace Operations Center
              </Badge>

              <h1 className="text-lg font-black leading-tight tracking-tight text-slate-950">
                Workspace Operations Center
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">
                Coordinate channels, files, replies, pinned notices, tasks, polls, meetings, announcements, and offline-ready team communication.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                  <p className="text-xs text-emerald-700">Workspace</p>
                  <p className="truncate text-sm font-bold text-slate-950">{tenantName || "Workspace"}</p>
                </div>

                <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                  <p className="text-xs text-violet-700">Active Channel</p>
                  <p className="text-sm font-bold text-violet-700">#{activeChannelLabel}</p>
                </div>

                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-2.5">
                  <p className="text-xs text-cyan-700">Sync Status</p>
                  <p className={`text-sm font-bold ${canUseOnlineSupabase() ? "text-emerald-700" : "text-orange-700"}`}>
                    {canUseOnlineSupabase() ? "Live Online" : "Offline Cache"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 grid grid-cols-2 gap-2">
          {[
            { label: "Messages", value: analytics.activeMessages, helper: "active records", icon: MessageCircle, card: "bg-blue-600 text-white", dot: "bg-white/30" },
            { label: "Members", value: members.length, helper: "workspace users", icon: Users, card: "bg-emerald-600 text-white", dot: "bg-white/30" },
            { label: "Files", value: attachmentCount, helper: "shared documents", icon: FolderOpen, card: "bg-orange-600 text-white", dot: "bg-white/30" },
            { label: "Pins", value: analytics.pinnedCount, helper: "priority notes", icon: Pin, card: "bg-violet-600 text-white", dot: "bg-white/30" },
            { label: "Tasks", value: analytics.openTasks, helper: "open work items", icon: ClipboardList, card: "bg-rose-600 text-white", dot: "bg-white/30" },
            { label: "Meetings", value: analytics.meetingCount, helper: "workspace rooms", icon: Video, card: "bg-cyan-600 text-white", dot: "bg-white/30" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`relative overflow-hidden rounded-xl p-3 shadow-sm min-h-[78px] ${item.card}`}>
                <div className="absolute -right-6 -top-4 h-16 w-16 rounded-full bg-white/15" />
                <div className={`absolute right-4 top-7 h-2.5 w-2.5 rounded-full ${item.dot}`} />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold">{item.label}</p>
                    <p className="mt-0.5 font-data text-lg font-black leading-none">{item.value}</p>
                    <div className="mt-2 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                      {item.helper}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(analytics.pendingCount > 0 || !canUseOnlineSupabase()) && (
        <div className="rounded-xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
              {!canUseOnlineSupabase() ? <WifiOff className="h-4 w-4" /> : <Database className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-bold">
                {!canUseOnlineSupabase() ? "Workspace communication is using offline cache" : "Workspace messages waiting to sync"}
              </p>
              <p className="text-sm opacity-90">
                Pending chat records: {analytics.pendingCount}. Messages, edits, and deletions will sync when internet returns.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <Hash className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Channels</p>
          <p className="mt-0.5 text-lg font-black">{CHANNELS.length}</p>
          <p className="mt-2 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
            Department conversations
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600">
            <Clock3 className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="mt-0.5 text-lg font-black">{todayCount}</p>
          <p className="mt-2 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
            Messages sent today
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Megaphone className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Announcements</p>
          <p className="mt-0.5 text-lg font-black">{analytics.announcementCount}</p>
          <p className="mt-2 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
            Management notices
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Workspace visibility</h3>
              <p className="mt-1 text-xs text-muted-foreground">Workspace-only messages and files.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-gradient-to-br from-white to-blue-50/60 p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
            <Activity className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold">Smart Collaboration</p>
          <p className="mt-1 text-xs text-muted-foreground">Create tasks, polls, and summaries from conversations.</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-white to-emerald-50/60 p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <ListChecks className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold">Task Completion</p>
          <p className="mt-0.5 text-lg font-black">{analytics.completionRate}%</p>
          <p className="text-xs text-muted-foreground">{analytics.doneTasks} done · {analytics.openTasks} open</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-white to-amber-50/60 p-3 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <TimerReset className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold">Operational Tempo</p>
          <p className="mt-1 text-xs text-muted-foreground">{analytics.activeMessages > 0 ? "Communication is active." : "No conversation activity yet."}</p>
        </div>
      </div>

      {pinnedMessages.length > 0 && (
        <div className="rounded-[2rem] border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Pin className="h-4 w-4 text-[#0b3d5c]" />
            <h3 className="font-bold">Pinned Messages</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pinnedMessages.slice(0, 3).map((message) => (
              <div key={message.id} className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs font-semibold">{getSender(message.user_id)}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {message.message || message.attachment_name || "Attachment"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl bg-muted/50 px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages, senders, mentions, or files..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={composeMode === "announcement" ? "default" : "outline"}
              className="rounded-xl"
              style={composeMode === "announcement" ? { background: NAVY } : undefined}
              onClick={() => setComposeMode((mode) => (mode === "announcement" ? "message" : "announcement"))}
            >
              <Megaphone className="mr-2 h-4 w-4" />
              Announcement
            </Button>

            <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setTaskTitle(text); setTaskDialogOpen(true); }}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Task
            </Button>

            <Button className="rounded-xl bg-orange-600 text-white hover:bg-orange-700" onClick={() => setPollDialogOpen(true)}>
              <Vote className="mr-2 h-4 w-4" />
              Poll
            </Button>

            <Button className="rounded-xl bg-violet-600 text-white hover:bg-violet-700" onClick={() => setMeetingDialogOpen(true)}>
              <Video className="mr-2 h-4 w-4" />
              Meeting
            </Button>

            <Button className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => setRightPanel("summary")}>
              <MessageSquareText className="mr-2 h-4 w-4" />
              Summary
            </Button>

            <Badge variant="outline" className={`rounded-full px-4 py-2 ${canUseOnlineSupabase() ? "text-emerald-600" : "text-amber-600"}`}>
              {canUseOnlineSupabase() ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
              {canUseOnlineSupabase() ? "Live sync" : "Offline cache"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100vh-12rem)] min-h-[660px] grid-cols-1 gap-4 xl:grid-cols-[240px_1fr_320px]">
        <div className="hidden min-h-0 rounded-[2rem] border bg-card shadow-sm xl:flex xl:flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-[#0b3d5c]" />
              <h3 className="font-black">Channels</h3>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const active = activeChannel === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(channel.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-[#0b3d5c] bg-[#0b3d5c] text-white" : "bg-muted/20 hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-semibold">{channel.name}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/15" : "bg-background"}`}>
                      {channelCounts[channel.id] || 0}
                    </span>
                  </div>
                  <p className={`mt-1 line-clamp-1 text-xs ${active ? "text-white/70" : "text-muted-foreground"}`}>
                    {channel.hint}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="border-t p-3">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              Channels are smart-routed using hashtags such as #sales, #inventory, and #management.
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b3d5c] text-white">
                <Hash className="h-4 w-4" />
              </div>

              <div>
                <h2 className="font-black">#{activeChannelLabel}</h2>
                <p className="text-xs text-muted-foreground">
                  {tenantName || "Workspace"} · {members.length} member{members.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`rounded-full ${canUseOnlineSupabase() ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                {canUseOnlineSupabase() ? "Live" : "Offline"}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {filteredMessages.length} messages
              </Badge>
            </div>
          </div>

          {(selectionMode || selectedMessageIds.length > 0) && (
            <div className="border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
              <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{selectedMessageIds.length} selected</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDeletedCount > 0
                        ? `${selectedDeletedCount} deleted placeholder${selectedDeletedCount === 1 ? "" : "s"} selected`
                        : "Select messages to manage, react, or permanently remove."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={selectVisibleMessages}>
                    Select Visible
                  </Button>
                  {quickReactions.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-2xl px-3 text-base"
                      onClick={() => reactToMessages(selectedMessages, emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={clearMessageSelection}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-xl" onClick={deleteSelectedMessages}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(11,61,92,0.055),transparent_32%),linear-gradient(to_bottom,#f8fafc,#ffffff_46%,#f6f8fb)] px-3 py-5 sm:px-5">
            {filteredMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b3d5c]/10">
                  <MessageCircle className="h-8 w-8 text-[#0b3d5c]" />
                </div>
                <p className="font-semibold text-foreground">No messages yet</p>
                <p className="text-sm">Start the first conversation in #{activeChannelLabel}.</p>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-3">
                {filteredMessages.map((msg, index) => {
                  const previous = filteredMessages[index - 1];
                  const showDay = !previous || formatDay(previous.created_at) !== formatDay(msg.created_at);

                  const mine = msg.user_id === user?.id;
                  const sender = getSender(msg.user_id);
                  const profile = profiles[msg.user_id];
                  const replied = getReplyMessage(msg.reply_to);
                  const isImage = msg.attachment_type?.startsWith("image/") && !String(msg.attachment_url || "").startsWith("offline://");
                  const isAudio = msg.attachment_type?.startsWith("audio/") && !String(msg.attachment_url || "").startsWith("offline://");
                  const FileIcon = getFileIcon(msg.attachment_type);
                  const messagePinned = pins.some((pin) => pin.message_id === msg.id);
                  const messageReactions = (reactions[msg.id] || {}) as Record<string, string[]>;
                  const mentions = extractMentions(msg.message);
                  const announcement = isAnnouncement(msg);
                  const bubbleSize = getBubbleSizeClass(msg);
                  const selected = selectedMessageIds.includes(msg.id);

                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="mb-3 flex justify-center">
                          <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm backdrop-blur">
                            {formatDay(msg.created_at)}
                          </span>
                        </div>
                      )}

                      <div className={`group/message flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                        {(selectionMode || selectedMessageIds.length > 0) && (
                          <button
                            type="button"
                            onClick={() => toggleMessageSelection(msg.id)}
                            className={`mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm transition hover:scale-105 ${selected ? "border-[#0b3d5c] text-[#0b3d5c]" : "border-slate-200 text-slate-400"} ${mine ? "order-first" : ""}`}
                            title={selected ? "Unselect message" : "Select message"}
                          >
                            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        )}
                        {!mine && (
                          <Avatar className="mt-1 h-8 w-8 ring-2 ring-white shadow-sm">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials(sender)}</AvatarFallback>
                          </Avatar>
                        )}

                        <div className={`relative flex max-w-[92%] flex-col sm:max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
                          <div className={`mb-1 flex flex-wrap items-center gap-2 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                            {!mine && <span className="text-xs font-semibold">{sender}</span>}
                            {announcement && (
                              <Badge className="rounded-full bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                                <Megaphone className="mr-1 h-3 w-3" />
                                Announcement
                              </Badge>
                            )}
                            {messagePinned && <Pin className="h-3 w-3 text-amber-500" />}
                            <span className="text-[10px] font-medium text-slate-400">
                              {formatTime(msg.created_at)}{msg.updated_at && msg.updated_at !== msg.created_at ? " · edited" : ""}
                            </span>
                          </div>

                          <div
                            onDoubleClick={() => toggleMessageSelection(msg.id)}
                            className={`relative ${bubbleSize} rounded-[1.35rem] border px-4 py-2.5 shadow-sm transition-all duration-200 group-hover/message:shadow-md ${selected ? "ring-2 ring-[#0b3d5c]/40" : ""} ${mine ? "rounded-br-md border-[#0b3d5c]/10 bg-[#0b3d5c] text-white after:absolute after:-right-1.5 after:bottom-2 after:h-3 after:w-3 after:rotate-45 after:rounded-sm after:bg-[#0b3d5c]" : announcement ? "rounded-bl-md border-amber-200 bg-amber-50 text-foreground after:absolute after:-left-1.5 after:bottom-2 after:h-3 after:w-3 after:rotate-45 after:rounded-sm after:bg-amber-50" : "rounded-bl-md border-slate-200 bg-white text-foreground after:absolute after:-left-1.5 after:bottom-2 after:h-3 after:w-3 after:rotate-45 after:rounded-sm after:border-b after:border-l after:border-slate-200 after:bg-white"}`}
                          >
                            {msg.is_deleted ? (
                              <>
                                <p className="text-sm italic opacity-70">This message was deleted</p>

                                {Object.keys(messageReactions).length > 0 && (
                                  <div className={`mt-2 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                                    {Object.entries(messageReactions).map(([emoji, users]) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => toggleReaction(msg.id, emoji)}
                                        className={`rounded-full border px-2 py-0.5 text-xs shadow-sm transition hover:scale-105 ${mine ? "border-white/20 bg-white/15 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                                      >
                                        {emoji} <span className="font-semibold">{users.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                <div className={`pointer-events-none absolute top-full z-20 mt-1.5 flex max-w-[min(92vw,640px)] flex-wrap gap-1.5 opacity-0 transition-opacity duration-200 group-hover/message:pointer-events-auto group-hover/message:opacity-100 ${mine ? "right-0 justify-end" : "left-0 justify-start"}`}>
                                  <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-slate-700 shadow-xl backdrop-blur">
                                    {quickReactions.map((emoji) => (
                                      <button key={emoji} type="button" onClick={() => toggleReaction(msg.id, emoji)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition hover:bg-slate-100">
                                        {emoji}
                                      </button>
                                    ))}
                                    <span className="mx-1 h-5 w-px bg-slate-200" />
                                    <button type="button" onClick={() => toggleMessageSelection(msg.id)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      <CheckSquare className="h-3 w-3" /> Select
                                    </button>
                                    <button type="button" onClick={() => hardDeleteMessages([msg])} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50">
                                      <Trash2 className="h-3 w-3" /> Remove
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {replied && (
                                  <div className={`mb-2 rounded-2xl border-l-4 px-3 py-2 text-xs ${mine ? "border-white/60 bg-white/10" : "border-[#0b3d5c] bg-slate-100"}`}>
                                    <p className="font-semibold">Replying to {getSender(replied.user_id)}</p>
                                    <p className="line-clamp-2 opacity-80">{replied.message || replied.attachment_name || "Attachment"}</p>
                                  </div>
                                )}

                                {msg.message && (
                                  <p className="whitespace-pre-wrap break-words text-[14px] leading-6">{msg.message}</p>
                                )}

                                {mentions.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {mentions.map((mention) => (
                                      <span key={mention} className={`rounded-full px-2 py-0.5 text-[10px] ${mine ? "bg-white/15" : "bg-blue-500/10 text-blue-700"}`}>
                                        {mention}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {msg.attachment_url && (
                                  <div className={`mt-2 overflow-hidden rounded-2xl border ${mine ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-50"}`}>
                                    {isImage ? (
                                      <div>
                                        <img src={msg.attachment_url} alt={msg.attachment_name || "Attachment"} className="max-h-72 w-full rounded-t-xl object-cover" />
                                        <div className="flex items-center justify-between gap-3 p-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{msg.attachment_name}</p>
                                            <p className="text-xs opacity-70">{fileSize(msg.attachment_size)}</p>
                                          </div>
                                          <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="rounded-lg bg-background/20 p-2">
                                            <Download className="h-4 w-4" />
                                          </a>
                                        </div>
                                      </div>
                                    ) : isAudio ? (
                                      <div className="w-full p-3">
                                        <div className="mb-2 flex items-center gap-3">
                                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${mine ? "bg-white/15" : "bg-[#0b3d5c]/10 text-[#0b3d5c]"}`}>
                                            <Mic className="h-4 w-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold">Voice note</p>
                                            <p className="text-xs opacity-70">{fileSize(msg.attachment_size)}</p>
                                          </div>
                                        </div>
                                        <audio controls src={msg.attachment_url} className="h-9 w-full rounded-full" />
                                      </div>
                                    ) : (
                                      <div className="flex w-full items-center gap-3 p-3">
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${mine ? "bg-white/15" : "bg-[#0b3d5c]/10 text-[#0b3d5c]"}`}>
                                          <FileIcon className="h-4 w-4" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-semibold">{msg.attachment_name}</p>
                                          <p className="text-xs opacity-70">{fileSize(msg.attachment_size)}</p>
                                        </div>

                                        <a href={msg.attachment_url} target="_blank" rel="noreferrer" className={`rounded-lg p-2 ${mine ? "bg-white/15 text-white" : "bg-white text-[#0b3d5c]"}`}>
                                          <Download className="h-4 w-4" />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {Object.keys(messageReactions).length > 0 && (
                                  <div className={`mt-1.5 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                                    {Object.entries(messageReactions).map(([emoji, users]) => (
                                      <button key={emoji} type="button" onClick={() => toggleReaction(msg.id, emoji)} className={`rounded-full border px-2 py-0.5 text-xs shadow-sm transition hover:scale-105 ${mine ? "border-white/20 bg-white/15 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                                        {emoji} <span className="font-semibold">{users.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                <div className={`pointer-events-none absolute top-full z-20 mt-1.5 flex max-w-[min(92vw,640px)] flex-wrap gap-1.5 opacity-0 transition-opacity duration-200 group-hover/message:pointer-events-auto group-hover/message:opacity-100 ${mine ? "right-0 justify-end" : "left-0 justify-start"}`}>
                                  <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 text-slate-700 shadow-xl backdrop-blur">
                                    {quickReactions.map((emoji) => (
                                      <button key={emoji} type="button" onClick={() => toggleReaction(msg.id, emoji)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition hover:bg-slate-100">
                                        {emoji}
                                      </button>
                                    ))}
                                    <span className="mx-1 h-5 w-px bg-slate-200" />
                                    <button type="button" onClick={() => toggleMessageSelection(msg.id)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      <CheckSquare className="h-3 w-3" /> Select
                                    </button>
                                    <button type="button" onClick={() => setReplyTo(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      <Reply className="h-3 w-3" /> Reply
                                    </button>
                                    <button type="button" onClick={() => togglePin(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      {messagePinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                                      {messagePinned ? "Unpin" : "Pin"}
                                    </button>
                                    <button type="button" onClick={() => createTask(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      <ClipboardList className="h-3 w-3" /> Task
                                    </button>
                                    <button type="button" onClick={() => copyMessage(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                      <Copy className="h-3 w-3" /> Copy
                                    </button>
                                    {mine && msg.message && (
                                      <button type="button" onClick={() => startEditing(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-slate-100">
                                        <Pencil className="h-3 w-3" /> Edit
                                      </button>
                                    )}
                                    {mine && (
                                      <button type="button" onClick={() => deleteMessage(msg)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50">
                                        <Trash2 className="h-3 w-3" /> Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {mine && !msg.is_deleted && (
                            <div className="mt-1 flex items-center gap-1 px-2 text-[10px] font-medium text-slate-400">
                              <CheckCheck className="h-3 w-3" />
                              {String(msg.id).startsWith("offline-") || String(msg.sync_status || "").includes("pending") ? "Queued" : "Sent"}
                            </div>
                          )}
                        </div>

                        {mine && (
                          <Avatar className="mt-1 h-8 w-8 ring-2 ring-white shadow-sm">
                            <AvatarImage src={profiles[user.id]?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials(getSender(user.id))}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {replyTo && (
            <div className="border-t bg-muted/40 px-4 py-2">
              <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border bg-background p-3 shadow-sm">
                <div className="min-w-0 border-l-4 border-[#0b3d5c] pl-3">
                  <p className="text-xs font-semibold">Replying to {getSender(replyTo.user_id)}</p>
                  <p className="truncate text-xs text-muted-foreground">{replyTo.message || replyTo.attachment_name || "Attachment"}</p>
                </div>

                <Button variant="ghost" size="icon" onClick={() => setReplyTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="border-t bg-white/95 p-3 shadow-[0_-10px_30px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />

              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant={recording ? "default" : "outline"}
                size="icon"
                className={`h-10 w-10 rounded-2xl ${recording ? "animate-pulse bg-rose-600 text-white hover:bg-rose-700" : ""}`}
                disabled={uploading || sending}
                title={recording ? "Stop and send voice note" : "Record voice note"}
                onClick={toggleVoiceRecording}
              >
                <Mic className="h-4 w-4" />
              </Button>

              {recording && (
                <div className="flex h-12 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
                  Recording {recordingStartedAt ? `${Math.max(1, Math.floor((Date.now() - recordingStartedAt) / 1000))}s` : "..."}
                </div>
              )}

              <div className={`relative flex min-h-[48px] flex-1 items-end rounded-[1.5rem] border bg-slate-50 px-3 py-2 shadow-inner ${composeMode === "announcement" ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={composeMode === "announcement" ? `Post announcement to #${activeChannelLabel}...` : `Message #${activeChannelLabel}...`}
                  className="max-h-32 min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setEmojiOpen(!emojiOpen)}>
                  <Smile className="h-4 w-4" />
                </Button>

                {emojiOpen && (
                  <div className="absolute bottom-12 right-2 z-50 grid w-64 grid-cols-7 gap-1 rounded-xl border bg-white p-3 shadow-xl">
                    {emojis.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="rounded-lg p-2 text-lg hover:bg-muted">
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button type="button" disabled={sending || uploading} className="h-10 rounded-xl px-5" style={{ background: NAVY }} onClick={() => sendMessage()}>
                <Send className="mr-2 h-4 w-4" /> Send
              </Button>
            </div>

            <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Supports images, PDFs, Word, Excel, ZIP, voice notes, meetings, replies, pins, reactions, mentions, and offline queue.</span>
              <span>{composeMode === "announcement" ? "Announcement mode enabled" : "Press Enter to send · Shift + Enter for new line"}</span>
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 rounded-[2rem] border bg-card shadow-sm xl:flex xl:flex-col">
          <div className="border-b p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0b3d5c]" />
              <h3 className="font-black">Workspace Panel</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "members", label: "Members", icon: Users },
                { id: "files", label: "Files", icon: FolderOpen },
                { id: "pins", label: "Pins", icon: Pin },
                { id: "analytics", label: "Stats", icon: BarChart3 },
                { id: "tasks", label: "Tasks", icon: ClipboardList },
                { id: "polls", label: "Polls", icon: Vote },
                { id: "meetings", label: "Meet", icon: Video },
                { id: "summary", label: "Workspace Brief", icon: FileSearch },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRightPanel(item.id as any)}
                    className={`rounded-2xl border p-2 text-xs font-semibold transition ${rightPanel === item.id ? "border-[#0b3d5c] bg-[#0b3d5c] text-white" : "bg-muted/20 hover:bg-muted/50"}`}
                  >
                    <Icon className="mx-auto mb-1 h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {rightPanel === "members" && (
              <div className="space-y-2">
                {members.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No members loaded</div>
                ) : (
                  members.map((member) => {
                    const name = getSender(member.user_id);
                    const profile = profiles[member.user_id];

                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3 transition hover:bg-muted/40">
                        <button type="button" onClick={() => insertMention(member)} className="flex min-w-0 items-center gap-2 text-left">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{name}</p>
                            <p className="text-xs capitalize text-muted-foreground">{member.role || "member"}</p>
                          </div>
                        </button>

                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {rightPanel === "files" && (
              <div className="space-y-2">
                {attachmentMessages.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No files shared yet</div>
                ) : (
                  attachmentMessages.slice().reverse().map((message) => {
                    const FileIcon = getFileIcon(message.attachment_type);
                    return (
                      <a key={message.id} href={message.attachment_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border bg-muted/20 p-3 transition hover:bg-muted/40">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                          <FileIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{message.attachment_name || "File"}</p>
                          <p className="text-xs text-muted-foreground">{fileSize(message.attachment_size)} · {formatDateTime(message.created_at)}</p>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            )}

            {rightPanel === "pins" && (
              <div className="space-y-2">
                {pinnedMessages.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No pinned messages</div>
                ) : (
                  pinnedMessages.map((message) => (
                    <div key={message.id} className="rounded-xl border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{getSender(message.user_id)}</p>
                        <button type="button" onClick={() => togglePin(message)} className="text-muted-foreground hover:text-rose-600">
                          <PinOff className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{message.message || message.attachment_name || "Attachment"}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {rightPanel === "analytics" && (
              <div className="space-y-3">
                {[
                  { label: "Active messages", value: analytics.activeMessages, icon: MessageSquareText },
                  { label: "Replies", value: analytics.replyCount, icon: Reply },
                  { label: "Announcements", value: analytics.announcementCount, icon: Megaphone },
                  { label: "Files shared", value: attachmentCount, icon: FileSearch },
                  { label: "Storage", value: fileSize(analytics.fileStorage) || "0 B", icon: Database },
                  { label: "Pending sync", value: analytics.pendingCount, icon: UploadCloud },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        <p className="text-xs">{item.label}</p>
                      </div>
                      <p className="text-lg font-black">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


            {rightPanel === "tasks" && (
              <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Chat Tasks</p>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTaskDialogOpen(true)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
                {tasks.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No chat tasks yet</div>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => toggleTaskStatus(task)} className="flex min-w-0 items-start gap-2 text-left">
                          <CheckSquare className={`mt-0.5 h-4 w-4 ${task.status === "done" ? "text-emerald-600" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(task.created_at)}</p>
                          </div>
                        </button>
                        <button type="button" onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {rightPanel === "polls" && (
              <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Workspace Polls</p>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setPollDialogOpen(true)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
                {polls.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No polls yet</div>
                ) : (
                  polls.map((poll) => {
                    const votes = Object.values(poll.votes);
                    return (
                      <div key={poll.id} className="rounded-xl border bg-muted/20 p-3">
                        <p className="text-sm font-bold">{poll.question}</p>
                        <div className="mt-3 space-y-2">
                          {poll.options.map((option) => {
                            const count = votes.filter((vote) => vote === option).length;
                            const percent = votes.length ? Math.round((count / votes.length) * 100) : 0;
                            const selected = user?.id ? poll.votes[user.id] === option : false;
                            return (
                              <button key={option} type="button" onClick={() => votePoll(poll.id, option)} className={`w-full rounded-xl border p-2 text-left text-xs transition ${selected ? "border-[#0b3d5c] bg-[#0b3d5c]/10" : "bg-background hover:bg-muted"}`}>
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="font-semibold">{option}</span>
                                  <span>{percent}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-[#0b3d5c]" style={{ width: `${percent}%` }} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {rightPanel === "meetings" && (
              <div className="space-y-3">
                <div className="rounded-xl border bg-gradient-to-br from-white via-blue-50/50 to-emerald-50/40 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#0b3d5c]/10 px-2 py-0.5 text-[10px] font-bold text-[#0b3d5c]">
                        <Video className="h-3 w-3" /> Meeting Center
                      </div>
                      <p className="truncate text-sm font-black">Workspace Meetings</p>
                      <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        Live calls, scheduled rooms, invites, and meeting history.
                      </p>
                    </div>
                    <Button size="sm" className="h-9 shrink-0 rounded-2xl px-3" style={{ background: NAVY }} onClick={() => setMeetingDialogOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> New
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center text-emerald-700">
                    <p className="text-lg font-black leading-none">{analytics.liveMeetings}</p>
                    <p className="mt-1 text-[10px] font-semibold">Live</p>
                  </button>
                  <button type="button" className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-center text-blue-700">
                    <p className="text-lg font-black leading-none">{analytics.scheduledMeetings}</p>
                    <p className="mt-1 text-[10px] font-semibold">Scheduled</p>
                  </button>
                  <button type="button" className="rounded-xl border bg-slate-50 p-2 text-center text-slate-700">
                    <p className="text-lg font-black leading-none">{analytics.historyMeetings}</p>
                    <p className="mt-1 text-[10px] font-semibold">History</p>
                  </button>
                </div>

                {meetings.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                    <Video className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No meetings yet. Start a meeting and share an invite link to chat.
                  </div>
                ) : (
                  [
                    { label: "Live Now", items: meetingGroups.live, tone: "emerald" },
                    { label: "Scheduled", items: meetingGroups.scheduled, tone: "blue" },
                    { label: "History", items: meetingGroups.history, tone: "slate" },
                  ].map((group) => (
                    <div key={group.label} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-2xl border bg-card/95 px-3 py-2 backdrop-blur">
                        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{group.label}</p>
                        <Badge variant="outline" className="rounded-full text-[10px]">{group.items.length}</Badge>
                      </div>

                      {group.items.length === 0 ? (
                        <div className="rounded-xl border bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                          No {group.label.toLowerCase()} meetings.
                        </div>
                      ) : (
                        group.items.map((meeting) => {
                          const isAudioMeeting = String(meeting.meeting_type || "video") === "audio";
                          const MeetingIcon = isAudioMeeting ? PhoneCall : Video;
                          const computedStatus = getMeetingStatus(meeting);
                          const inviteLink = getMeetingInviteLink(meeting);
                          const canJoinMeeting = !["ended", "expired", "cancelled"].includes(computedStatus);

                          return (
                            <div key={meeting.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                              <div className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                                    <MeetingIcon className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black leading-5">{meeting.title}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <Badge variant="outline" className={`rounded-full px-2 py-0 text-[10px] capitalize ${getMeetingStatusClass(computedStatus)}`}>
                                        {computedStatus}
                                      </Badge>
                                      <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px] capitalize">
                                        {meeting.meeting_type || "video"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-1 rounded-2xl bg-muted/30 p-2 text-[11px] leading-4 text-muted-foreground">
                                  {meeting.scheduled_at && <p className="truncate">Starts: {formatDateTime(meeting.scheduled_at)}</p>}
                                  {meeting.expires_at && <p className="truncate">Expires: {formatDateTime(meeting.expires_at)}</p>}
                                  {meeting.ended_at && <p className="truncate">Ended: {formatDateTime(meeting.ended_at)}</p>}
                                  <button
                                    type="button"
                                    onClick={() => copyMeetingInvite(meeting)}
                                    className="block w-full truncate rounded-xl bg-background px-2 py-1 text-left text-[10px] text-[#0b3d5c] hover:bg-white"
                                    title={inviteLink}
                                  >
                                    Invite: {inviteLink}
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1 border-t bg-slate-50/80 p-2">
                                {canJoinMeeting && (
                                  <Button size="sm" className="h-8 rounded-xl text-[11px]" style={{ background: NAVY }} onClick={() => openMeetingInsideShopCore(meeting)}>
                                    <Video className="mr-1 h-3 w-3" /> Join
                                  </Button>
                                )}

                                <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px]" onClick={() => copyMeetingInvite(meeting)}>
                                  <Copy className="mr-1 h-3 w-3" /> Copy
                                </Button>

                                <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px]" onClick={() => shareMeeting(meeting)}>
                                  Share
                                </Button>

                                <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px]" onClick={() => openMeetingInNewTab(meeting)}>
                                  <ExternalLink className="mr-1 h-3 w-3" /> Tab
                                </Button>

                                {computedStatus === "scheduled" && (
                                  <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px] text-emerald-700" onClick={() => updateMeetingStatus(meeting, "live")}>
                                    Start
                                  </Button>
                                )}

                                {["live", "scheduled"].includes(computedStatus) && (
                                  <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px] text-rose-700" onClick={() => updateMeetingStatus(meeting, computedStatus === "live" ? "ended" : "cancelled")}>
                                    {computedStatus === "live" ? "End" : "Cancel"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {rightPanel === "summary" && (
              <div className="space-y-3">
                <div className="rounded-xl border bg-[#0b3d5c]/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-[#0b3d5c]" />
                    <p className="font-black">Workspace AI Brief</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Automatic local summary from the latest visible workspace messages.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Today</p>
                  <p className="text-sm">{todayCount} messages, {analytics.replyCount} replies, {attachmentCount} files, {analytics.openTasks} open tasks.</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent topics</p>
                  <div className="space-y-2">
                    {messages.filter((m) => !m.is_deleted && m.message).slice(-5).reverse().map((message) => (
                      <p key={message.id} className="line-clamp-2 rounded-xl bg-background p-2 text-xs text-muted-foreground">
                        {message.message}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recommended actions</p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>• Pin important manager announcements.</p>
                    <p>• Convert action messages into tasks.</p>
                    <p>• Use polls for team decisions.</p>
                    <p>• Use #sales, #inventory, and #accounting for cleaner reports.</p>
                  </div>
                </div>
              </div>
            )}

          <div className="border-t p-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Bell className="mb-2 h-4 w-4 text-[#0b3d5c]" />
              Mentions use @Name and channel routing uses #sales, #inventory, #purchasing, #accounting, or #management.
            </div>
          </div>
        </div>
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Chat Task</DialogTitle>
            <DialogDescription>
              Create a follow-up task from the current workspace conversation.
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="min-h-[110px] w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none"
            placeholder="Task details..."
          />

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" style={{ background: NAVY }} onClick={() => createTask()}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
            <DialogDescription>
              Ask workspace members to vote on a decision.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            className="rounded-xl"
            placeholder="Poll question"
          />
          <textarea
            value={pollOptions}
            onChange={(e) => setPollOptions(e.target.value)}
            className="mt-3 min-h-[130px] w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none"
            placeholder="One option per line"
          />

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setPollDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" style={{ background: NAVY }} onClick={createPoll}>
              Create Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Workspace Meeting</DialogTitle>
            <DialogDescription>
              Start or schedule an audio/video meeting for workspace members. A join link will be added to the message box for sharing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meeting Title</label>
              <Input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="rounded-xl"
                placeholder="e.g. Morning Operations Meeting"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetingType("video")}
                className={`rounded-2xl border p-4 text-left transition ${meetingType === "video" ? "border-[#0b3d5c] bg-[#0b3d5c]/10" : "bg-muted/20 hover:bg-muted/40"}`}
              >
                <Video className="mb-2 h-5 w-5 text-[#0b3d5c]" />
                <p className="text-sm font-bold">Video</p>
                <p className="text-xs text-muted-foreground">Camera + audio</p>
              </button>

              <button
                type="button"
                onClick={() => setMeetingType("audio")}
                className={`rounded-2xl border p-4 text-left transition ${meetingType === "audio" ? "border-[#0b3d5c] bg-[#0b3d5c]/10" : "bg-muted/20 hover:bg-muted/40"}`}
              >
                <PhoneCall className="mb-2 h-5 w-5 text-[#0b3d5c]" />
                <p className="text-sm font-bold">Audio</p>
                <p className="text-xs text-muted-foreground">Voice only</p>
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Schedule Time</label>
              <Input
                type="datetime-local"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="rounded-xl"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave empty to start immediately.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Meeting Duration</label>
              <Input
                type="number"
                min="15"
                value={meetingDurationMinutes}
                onChange={(e) => setMeetingDurationMinutes(e.target.value)}
                className="rounded-xl"
                placeholder="60"
              />
              <p className="mt-1 text-xs text-muted-foreground">Used to move expired meetings into history automatically.</p>
            </div>

            <div className="rounded-xl border bg-blue-500/10 p-3 text-xs text-blue-800">
              Every meeting gets a clickable invite link that can be copied, shared to chat, opened in a new tab, or joined inside ShopCore.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setMeetingDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" style={{ background: NAVY }} onClick={createMeeting}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Create Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!activeMeetingRoom}
        onOpenChange={(open) => {
          if (!open) setActiveMeetingRoom(null);
        }}
      >
        <DialogContent className="h-[92vh] max-w-7xl overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b bg-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base">
                  {activeMeetingRoom?.meeting_type === "audio" ? (
                    <PhoneCall className="h-5 w-5 text-[#0b3d5c]" />
                  ) : (
                    <Video className="h-5 w-5 text-[#0b3d5c]" />
                  )}
                  <span className="truncate">{activeMeetingRoom?.title || "Workspace Meeting"}</span>
                </DialogTitle>
                <DialogDescription>
                  Live meeting embedded inside ShopCore. Allow microphone and camera permissions when prompted.
                </DialogDescription>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {activeMeetingRoom && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => copyMeetingInvite(activeMeetingRoom)}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy Invite
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => shareMeeting(activeMeetingRoom)}
                    >
                      Share to Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-rose-700"
                      onClick={() => {
                        updateMeetingStatus(activeMeetingRoom, "ended");
                        setActiveMeetingRoom(null);
                      }}
                    >
                      End Meeting
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openMeetingInNewTab(activeMeetingRoom)}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Open New Tab
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="h-[calc(92vh-88px)] bg-slate-950">
            {activeMeetingRoom?.meeting_url ? (
              <iframe
                title={activeMeetingRoom.title || "ShopCore Workspace Meeting"}
                src={activeMeetingRoom.meeting_url}
                className="h-full w-full border-0"
                allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white">
                Meeting URL is missing.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingMessage}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMessage(null);
            setEditText("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>
              Update your message text. Only your own text messages can be edited.
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[96px] w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none"
            placeholder="Edit message..."
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setEditingMessage(null);
                setEditText("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" style={{ background: NAVY }} onClick={updateMessage}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
