import type { WorkspaceAccessStatus } from "@/contexts/AuthContext";

/**
 * When the workspace is shut, and what stays reachable while it is.
 *
 * Two consumers read this and they must agree: the sidebar decides which menu
 * entries to draw, and the layout decides whether to render the page or the
 * lock panel. A menu link that leads to a lock panel — or a reachable page
 * with no way to navigate to it — is the failure this shared list prevents.
 */

export const WORKSPACE_LOCKED_STATUSES: WorkspaceAccessStatus[] = [
  "pending_payment",
  "expired",
  "trial_expired",
  "blocked",
];

/**
 * The screens that still do something while the subscription is not open:
 * the one that fixes it, the one that explains it, and the person's own
 * account and settings.
 */
export const LOCKED_REACHABLE_ROUTES = ["/billing", "/support", "/profile", "/settings"];

export function isWorkspaceLocked(status: WorkspaceAccessStatus): boolean {
  return WORKSPACE_LOCKED_STATUSES.includes(status);
}

export function isReachableWhileLocked(pathname: string): boolean {
  return LOCKED_REACHABLE_ROUTES.some((prefix) => pathname.startsWith(prefix));
}
