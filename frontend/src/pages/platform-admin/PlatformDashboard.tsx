import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  HardDrive,
  Lock,
  ReceiptText,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

type TenantRow = {
  id: string;
  name: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  trial_status: string | null;
  trial_ends_at: string | null;
  workspace_status: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_no: string | null;
  status: string | null;
  currency: string | null;
  total: number | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string | null;
};

type PaymentAttemptRow = {
  id: string;
  tenant_id: string | null;
  invoice_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string | null;
  attempted_at: string | null;
  verified_at: string | null;
};

type SubscriptionRow = {
  id: string;
  tenant_id: string | null;
  plan_code: string | null;
  status: string | null;
  billing_cycle: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
};

type SalesInquiryRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
};

type PlatformAdminRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

function formatMoney(value: number, currency = "RWF") {
  return `${currency} ${Math.round(value || 0).toLocaleString()}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}

function thisMonth(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function normalizeStatus(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function isActiveTrial(tenant: TenantRow) {
  const status = normalizeStatus(tenant.trial_status);
  if (!["active", "approved", "trial_active"].includes(status)) return false;
  if (!tenant.trial_ends_at) return true;
  return new Date(tenant.trial_ends_at).getTime() > Date.now();
}

function isTrialAwaitingApproval(tenant: TenantRow) {
  return ["pending", "pending_approval", "awaiting_approval", "requested"].includes(
    normalizeStatus(tenant.trial_status),
  );
}

function isWorkspaceAwaitingActivation(tenant: TenantRow) {
  return ["pending_payment", "pending_activation", "inactive", "provisioning"].includes(
    normalizeStatus(tenant.workspace_status),
  );
}

function statusTone(status?: string | null): Tone {
  const normalized = normalizeStatus(status);
  if (["paid", "active", "verified", "completed", "healthy", "operational", "converted", "qualified"].includes(normalized)) return "emerald";
  if (["failed", "blocked", "incident", "rejected", "expired", "void"].includes(normalized)) return "rose";
  if (["pending", "pending_payment", "pending_approval", "reviewing", "issued", "proposal", "negotiation", "degraded", "maintenance"].includes(normalized)) return "orange";
  if (["new", "trial", "trial_active", "awaiting_activation"].includes(normalized)) return "cyan";
  return "blue";
}


const dashboardCopy = {
  en: {
    eyebrow: "Platform Command Center", title: "ShopCore Cloud Platform", realtime: "Realtime Status", analytics: "Commercial Analytics", revenue: "Verified Subscription Revenue", health: "Tenant Health Watchlist", activity: "Live Platform Activity", monitor: "Service Monitor", refresh: "Refresh", refreshing: "Refreshing platform intelligence...",
    totalTenants: "Total Tenants", activeSubscriptions: "Active Subscriptions", verifiedRevenue: "Verified Revenue", activeOpportunities: "Active Opportunities", apiGateway: "API Gateway", databaseCluster: "Database Cluster", needsReview: "Needs Review", healthy: "Healthy", live: "Live", storage: "Storage", tracked: "Tracked", backgroundJobs: "Background Jobs", review: "Review", operational: "Operational",
    dataReview: "Data access needs review", monitoringActive: "Live monitoring active", newEnquiries: "New Sales Enquiries", pendingInvoices: "Pending Invoices", invoiceHelper: "Issued and overdue subscription invoices", pendingPayments: "Pending Payments", awaitingActivation: "Awaiting Activation", unreadAlerts: "Unread Alerts", failedPayments: "Failed Payments", platformAdmins: "Platform Admins", paymentAttempts: "Payment Attempts", workspaceRequests: "Workspace Requests", loginSessions: "Login Sessions", storageAssets: "Storage Assets", infrastructure: "Infrastructure", tenantRisks: "Tenant Risks", thisMonth: "This month", lifetimePaid: "Lifetime paid", activeTrials: "Active trials", workspace: "Workspace", noRisks: "No tenant health risks found.", recentInvoices: "Recent Subscription Invoices", latestInvoices: "Latest issued and paid commercial invoices", openInvoices: "Open invoices", noInvoices: "No subscription invoices found.", recentEnquiries: "Recent Sales Enquiries", latestProspects: "Latest prospects entering the commercial pipeline", openPipeline: "Open sales pipeline", noEnquiries: "No sales enquiries found.", platformEvent: "Platform event", activityRecorded: "Platform activity recorded.", noActivity: "No live platform activity yet.", database: "Database", trackedStorage: "Tracked Storage", queueFailures: "Queue Failures", security: "Security", monitoring: "Monitoring"
  },
  fr: {
    eyebrow: "Centre de commande de la plateforme", title: "Plateforme Cloud ShopCore", realtime: "État en temps réel", analytics: "Analyse commerciale", revenue: "Revenus d’abonnement vérifiés", health: "Surveillance de la santé des clients", activity: "Activité en direct de la plateforme", monitor: "Surveillance des services", refresh: "Actualiser", refreshing: "Actualisation des informations de la plateforme...",
    totalTenants: "Entreprises clientes", activeSubscriptions: "Abonnements actifs", verifiedRevenue: "Revenus vérifiés", activeOpportunities: "Opportunités actives", apiGateway: "Passerelle API", databaseCluster: "Cluster de base de données", needsReview: "À examiner", healthy: "Sain", live: "En direct", storage: "Stockage", tracked: "Suivi", backgroundJobs: "Tâches en arrière-plan", review: "Examiner", operational: "Opérationnel",
    dataReview: "L’accès aux données doit être examiné", monitoringActive: "Surveillance en direct active", newEnquiries: "Nouvelles demandes commerciales", pendingInvoices: "Factures en attente", invoiceHelper: "Factures d’abonnement émises et échues", pendingPayments: "Paiements en attente", awaitingActivation: "En attente d’activation", unreadAlerts: "Alertes non lues", failedPayments: "Paiements échoués", platformAdmins: "Administrateurs de la plateforme", paymentAttempts: "Tentatives de paiement", workspaceRequests: "Demandes d’espace de travail", loginSessions: "Sessions de connexion", storageAssets: "Éléments stockés", infrastructure: "Infrastructure", tenantRisks: "Risques clients", thisMonth: "Ce mois", lifetimePaid: "Total encaissé", activeTrials: "Essais actifs", workspace: "Espace de travail", noRisks: "Aucun risque client détecté.", recentInvoices: "Factures d’abonnement récentes", latestInvoices: "Dernières factures commerciales émises et payées", openInvoices: "Factures ouvertes", noInvoices: "Aucune facture d’abonnement trouvée.", recentEnquiries: "Demandes commerciales récentes", latestProspects: "Derniers prospects du pipeline commercial", openPipeline: "Pipeline commercial ouvert", noEnquiries: "Aucune demande commerciale trouvée.", platformEvent: "Événement de plateforme", activityRecorded: "Activité de plateforme enregistrée.", noActivity: "Aucune activité en direct pour le moment.", database: "Base de données", trackedStorage: "Stockage suivi", queueFailures: "Échecs de file d’attente", security: "Sécurité", monitoring: "Supervision"
  },
  rw: {
    eyebrow: "Ikigo kiyobora platform", title: "ShopCore Cloud Platform", realtime: "Imiterere y’ako kanya", analytics: "Isesengura ry’ubucuruzi", revenue: "Amafaranga y’ifatabuguzi yemejwe", health: "Gukurikirana imiterere y’ibigo", activity: "Ibikorwa bya platform", monitor: "Gukurikirana serivisi", refresh: "Ongera usubiremo", refreshing: "Kuvugurura amakuru ya platform...",
    totalTenants: "Ibigo byose", activeSubscriptions: "Amafatabuguzi akora", verifiedRevenue: "Amafaranga yemejwe", activeOpportunities: "Amahirwe y’ubucuruzi", apiGateway: "API Gateway", databaseCluster: "Ububiko bw’amakuru", needsReview: "Bisaba gusuzumwa", healthy: "Ni byiza", live: "Ako kanya", storage: "Ububiko", tracked: "Birakurikiranwa", backgroundJobs: "Imirimo yo mu nyuma", review: "Suzuma", operational: "Birakora",
    dataReview: "Uburenganzira ku makuru bugomba gusuzumwa", monitoringActive: "Gukurikirana birakora", newEnquiries: "Ibyifuzo bishya by’ubucuruzi", pendingInvoices: "Inyemezabuguzi zitegereje", invoiceHelper: "Inyemezabuguzi zatanzwe n’izarengeje igihe", pendingPayments: "Ubwishyu butegereje", awaitingActivation: "Bitegereje kwemezwa", unreadAlerts: "Amatangazo atasomwe", failedPayments: "Ubwishyu bwanze", platformAdmins: "Abayobozi ba platform", paymentAttempts: "Kugerageza kwishyura", workspaceRequests: "Ibyifuzo by’ahakorerwa", loginSessions: "Ibihe byo kwinjira", storageAssets: "Ibiri mu bubiko", infrastructure: "Ibikorwa remezo", tenantRisks: "Ibyago by’ibigo", thisMonth: "Uku kwezi", lifetimePaid: "Amafaranga yose yishyuwe", activeTrials: "Igerageza rikora", workspace: "Ahakorerwa", noRisks: "Nta byago by’ibigo byabonetse.", recentInvoices: "Inyemezabuguzi ziheruka", latestInvoices: "Inyemezabuguzi ziheruka gutangwa no kwishyurwa", openInvoices: "Inyemezabuguzi zifunguye", noInvoices: "Nta nyemezabuguzi zabonetse.", recentEnquiries: "Ibyifuzo by’ubucuruzi biheruka", latestProspects: "Abakiriya bashya bari mu nzira y’ubucuruzi", openPipeline: "Inzira y’ubucuruzi ifunguye", noEnquiries: "Nta byifuzo by’ubucuruzi byabonetse.", platformEvent: "Igikorwa cya platform", activityRecorded: "Igikorwa cya platform cyanditswe.", noActivity: "Nta bikorwa bya platform bihari ubu.", database: "Ububiko bw’amakuru", trackedStorage: "Ububiko bukurikiranwa", queueFailures: "Ibyanze mu murongo", security: "Umutekano", monitoring: "Gukurikirana"
  }
} as const;

export default function PlatformDashboard() {
  const { language } = useLanguage();
  const copy = dashboardCopy[language];
  const platformQ = useQuery({
    queryKey: ["platform-dashboard-commercial"],
    queryFn: async () => {
      await (supabase as any).rpc("expire_platform_impersonation_sessions");

      const [
        tenantsRes,
        invoicesRes,
        attemptsRes,
        subscriptionsRes,
        enquiriesRes,
        adminsRes,
        activityRes,
        supportRes,
        notificationsRes,
        healthRes,
        operationsRes,
        infrastructureRes,
      ] = await Promise.all([
        (supabase as any)
          .from("tenants")
          .select("id, name, subscription_plan, subscription_status, payment_status, trial_status, trial_ends_at, workspace_status, onboarding_completed, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("subscription_invoices")
          .select("id, tenant_id, invoice_no, status, currency, total, paid_at, due_date, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("payment_attempts")
          .select("id, tenant_id, invoice_id, amount, currency, payment_method, provider, provider_reference, status, attempted_at, verified_at")
          .order("attempted_at", { ascending: false }),
        (supabase as any)
          .from("tenant_subscriptions")
          .select("id, tenant_id, plan_code, status, billing_cycle, current_period_end, trial_ends_at, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("sales_inquiries")
          .select("id, company_name, contact_name, status, priority, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any).from("platform_admins").select("id, email, role, is_active"),
        (supabase as any).from("platform_activity_feed").select("*").order("created_at", { ascending: false }).limit(12),
        (supabase as any).from("platform_active_support_sessions").select("*").order("started_at", { ascending: false }),
        (supabase as any).from("platform_notifications").select("id").eq("status", "unread"),
        (supabase as any).from("platform_tenant_health_scores").select("*").order("health_score", { ascending: true }).limit(5),
        (supabase as any).from("platform_operations_summary").select("*").maybeSingle(),
        (supabase as any).from("platform_infrastructure_metrics").select("*").order("metric_date", { ascending: false }).limit(1),
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (adminsRes.error) throw adminsRes.error;

      return {
        tenants: (tenantsRes.data ?? []) as TenantRow[],
        invoices: invoicesRes.error ? [] : ((invoicesRes.data ?? []) as InvoiceRow[]),
        attempts: attemptsRes.error ? [] : ((attemptsRes.data ?? []) as PaymentAttemptRow[]),
        subscriptions: subscriptionsRes.error ? [] : ((subscriptionsRes.data ?? []) as SubscriptionRow[]),
        enquiries: enquiriesRes.error ? [] : ((enquiriesRes.data ?? []) as SalesInquiryRow[]),
        admins: (adminsRes.data ?? []) as PlatformAdminRow[],
        activity: activityRes.error ? [] : activityRes.data ?? [],
        supportSessions: supportRes.error ? [] : supportRes.data ?? [],
        unreadNotifications: notificationsRes.error ? 0 : (notificationsRes.data ?? []).length,
        tenantHealth: healthRes.error ? [] : healthRes.data ?? [],
        operations: operationsRes.error ? {} : operationsRes.data ?? {},
        infrastructure: infrastructureRes.error ? null : infrastructureRes.data?.[0] ?? null,
      };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const tables = [
      "tenants",
      "tenant_subscriptions",
      "subscription_invoices",
      "payment_attempts",
      "sales_inquiries",
      "subscription_events",
      "platform_notifications",
      "platform_workspace_requests",
      "platform_login_sessions",
      "platform_infrastructure_metrics",
      "platform_impersonation_sessions",
      "platform_impersonation_logs",
    ];

    const channel = tables.reduce(
      (currentChannel, table) =>
        currentChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => platformQ.refetch(),
        ),
      supabase.channel("platform-command-center-live"),
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [platformQ]);

  const tenants = platformQ.data?.tenants ?? [];
  const invoices = platformQ.data?.invoices ?? [];
  const attempts = platformQ.data?.attempts ?? [];
  const subscriptions = platformQ.data?.subscriptions ?? [];
  const enquiries = platformQ.data?.enquiries ?? [];
  const admins = platformQ.data?.admins ?? [];
  const activity = platformQ.data?.activity ?? [];
  const supportSessions = platformQ.data?.supportSessions ?? [];
  const tenantHealth = platformQ.data?.tenantHealth ?? [];
  const operations: any = platformQ.data?.operations ?? {};
  const infrastructure: any = platformQ.data?.infrastructure ?? null;

  const metrics = useMemo(() => {
    const totalTenants = tenants.length;
    const newThisMonth = tenants.filter((tenant) => thisMonth(tenant.created_at)).length;
    const activeSubscriptions =
      subscriptions.filter((subscription) => normalizeStatus(subscription.status) === "active").length ||
      tenants.filter((tenant) => normalizeStatus(tenant.subscription_status) === "active").length;

    const paidInvoices = invoices.filter((invoice) => normalizeStatus(invoice.status) === "paid");
    const monthlyRevenue = paidInvoices
      .filter((invoice) => thisMonth(invoice.paid_at || invoice.created_at))
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const pendingInvoices = invoices.filter((invoice) => ["issued", "pending", "overdue"].includes(normalizeStatus(invoice.status))).length;
    const pendingAttempts = attempts.filter((attempt) => ["pending", "processing", "initiated", "submitted"].includes(normalizeStatus(attempt.status))).length;
    const failedAttempts = attempts.filter((attempt) => normalizeStatus(attempt.status) === "failed").length;
    const verifiedRevenue =
      attempts
        .filter((attempt) => ["paid", "verified", "completed", "successful"].includes(normalizeStatus(attempt.status)))
        .reduce((sum, attempt) => sum + Number(attempt.amount || 0), 0) || totalRevenue;
    const activeOpportunities = enquiries.filter((inquiry) => ["reviewing", "contacted", "qualified", "proposal", "negotiation"].includes(normalizeStatus(inquiry.status))).length;
    const newEnquiries = enquiries.filter((inquiry) => normalizeStatus(inquiry.status) === "new").length;
    const qualifiedProspects = enquiries.filter((inquiry) => ["qualified", "proposal", "negotiation"].includes(normalizeStatus(inquiry.status))).length;
    const trialsAwaitingApproval = tenants.filter(isTrialAwaitingApproval).length;
    const activeTrials = tenants.filter(isActiveTrial).length;
    const awaitingActivation = tenants.filter(isWorkspaceAwaitingActivation).length;

    return {
      totalTenants,
      newThisMonth,
      activeSubscriptions,
      monthlyRevenue,
      totalRevenue,
      verifiedRevenue,
      platformAdmins: admins.filter((admin) => admin.is_active).length,
      transactions: attempts.length,
      activeSupport: supportSessions.length,
      unreadNotifications: platformQ.data?.unreadNotifications ?? 0,
      pendingInvoices,
      pendingAttempts,
      failedAttempts,
      activeOpportunities,
      newEnquiries,
      qualifiedProspects,
      trialsAwaitingApproval,
      activeTrials,
      awaitingActivation,
      workspaceRequests: Number(operations.open_workspace_requests || 0),
      activeLoginSessions: Number(operations.active_login_sessions || 0),
      storageAssets: Number(operations.active_storage_assets || 0),
      trackedStorageGb: Number(operations.tracked_storage_gb || 0),
      tenantRisks: Number(operations.tenant_risks || tenantHealth.length || 0),
    };
  }, [tenants, invoices, attempts, subscriptions, enquiries, admins, supportSessions, platformQ.data, operations, tenantHealth]);

  const platformCards = [
    { title: "Total Tenants", value: metrics.totalTenants.toLocaleString(), icon: Building2, color: "blue" as Tone, change: `+${metrics.newThisMonth} this month` },
    { title: "Active Subscriptions", value: metrics.activeSubscriptions.toLocaleString(), icon: ShieldCheck, color: "emerald" as Tone, change: `${metrics.totalTenants ? Math.round((metrics.activeSubscriptions / metrics.totalTenants) * 100) : 0}% active` },
    { title: "Verified Revenue", value: formatMoney(metrics.verifiedRevenue), icon: DollarSign, color: "violet" as Tone, change: `${formatMoney(metrics.monthlyRevenue)} this month` },
    { title: "Active Opportunities", value: metrics.activeOpportunities.toLocaleString(), icon: TrendingUp, color: "cyan" as Tone, change: `${metrics.qualifiedProspects} qualified` },
  ];

  const chartValues = useMemo(() => {
    const year = new Date().getFullYear();
    const buckets = Array.from({ length: 12 }, (_, month) => ({ month, value: 0 }));
    invoices
      .filter((invoice) => normalizeStatus(invoice.status) === "paid")
      .forEach((invoice) => {
        const sourceDate = invoice.paid_at || invoice.created_at;
        if (!sourceDate) return;
        const date = new Date(sourceDate);
        if (date.getFullYear() !== year) return;
        buckets[date.getMonth()].value += Number(invoice.total || 0);
      });
    const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
    return buckets.map((bucket) => ({ ...bucket, height: Math.max(8, Math.round((bucket.value / max) * 100)) }));
  }, [invoices]);

  const recentInvoices = invoices.slice(0, 5);
  const recentEnquiries = enquiries.slice(0, 5);
  const infrastructureStatus = infrastructure?.status || "operational";

  const systemHealth = [
    { title: "API Gateway", status: infrastructureStatus, color: statusTone(infrastructureStatus) },
    { title: "Database Cluster", status: platformQ.isError ? "Needs Review" : "Healthy", color: platformQ.isError ? ("orange" as Tone) : ("blue" as Tone) },
    { title: "Realtime", status: "Live", color: "blue" as Tone },
    { title: "Storage", status: metrics.trackedStorageGb > 0 ? `${metrics.trackedStorageGb.toFixed(2)} GB` : "Tracked", color: "emerald" as Tone },
    { title: "Background Jobs", status: Number(infrastructure?.queue_failures || 0) > 0 ? "Review" : "Operational", color: Number(infrastructure?.queue_failures || 0) > 0 ? ("orange" as Tone) : ("emerald" as Tone) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{copy.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-muted-foreground">
            Monitor commercial growth, subscription billing, payment verification, workspace activation, support operations, infrastructure and tenant risk from one control surface.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => platformQ.refetch()} disabled={platformQ.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${platformQ.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{copy.realtime}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${platformQ.isError ? "bg-orange-500" : "bg-emerald-500"}`} />
              <span className="text-sm font-black text-blue-950">{platformQ.isError ? "Data access needs review" : "Live monitoring active"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-1">
        {platformCards.map((card) => (
          <MetricCard key={card.title} {...card} loading={platformQ.isLoading} />
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
        <CommercialActionCard icon={FileText} title={copy.newEnquiries} value={metrics.newEnquiries} description={`${metrics.activeOpportunities} opportunities in progress`} tone="blue" to="/platform-admin/sales-inquiries" />
        <CommercialActionCard icon={ReceiptText} title={copy.pendingInvoices} value={metrics.pendingInvoices} description={copy.invoiceHelper} tone="orange" to="/platform-admin/invoices" />
        <CommercialActionCard icon={WalletCards} title={copy.pendingPayments} value={metrics.pendingAttempts} description={`${metrics.failedAttempts} failed attempts require review`} tone={metrics.failedAttempts > 0 ? "rose" : "violet"} to="/platform-admin/payment-attempts" />
        <CommercialActionCard icon={UserRoundCheck} title={copy.awaitingActivation} value={metrics.awaitingActivation} description={`${metrics.trialsAwaitingApproval} trials awaiting approval`} tone="cyan" to="/platform-admin/tenants" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1">
        <SmallCard icon={<Bell className="h-6 w-6" />} title={copy.unreadAlerts} value={metrics.unreadNotifications.toLocaleString()} tone="orange" />
        <SmallCard icon={<CreditCard className="h-6 w-6" />} title={copy.failedPayments} value={metrics.failedAttempts.toLocaleString()} tone="rose" />
        <SmallCard icon={<Users className="h-6 w-6" />} title={copy.platformAdmins} value={metrics.platformAdmins.toLocaleString()} tone="blue" />
        <SmallCard icon={<ShoppingBag className="h-6 w-6" />} title={copy.paymentAttempts} value={metrics.transactions.toLocaleString()} tone="emerald" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
        <SmallCard icon={<Building2 className="h-6 w-6" />} title={copy.workspaceRequests} value={metrics.workspaceRequests.toLocaleString()} tone="orange" />
        <SmallCard icon={<Lock className="h-6 w-6" />} title={copy.loginSessions} value={metrics.activeLoginSessions.toLocaleString()} tone="blue" />
        <SmallCard icon={<HardDrive className="h-6 w-6" />} title={copy.storageAssets} value={metrics.storageAssets.toLocaleString()} tone="cyan" />
        <SmallCard icon={<Server className="h-6 w-6" />} title={copy.infrastructure} value={String(infrastructureStatus).replace(/_/g, " ")} tone={statusTone(infrastructureStatus)} />
        <SmallCard icon={<ShieldCheck className="h-6 w-6" />} title={copy.tenantRisks} value={metrics.tenantRisks.toLocaleString()} tone={metrics.tenantRisks > 0 ? "orange" : "emerald"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{copy.analytics}</p>
              <h2 className="mt-2 text-2xl font-black text-foreground">{copy.revenue}</h2>
            </div>
            <BarChart3 className="h-7 w-7 text-violet-600" />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <SummaryValue label={copy.thisMonth} value={formatMoney(metrics.monthlyRevenue)} tone="violet" />
            <SummaryValue label={copy.lifetimePaid} value={formatMoney(metrics.totalRevenue)} tone="emerald" />
            <SummaryValue label={copy.activeTrials} value={metrics.activeTrials.toLocaleString()} tone="cyan" />
          </div>

          <div className="mt-8 flex h-72 items-end gap-3">
            {chartValues.map((item) => (
              <div key={item.month} className="flex flex-1 flex-col justify-end">
                <div className="rounded-t-xl bg-violet-700" style={{ height: `${item.height}%` }} title={formatMoney(item.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-black">{copy.health}</h3>
          </div>

          <div className="mt-5 space-y-3">
            {tenantHealth.length ? (
              tenantHealth.map((item: any) => (
                <div key={item.tenant_id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{item.tenant_name || "Workspace"}</p>
                    <p className="mt-1 text-xs font-bold capitalize text-muted-foreground">{String(item.health_status || "healthy").replace(/_/g, " ")}</p>
                  </div>
                  <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">{item.health_score}%</span>
                </div>
              ))
            ) : (
              <EmptyState title={copy.noRisks} tone="emerald" />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CommercialList title={copy.recentInvoices} description={copy.latestInvoices} icon={ReceiptText} actionLabel="Open invoices" actionTo="/platform-admin/invoices">
          {recentInvoices.length ? (
            recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">{invoice.invoice_no || "Subscription invoice"}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{formatDateTime(invoice.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">{formatMoney(Number(invoice.total || 0), invoice.currency || "RWF")}</p>
                  <StatusPill status={invoice.status || "unknown"} />
                </div>
              </div>
            ))
          ) : (
            <EmptyState title={copy.noInvoices} tone="blue" />
          )}
        </CommercialList>

        <CommercialList title={copy.recentEnquiries} description={copy.latestProspects} icon={TrendingUp} actionLabel="Open sales pipeline" actionTo="/platform-admin/sales-inquiries">
          {recentEnquiries.length ? (
            recentEnquiries.map((inquiry) => (
              <div key={inquiry.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">{inquiry.company_name || inquiry.contact_name || "Sales enquiry"}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{formatDateTime(inquiry.created_at)}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={inquiry.status || "new"} />
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{inquiry.priority || "normal"} priority</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title={copy.noEnquiries} tone="blue" />
          )}
        </CommercialList>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-black">{copy.activity}</h3>
          </div>

          <div className="mt-5 space-y-4">
            {activity.length ? (
              activity.map((event: any) => (
                <div key={`${event.category}-${event.id}`} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="pt-1"><div className="h-2.5 w-2.5 rounded-full bg-blue-600" /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-foreground">{event.title || "Platform event"}</p>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">{event.category || "event"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-muted-foreground">{event.description || "Platform activity recorded."}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground"><Clock className="h-3 w-3" />{formatDateTime(event.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title={copy.noActivity} tone="blue" />
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-black">{copy.monitor}</h3>
          </div>

          <div className="mt-6 grid gap-4">
            {systemHealth.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                <span className="font-bold text-foreground">{item.title}</span>
                <StatusPill status={String(item.status)} tone={item.color} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <SmallCard icon={<Database className="h-6 w-6" />} title={copy.database} value={platformQ.isError ? "Review" : "Healthy"} tone={platformQ.isError ? "orange" : "emerald"} />
        <SmallCard icon={<HardDrive className="h-6 w-6" />} title={copy.trackedStorage} value={`${metrics.trackedStorageGb.toFixed(2)} GB`} tone="blue" />
        <SmallCard icon={<Server className="h-6 w-6" />} title={copy.queueFailures} value={String(infrastructure?.queue_failures || 0)} tone={Number(infrastructure?.queue_failures || 0) > 0 ? "rose" : "emerald"} />
        <SmallCard icon={<ShieldCheck className="h-6 w-6" />} title={copy.security} value={metrics.activeLoginSessions > 0 ? `${metrics.activeLoginSessions} Sessions` : "Monitoring"} tone="violet" />
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, change, loading }: { title: string; value: string; icon: typeof Building2; color: Tone; change: string; loading: boolean }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClasses[color]}`}><Icon className="h-7 w-7" /></div>
        <ArrowUpRight className="h-5 w-5 text-slate-300" />
      </div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-4xl font-black text-foreground">{loading ? "..." : value}</p>
      <p className="mt-3 text-sm font-bold text-muted-foreground">{change}</p>
    </div>
  );
}

function CommercialActionCard({ icon: Icon, title, value, description, tone, to }: { icon: typeof FileText; title: string; value: number; description: string; tone: Tone; to: string }) {
  return (
    <Link to={to} className="group rounded-[1.5rem] border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClasses[tone]}`}><Icon className="h-6 w-6" /></div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-black text-foreground">{value.toLocaleString()}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}

function CommercialList({ title, description, icon: Icon, actionLabel, actionTo, children }: { title: string; description: string; icon: typeof ReceiptText; actionLabel: string; actionTo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-black text-foreground">{title}</h3>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to={actionTo}>{actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-black ${tone === "violet" ? "text-violet-700" : tone === "emerald" ? "text-emerald-700" : "text-cyan-700"}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status, tone }: { status: string; tone?: Tone }) {
  const resolvedTone = tone || statusTone(status);
  return <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-black capitalize tracking-[0.08em] ${toneClasses[resolvedTone]}`}>{status.replace(/_/g, " ")}</span>;
}

function EmptyState({ title, tone }: { title: string; tone: Tone }) {
  const Icon = tone === "emerald" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <Icon className={`h-5 w-5 ${tone === "emerald" ? "text-emerald-600" : "text-muted-foreground"}`} />
      <p className="text-sm font-bold text-muted-foreground">{title}</p>
    </div>
  );
}

function SmallCard({ icon, title, value, tone = "blue" }: { icon: React.ReactNode; title: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-black capitalize text-foreground">{value}</p>
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  orange: "bg-orange-50 text-orange-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  cyan: "bg-cyan-50 text-cyan-700",
};
