import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

  const inviteId = params.get("invite");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Checking invitation...");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const acceptInvite = async () => {
      try {
        if (!inviteId) throw new Error("Invalid invitation link.");

        if (!user) {
          localStorage.setItem("pending_invite_id", inviteId);
          navigate(`/auth?redirect=/accept-invite?invite=${inviteId}`);
          return;
        }

        const { data: invite, error: inviteError } = await (supabase as any)
          .from("user_invites")
          .select("*")
          .eq("id", inviteId)
          .single();

        if (inviteError) throw inviteError;
        if (!invite) throw new Error("Invitation not found.");
        if (invite.status !== "pending") throw new Error("This invitation is no longer pending.");

        const invitedEmail = String(invite.email || "").toLowerCase();
        const currentEmail = String(user.email || "").toLowerCase();

        if (invitedEmail && currentEmail && invitedEmail !== currentEmail) {
          throw new Error(`This invite was sent to ${invitedEmail}. Please sign in with that email.`);
        }

        const { error: memberError } = await (supabase as any)
          .from("tenant_members")
          .upsert(
            {
              tenant_id: invite.tenant_id,
              user_id: user.id,
            },
            { onConflict: "tenant_id,user_id" }
          );

        if (memberError) throw memberError;

        const { error: roleError } = await (supabase as any)
          .from("user_roles")
          .upsert(
            {
              tenant_id: invite.tenant_id,
              user_id: user.id,
              role: invite.role || "viewer",
            },
            { onConflict: "tenant_id,user_id" }
          );

        if (roleError) throw roleError;
        
        const allowedModules =
  invite.role === "cashier"
    ? ["dashboard", "pos", "sales", "customers", "loyalty"]
    : invite.role === "accountant"
      ? ["dashboard", "sales", "purchases", "expenses", "reports"]
      : invite.role === "inventory_officer"
        ? ["dashboard", "products", "inventory", "suppliers", "warehouses"]
        : ["dashboard"];

const permissionRows = allowedModules.map((module) => ({
  tenant_id: invite.tenant_id,
  role: invite.role || "viewer",
  module,
  can_view: true,
  can_create: ["pos", "sales", "customers", "purchases", "expenses", "products", "inventory"].includes(module),
  can_edit: ["customers", "products", "inventory", "expenses"].includes(module),
  can_delete: false,
  can_approve: false,
}));

const { error: permissionError } = await (supabase as any)
  .from("role_permissions")
  .upsert(permissionRows, {
    onConflict: "tenant_id,role,module",
  });

if (permissionError) throw permissionError;

        const { error: updateError } = await (supabase as any)
          .from("user_invites")
          .update({
            status: "accepted",
            accepted_by: user.id,
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invite.id);

        if (updateError) throw updateError;

        localStorage.removeItem("pending_invite_id");
        setAccepted(true);
        setMessage("Invitation accepted successfully.");
        toast.success("Workspace joined successfully");

        setTimeout(() => navigate("/dashboard"), 1200);
      } catch (error: any) {
        setAccepted(false);
        setMessage(error?.message || "Failed to accept invitation.");
        toast.error(error?.message || "Failed to accept invitation");
      } finally {
        setLoading(false);
      }
    };

    acceptInvite();
  }, [inviteId, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-sm">
        <CardContent className="p-8 text-center">
          {loading ? (
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-[#0b3d5c]" />
          ) : accepted ? (
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
          ) : (
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          )}

          <h1 className="text-2xl font-bold mb-2">Workspace Invitation</h1>
          <p className="text-sm text-muted-foreground mb-6">{message}</p>

          {!loading && !accepted && (
            <Button onClick={() => navigate("/auth")} className="rounded-2xl">
              <Mail className="w-4 h-4 mr-2" />
              Go to Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}