import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { SectionCard, StatusPill } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { platformApi } from "@/lib/apiClient";

/**
 * The signing PIN, and the one place it is set.
 *
 * ## What it is for
 *
 * Attaching ShopCore's signature or stamp to a contract template is the act
 * that binds the company to every agreement that template will ever issue. The
 * PIN is re-typed at that moment and nowhere else, so the console asks a
 * question the session cannot answer: is the person at this keyboard still the
 * person who signed in?
 *
 * ## Why the password guards the PIN
 *
 * Changing what authorises a signature has to be at least as hard as signing
 * in, so setting or replacing the PIN costs the account password. The PIN
 * itself then costs nothing to use — which is the point. A password re-typed
 * several times an hour ends up on a sticky note.
 *
 * ## Why this sits on the contract page
 *
 * It could live in account settings, where nobody would find it until the first
 * time they were stopped by it. Here, an operator sees "no signing PIN set"
 * beside the templates it gates, before they need it rather than in the middle
 * of trying to do something.
 */

export function SigningPinCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: ["platform", "signing-pin"],
    queryFn: () => platformApi.signingPinStatus(),
  });

  const status = statusQ.data;
  const configured = Boolean(status?.configured);
  const lockedUntil = status?.locked_until ? new Date(status.locked_until) : null;
  const locked = lockedUntil !== null && lockedUntil.getTime() > Date.now();

  return (
    <>
      <SectionCard
        icon={configured ? ShieldCheck : KeyRound}
        tone={configured ? "emerald" : "amber"}
        title="Signing PIN"
        description="Re-typed whenever ShopCore's signature or stamp is attached to a template. Nothing else asks for it."
        actions={
          <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            {configured ? "Change PIN" : "Set a PIN"}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {configured ? (
            <StatusPill tone="emerald" icon={ShieldCheck}>
              PIN set
            </StatusPill>
          ) : (
            <StatusPill tone="amber" icon={TriangleAlert}>
              No PIN — signatures cannot be attached
            </StatusPill>
          )}

          {locked ? (
            <StatusPill tone="rose" icon={Lock}>
              Locked until {lockedUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </StatusPill>
          ) : null}

          {status?.set_at ? (
            <span className="text-xs text-muted-foreground">
              Set on{" "}
              {new Date(status.set_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>

        {!configured ? (
          <p className="text-xs text-muted-foreground">
            Set one before you attach a signature. Four to eight digits, not repeated and not a
            simple run — five wrong tries locks it for fifteen minutes.
          </p>
        ) : null}
      </SectionCard>

      <SigningPinDialog
        open={open}
        configured={configured}
        onClose={() => setOpen(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["platform", "signing-pin"] });
          setOpen(false);
        }}
      />
    </>
  );
}

function SigningPinDialog({
  open,
  configured,
  onClose,
  onSaved,
}: {
  open: boolean;
  configured: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");

  const reset = () => {
    setPin("");
    setConfirm("");
    setPassword("");
  };

  const saveM = useMutation({
    mutationFn: () => platformApi.setSigningPin({ pin, password }),
    onSuccess: () => {
      toast.success(configured ? "Your signing PIN was changed." : "Your signing PIN is set.");
      reset();
      onSaved();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The PIN could not be saved."),
  });

  /*
   * Typed twice, and the two have to agree.
   *
   * A PIN is short, unmemorable at first, and the only way to discover you
   * mistyped it is to be locked out of attaching a signature later, with no
   * idea what you typed. The confirmation costs four keystrokes.
   */
  const mismatch = confirm.length > 0 && confirm !== pin;
  const valid = /^\d{4,8}$/.test(pin) && confirm === pin && password.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{configured ? "Change your signing PIN" : "Set your signing PIN"}</DialogTitle>
          <DialogDescription>
            You will type this whenever you attach ShopCore's signature or stamp to a contract
            template. It is yours alone — other admins set their own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">New PIN</Label>
            <Input
              id="new-pin"
              inputMode="numeric"
              autoComplete="new-password"
              type="password"
              placeholder="4 to 8 digits"
              value={pin}
              // Filtered on input rather than validated on submit: a field that
              // silently refuses a letter teaches the rule immediately.
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <p className="text-[11px] text-muted-foreground">
              Not 1111, not 1234 — those are the first codes anybody tries.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Confirm PIN</Label>
            <Input
              id="confirm-pin"
              inputMode="numeric"
              autoComplete="new-password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            {mismatch ? (
              <p className="text-[11px] font-medium text-destructive">
                The two PINs do not match.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin-password">Your account password</Label>
            <Input
              id="pin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Asked for because changing what authorises a signature should be as hard as signing
              in.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button disabled={!valid || saveM.isPending} onClick={() => saveM.mutate()}>
            {saveM.isPending ? "Saving…" : configured ? "Change PIN" : "Set PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
