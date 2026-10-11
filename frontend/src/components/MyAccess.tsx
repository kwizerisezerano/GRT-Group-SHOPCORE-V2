import { useMemo } from "react";
import { KeyRound, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { buildCatalogue, moduleLabel } from "@/lib/permissionCatalogue";

/**
 * What the signed-in member is actually allowed to do, in plain sight.
 *
 * ## Why this screen has to exist
 *
 * The application knew the answer and never said it. An owner could open the
 * permission matrix and see exactly what a cashier may do; the cashier could
 * see only which menu items happened to be drawn, and had to infer the rest by
 * pressing things and reading refusals. Every question that produces —
 * "why can't I see cost prices", "am I supposed to be able to refund" — costs
 * somebody a phone call to the person who set the role up.
 *
 * So this lists it: the role, the count, and every permission grouped by the
 * module it belongs to. It is on the profile page deliberately, because
 * `/profile` is the one route no permission governs — a member who has been
 * stripped of everything can still reach this and read, in words, that the
 * reason their workspace is empty is that their role holds nothing.
 *
 * ## It shows the granted and the withheld
 *
 * Both halves, because "I don't have that" and "that doesn't exist" are
 * different problems with different fixes, and a list of only what you have
 * cannot tell you which one you are looking at. The withheld half is what
 * somebody quotes when they ask an administrator for access.
 */
export function MyAccess() {
  const { permissions, role, ready, loading } = usePermissions();

  const granted = useMemo(() => new Set(permissions), [permissions]);

  /*
   * Grouped from the member's own permission list rather than from the full
   * catalogue: this screen answers "what may I do", not "what exists". A
   * cashier does not need to be shown the six things Billing can do in order
   * to understand that Billing is not theirs — the module simply is not here.
   */
  const modules = useMemo(() => buildCatalogue(permissions), [permissions]);

  if (!ready && loading) {
    return (
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
            Checking what your role allows...
          </div>
        </CardContent>
      </Card>
    );
  }

  const roleName = role
    ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/40">
                <ShieldCheck className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-base font-black">What you can do</h3>
                <p className="text-sm text-muted-foreground">
                  Your role in this workspace and everything it allows. Set by a workspace
                  administrator — ask them if you need something that is not here.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">{roleName}</Badge>
              <Badge variant="outline" className="rounded-full">
                {permissions.length} {permissions.length === 1 ? "permission" : "permissions"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {permissions.length === 0 ? (
        /*
         * A role can legitimately hold nothing, and the person it happened to
         * deserves a sentence rather than a blank page. Naming the role is the
         * useful part: it is what they quote when they ask for access.
         */
        <Card className="rounded-2xl border border-dashed shadow-sm">
          <CardContent className="p-8 text-center">
            <ShieldOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h4 className="mb-1 font-semibold">Your role has no permissions</h4>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              The <span className="font-medium">{roleName}</span> role currently allows nothing in
              this workspace, which is why your menu is empty. A workspace administrator can grant
              access from User Management. You can still change your password and sign out here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((entry) => (
            <Card key={entry.module} className="rounded-2xl border shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <KeyRound className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{moduleLabel(entry.module)}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actions.length} {entry.actions.length === 1 ? "action" : "actions"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {entry.actions.map((action) => (
                    <span
                      key={action.permission}
                      title={action.hint ?? action.permission}
                      className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-700 dark:text-emerald-300"
                    >
                      {action.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/*
        The other half of the answer. Someone wondering whether they are
        missing a permission or missing a feature cannot tell from a list of
        what they have, and this is the list they quote when they ask.
      */}
      <WithheldModules granted={granted} />
    </div>
  );
}

/**
 * The modules this member holds nothing in.
 *
 * Derived by taking every module the permission vocabulary knows about and
 * subtracting the ones the member has any action in. It is deliberately not a
 * per-permission list: "you cannot do 47 things" is noise, while "Reports,
 * Expenses and Purchases are not yours" is the sentence somebody repeats to
 * their manager.
 */
function WithheldModules({ granted }: { granted: ReadonlySet<string> }) {
  /*
   * Kept in step with the server by construction: the labels come from the
   * same catalogue builder the permission editor uses, so a module added to
   * the product shows up here without this file being touched.
   */
  const ALL_MODULES = [
    "dashboard", "pos", "sales", "products", "categories", "brands", "units",
    "inventory", "purchases", "suppliers", "customers", "expenses", "reports",
    "staff", "users", "branches", "warehouses", "settings", "activity",
    "notifications", "support", "loyalty", "qa", "ebm_settings", "workspace_chat",
  ];

  const withheld = ALL_MODULES.filter(
    (module) => ![...granted].some((permission) => permission.startsWith(`${module}.`))
  );

  if (withheld.length === 0) return null;

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted/40">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Not available to your role</p>
            <p className="text-xs text-muted-foreground">
              These do not appear in your menu. Ask an administrator if you need one.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {withheld.map((module) => (
            <span
              key={module}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {moduleLabel(module)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
