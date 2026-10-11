import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FileText,
  KeyRound,
  Lock,
  PenTool,
  ShieldCheck,
  Sparkles,
  Stamp,
  TriangleAlert,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ContractPaper } from "@/components/contracts/ContractPaper";
import { SignaturePad } from "@/components/onboarding/SignaturePad";
import { StatusPill } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  FULL_CONTRACT_STARTER,
  SAMPLE_CUSTOMER,
  SAMPLE_DEAL,
  SHORT_CONTRACT_STARTER,
  amountInWords,
  fillSample,
} from "@/lib/contractSample";
import { emptyDraft, type TemplateDraft } from "@/lib/contractTemplateDraft";
import { cn } from "@/lib/utils";

/**
 * Writing the agreement, with the finished document beside it.
 *
 * ## Why a preview and not just a text box
 *
 * The previous editor was a textarea in a small dialog. An author wrote
 * `{{amount}}` and had no way to see the sentence a customer would read, no way
 * to see whether the clause still scanned once the token became "RWF 180,000",
 * and no way at all to see where the signature and stamp would land. The first
 * time anybody saw the actual document was when a customer downloaded one.
 *
 * So the right-hand side renders the whole contract, filled with a specimen
 * customer, using the same component the signing screen and the billing page
 * use. What is on the right is what a customer gets — including the two
 * signature blocks, which is the plainest possible answer to "where does the
 * stamp go".
 *
 * ## Why the work is split into three tabs
 *
 * They are three different jobs done at three different times. The wording is
 * drafted and redrafted; the registered details are filled in once and
 * corrected rarely; the signature is attached deliberately, with a PIN, and
 * should not be sitting in the same scroll as a paragraph somebody is editing.
 *
 * ## Why attaching a mark asks for the PIN
 *
 * Words can be corrected. A signature binds ShopCore to every contract this
 * template will ever issue, so it is confirmed by the person doing it rather
 * than by the fact that somebody logged in this morning. The field appears only
 * when a mark has actually changed — asking for a PIN on every save is how
 * people learn to type it without reading why.
 */

/** The four fields whose change the server will ask for a PIN about. */
const SIGNING_FIELDS = [
  "providerSignatureImage",
  "providerStampImage",
  "providerSignerName",
  "providerSignerTitle",
] as const;

export function ContractTemplateEditor({
  draft,
  placeholders,
  providerDefaults,
  pinConfigured,
  saving,
  onClose,
  onSave,
}: {
  draft: TemplateDraft | null;
  placeholders: { token: string; describes: string; group: string }[];
  providerDefaults: { legal_name: string; address: string; governing_law: string } | null;
  /** Whether this admin has a signing PIN at all — nothing can be signed without one. */
  pinConfigured: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: TemplateDraft, pin: string | null) => void;
}) {
  const [local, setLocal] = useState<TemplateDraft>(emptyDraft);
  /** What was opened, so a change to the marks can be told from a re-save. */
  const [original, setOriginal] = useState<TemplateDraft>(emptyDraft);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState("agreement");

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!draft) return;

    setLocal(draft);
    setOriginal(draft);
    setPin("");
    setTab("agreement");
  }, [draft]);

  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) =>
    setLocal((previous) => ({ ...previous, [key]: value }));

  /* A {{token}} nothing can fill would print literally on a real contract. */
  const unknown = useMemo(() => {
    const used = [...new Set(local.body.match(/\{\{[^}]+\}\}/g) ?? [])];
    return used.filter((token) => !placeholders.some((p) => p.token === token));
  }, [local.body, placeholders]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { token: string; describes: string }[]>();

    for (const placeholder of placeholders) {
      const list = groups.get(placeholder.group) ?? [];
      list.push(placeholder);
      groups.set(placeholder.group, list);
    }

    return [...groups.entries()];
  }, [placeholders]);

  /**
   * Did the marks move?
   *
   * Compared against what was opened rather than "is there a signature":
   * saving a template that already carries one must not ask for a PIN, or the
   * PIN becomes a thing you type to dismiss a box.
   */
  const signingChanged = SIGNING_FIELDS.some((field) => {
    const before = original[field] ?? "";
    const after = local[field] ?? "";
    return before !== after;
  });

  /**
   * Inserts a token where the cursor is, not at the end of the document.
   *
   * The old editor appended, so inserting `{{amount}}` while editing clause 3
   * dropped it after the governing-law clause, and the author had to go and
   * find it. Selection is restored after the insert so typing carries on where
   * it left off.
   */
  const insertToken = (token: string) => {
    const field = bodyRef.current;

    if (!field) {
      set("body", `${local.body}${token}`);
      return;
    }

    const start = field.selectionStart ?? local.body.length;
    const end = field.selectionEnd ?? start;
    const next = `${local.body.slice(0, start)}${token}${local.body.slice(end)}`;

    set("body", next);

    // After React has painted the new value, or the caret lands in the old one.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const previewProvider = {
    legalName: local.providerLegalName.trim() || providerDefaults?.legal_name || "ShopCore",
    tin: local.providerTin.trim() || null,
    registrationNo: local.providerRegistrationNo.trim() || null,
    address: local.providerAddress.trim() || providerDefaults?.address || null,
    email: local.providerEmail.trim() || null,
    phone: local.providerPhone.trim() || null,
    governingLaw:
      local.governingLaw.trim() || providerDefaults?.governing_law || "the Republic of Rwanda",
    signerName: local.providerSignerName.trim() || null,
    signerTitle: local.providerSignerTitle.trim() || null,
  };

  const previewBody = useMemo(
    () => fillSample(local.body, previewProvider),
    // The provider block is small and cheap to re-fill; listing every field
    // would be noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [local.body, JSON.stringify(previewProvider)],
  );

  const pinNeeded = signingChanged;
  const pinValid = /^\d{4,8}$/.test(pin);

  const canSave =
    local.name.trim().length > 0 &&
    local.body.trim().length > 0 &&
    !saving &&
    (!pinNeeded || (pinConfigured && pinValid));

  const attemptSave = () => {
    if (pinNeeded && !pinConfigured) {
      setTab("signature");
      toast.error("Set a signing PIN first", {
        description: "A signature cannot be attached until you have one.",
      });
      return;
    }

    if (pinNeeded && !pinValid) {
      setTab("signature");
      toast.error("Enter your signing PIN", {
        description: "It confirms that you are the one attaching this signature.",
      });
      return;
    }

    onSave(local, pinNeeded ? pin : null);
  };

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + SAMPLE_DEAL.termMonths);

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[94vh] max-w-[1500px] flex-col gap-0 overflow-hidden p-0 sm:w-[97vw]">
        {/* ------------------------------------------------------------ bar */}
        {/* `pr-14` clears the dialog's own close button, which is absolutely
            positioned at top-right and would otherwise sit on top of Save. */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3.5 pl-5 pr-14">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              {draft?.id ? local.name || "Edit template" : "New contract template"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Write it once. The fields are filled from each customer's plan and signup details the
              moment they sign.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {local.isActive ? <StatusPill tone="emerald">Live</StatusPill> : null}
            {signingChanged ? (
              <StatusPill tone="amber" icon={KeyRound}>
                PIN required
              </StatusPill>
            ) : null}

            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={attemptSave}>
              {saving ? "Saving…" : draft?.id ? "Save changes" : "Create template"}
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
          {/* ------------------------------------------------------- editing */}
          <div className="flex min-h-0 flex-col border-border lg:border-r">
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <div className="px-5 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="agreement" className="flex-1 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Agreement
                  </TabsTrigger>
                  <TabsTrigger value="parties" className="flex-1 gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Parties
                  </TabsTrigger>
                  <TabsTrigger value="signature" className="flex-1 gap-1.5">
                    <PenTool className="h-3.5 w-3.5" />
                    Signature
                    {signingChanged ? (
                      <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                {/* ------------------------------------------------ agreement */}
                <TabsContent value="agreement" className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contract-name">Name</Label>
                      <Input
                        id="contract-name"
                        value={local.name}
                        placeholder="Standard service agreement"
                        onChange={(event) => set("name", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contract-description">Internal note</Label>
                      <Input
                        id="contract-description"
                        value={local.description}
                        placeholder="Never shown to customers"
                        onChange={(event) => set("description", event.target.value)}
                      />
                    </div>
                  </div>

                  {/*
                    Starters, offered where the blank page is.

                    "New template" onto an empty box asks somebody to draft a
                    subscription contract from memory, and what gets written is
                    four clauses about money and none about data, liability or
                    notices. Starting complete makes omission a decision.
                  */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                    <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-xs text-muted-foreground">Start from</span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg text-[11px]"
                      onClick={() => set("body", FULL_CONTRACT_STARTER)}
                    >
                      Full agreement (22 clauses)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg text-[11px]"
                      onClick={() => set("body", SHORT_CONTRACT_STARTER)}
                    >
                      Short agreement
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="contract-body">The agreement</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {local.body.split("\n").length} lines
                      </span>
                    </div>

                    <Textarea
                      id="contract-body"
                      ref={bodyRef}
                      value={local.body}
                      rows={22}
                      className="font-data text-xs leading-relaxed"
                      onChange={(event) => set("body", event.target.value)}
                    />

                    <p className="text-[11px] text-muted-foreground">
                      A line in capitals becomes a heading. "3. PAYMENT" becomes a numbered clause.
                      Indented lines belong to the clause above.
                    </p>
                  </div>

                  {unknown.length > 0 ? (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {unknown.join(", ")} {unknown.length === 1 ? "is" : "are"} not a field we
                        can fill, and will print exactly as written on the contract.
                      </span>
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Insert a field at the cursor
                    </p>

                    {grouped.map(([group, tokens]) => (
                      <div key={group} className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {group}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {tokens.map((placeholder) => (
                            <button
                              key={placeholder.token}
                              type="button"
                              title={placeholder.describes}
                              className="rounded-lg border border-border px-2 py-1 font-data text-[10px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                              onClick={() => insertToken(placeholder.token)}
                            >
                              {placeholder.token}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* -------------------------------------------------- parties */}
                <TabsContent value="parties" className="mt-4 space-y-4">
                  <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    The customer's side is filled in from their signup — name, TIN, address, phone.
                    This is ShopCore's side, and without it the agreement identifies one party by
                    its registered details and the other by a brand name.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="provider-legal-name">Registered name</Label>
                    <Input
                      id="provider-legal-name"
                      value={local.providerLegalName}
                      placeholder={providerDefaults?.legal_name ?? "ShopCore Ltd"}
                      onChange={(event) => set("providerLegalName", event.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="provider-tin">TIN</Label>
                      <Input
                        id="provider-tin"
                        value={local.providerTin}
                        placeholder="102938475"
                        onChange={(event) => set("providerTin", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="provider-reg">Registration number</Label>
                      <Input
                        id="provider-reg"
                        value={local.providerRegistrationNo}
                        placeholder="RW-123456789"
                        onChange={(event) => set("providerRegistrationNo", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="provider-address">Registered address</Label>
                    <Input
                      id="provider-address"
                      value={local.providerAddress}
                      placeholder={providerDefaults?.address ?? "Kigali, Rwanda"}
                      onChange={(event) => set("providerAddress", event.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="provider-email">Email for notices</Label>
                      <Input
                        id="provider-email"
                        value={local.providerEmail}
                        placeholder="legal@shopcore.rw"
                        onChange={(event) => set("providerEmail", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="provider-phone">Phone for notices</Label>
                      <Input
                        id="provider-phone"
                        value={local.providerPhone}
                        placeholder="+250 788 000 000"
                        onChange={(event) => set("providerPhone", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="governing-law">Governing law</Label>
                    <Input
                      id="governing-law"
                      value={local.governingLaw}
                      placeholder={providerDefaults?.governing_law ?? "the Republic of Rwanda"}
                      onChange={(event) => set("governingLaw", event.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Printed in the execution block, and available to the body as{" "}
                      <span className="font-data">{"{{governing_law}}"}</span>.
                    </p>
                  </div>
                </TabsContent>

                {/* ------------------------------------------------ signature */}
                <TabsContent value="signature" className="mt-4 space-y-4">
                  <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    These go on every contract issued from this template, in the{" "}
                    <strong className="font-semibold text-foreground">For the Provider</strong> block
                    you can see on the right. The customer's own signature and stamp land in the
                    block beside it when they sign.
                  </p>

                  {/*
                    Draw or upload, the same control the customer signs with.

                    An operator with a scan should not have to find a scanner
                    again, and one signing from a laptop trackpad should not be
                    forced to produce a file. The same component means both
                    sides of the agreement are made the same way.
                  */}
                  <SignaturePad
                    label="ShopCore's signature"
                    required={false}
                    value={local.providerSignatureImage}
                    onChange={(value) => set("providerSignatureImage", value)}
                    hint="Draw it, or upload a scan. Applied to every contract from this template."
                  />

                  <ImageSlot
                    label="Company stamp"
                    icon={Stamp}
                    hint="Optional — PNG or JPG under 2 MB"
                    value={local.providerStampImage}
                    onChange={(value) => set("providerStampImage", value)}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="provider-signer-name">Signed by</Label>
                      <Input
                        id="provider-signer-name"
                        value={local.providerSignerName}
                        placeholder="Patrick Yumvagusenga"
                        onChange={(event) => set("providerSignerName", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="provider-signer-title">Title</Label>
                      <Input
                        id="provider-signer-title"
                        value={local.providerSignerTitle}
                        placeholder="Director, ShopCore"
                        onChange={(event) => set("providerSignerTitle", event.target.value)}
                      />
                    </div>
                  </div>

                  {/*
                    The PIN, shown only once a mark has actually moved.

                    A field that is always there is a field people fill in
                    without reading. Appearing exactly when the signature
                    changed is what makes it mean something.
                  */}
                  {signingChanged ? (
                    <div
                      className={cn(
                        "space-y-2 rounded-2xl border p-4",
                        pinConfigured
                          ? "border-primary/40 bg-primary/5"
                          : "border-destructive/40 bg-destructive/10",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {pinConfigured ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}

                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground">
                            {pinConfigured
                              ? "Confirm it is you"
                              : "You have no signing PIN yet"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pinConfigured
                              ? "Attaching ShopCore's mark binds the company on every contract this template issues, so it asks for your signing PIN."
                              : "Close this and set one on the Contract Templates page — a signature cannot be attached without it."}
                          </p>
                        </div>
                      </div>

                      {pinConfigured ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="signing-pin" className="text-xs">
                            Signing PIN
                          </Label>
                          <Input
                            id="signing-pin"
                            type="password"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="••••"
                            className="max-w-[180px] tracking-[0.4em]"
                            value={pin}
                            onChange={(event) =>
                              setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Five wrong tries locks it for fifteen minutes.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-accent/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                      checked={local.isActive}
                      onChange={(event) => set("isActive", event.target.checked)}
                    />
                    <span className="text-sm text-foreground">
                      Make this the live contract — the one new customers sign.
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Activating this stands every other template down.
                      </span>
                    </span>
                  </label>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* ------------------------------------------------------- preview */}
          <div className="hidden min-h-0 flex-col bg-muted/30 lg:flex">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                What the customer sees
              </span>

              <StatusPill tone="sky">Sample data</StatusPill>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-7 shadow-sm">
                <ContractPaper
                  reference="SC-2026-0901"
                  templateName={local.name || "Untitled template"}
                  templateVersion={1}
                  provider={{
                    caption: "Between",
                    name: previewProvider.legalName,
                    details: [
                      previewProvider.tin ? `TIN: ${previewProvider.tin}` : null,
                      previewProvider.registrationNo
                        ? `Reg. No: ${previewProvider.registrationNo}`
                        : null,
                      previewProvider.address,
                      previewProvider.email ? `Email: ${previewProvider.email}` : null,
                      previewProvider.phone ? `Tel: ${previewProvider.phone}` : null,
                    ].filter((line): line is string => Boolean(line)),
                    role: "the Provider",
                  }}
                  customer={{
                    caption: "And",
                    name: SAMPLE_CUSTOMER.companyName,
                    details: [
                      `TIN: ${SAMPLE_CUSTOMER.tin}`,
                      SAMPLE_CUSTOMER.address,
                      `Email: ${SAMPLE_CUSTOMER.ownerEmail}`,
                      `Tel: ${SAMPLE_CUSTOMER.phone}`,
                    ],
                    role: "the Customer",
                  }}
                  terms={[
                    { label: "Plan", value: SAMPLE_DEAL.planName },
                    { label: "Billing", value: SAMPLE_DEAL.cycleLabel },
                    {
                      label: "Amount",
                      value: `${SAMPLE_DEAL.currency} ${SAMPLE_DEAL.amount.toLocaleString()}`,
                    },
                    {
                      label: "Term",
                      value: `${today} — ${periodEnd.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}`,
                    },
                  ]}
                  amountInWords={`${amountInWords(SAMPLE_DEAL.amount)} ${SAMPLE_DEAL.currency}`}
                  body={previewBody}
                  execution={`IN WITNESS WHEREOF the parties have executed this agreement on ${today}, and agree that it is governed by the laws of ${previewProvider.governingLaw}.`}
                  signatures={[
                    {
                      caption: "For the Provider",
                      signature: local.providerSignatureImage,
                      stamp: local.providerStampImage,
                      name: previewProvider.signerName || previewProvider.legalName,
                      subtitle: previewProvider.signerTitle || "Authorised signatory",
                      date: today,
                      emptyHint: "ShopCore's signature goes here — add it on the Signature tab",
                      awaiting: true,
                    },
                    {
                      caption: "For the Customer",
                      signature: null,
                      stamp: null,
                      name: SAMPLE_CUSTOMER.ownerName,
                      subtitle: `for ${SAMPLE_CUSTOMER.companyName}`,
                      date: today,
                      emptyHint: "The customer signs here when they accept",
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One uploadable image, shown as itself once chosen.
 *
 * White behind it deliberately — these are near-black marks that end up on a
 * white PDF page, and `bg-[#ffffff]` rather than `bg-white` because index.css
 * force-darkens the latter in dark mode.
 */
function ImageSlot({
  label,
  icon: Icon,
  hint,
  value,
  onChange,
}: {
  label: string;
  icon: typeof PenTool;
  hint: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);

  /** Two megabytes — a photographed mark, not a scanned document. */
  const MAX_BYTES = 2 * 1024 * 1024;

  const pick = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("That image is too large", { description: "Please use a file under 2 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error("That image could not be read.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex h-7 items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-foreground">{label}</span>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => onChange(null)}
          >
            <X className="mr-1 h-3 w-3" />
            Remove
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="h-32 rounded-2xl border border-border bg-[#ffffff] p-2">
          <img src={value} alt={label} className="h-full w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <Icon className="h-5 w-5" />
          <span className="flex items-center gap-1 text-sm font-medium text-foreground">
            <Upload className="h-3.5 w-3.5" />
            Upload the stamp
          </span>
          <span className="text-[11px]">{hint}</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />
    </div>
  );
}
