import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileSignature,
  FileText,
  Loader2,
  PenTool,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyNote,
  PageContainer,
  PrimaryAction,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/patterns";
import { platformApi, type ContractTemplate } from "@/lib/apiClient";
import { emptyDraft, type TemplateDraft } from "@/lib/contractTemplateDraft";
import { ContractTemplateEditor } from "@/pages/platform-admin/components/ContractTemplateEditor";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { SigningPinCard } from "@/pages/platform-admin/components/SigningPinCard";

/**
 * The agreement a customer signs before they pay.
 *
 * ## Why a template rather than a document per customer
 *
 * The contract is written once here with `{{placeholders}}`, and the signing
 * step fills them from the plan and the signup form. Rendering a fresh copy per
 * customer would mean a wording correction never reaches anyone who signed
 * before it, and no single answer to "what does our contract currently say".
 *
 * Exactly one template is live at a time. Activating one stands the others
 * down, so there is never a question of which agreement a new customer is
 * being shown, and the live one cannot be deleted out from under the signup
 * flow — activate its replacement first.
 *
 * The version number moves only when the body changes. Renaming a template or
 * switching which one is live does not change what anybody agreed to, and
 * bumping the number for that would make it useless as a record.
 *
 * ## What this page is responsible for
 *
 * Listing, activating and deleting; the signing PIN that gates ShopCore's own
 * signature; and opening the editor. The editor itself — the wording, the
 * parties, the marks, and the live preview of the finished contract — is
 * `ContractTemplateEditor`, because it outgrew this file the moment it stopped
 * being a textarea in a box.
 */

const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

/** The console's editable shape, from what the API returned. */
const toDraft = (template: ContractTemplate): TemplateDraft => ({
  id: template.id,
  name: template.name,
  description: template.description ?? "",
  body: template.body,
  isActive: template.is_active,
  providerSignatureImage: template.provider_signature_image,
  providerStampImage: template.provider_stamp_image,
  providerSignerName: template.provider_signer_name ?? "",
  providerSignerTitle: template.provider_signer_title ?? "",
  providerLegalName: template.provider_legal_name ?? "",
  providerTin: template.provider_tin ?? "",
  providerRegistrationNo: template.provider_registration_no ?? "",
  providerAddress: template.provider_address ?? "",
  providerEmail: template.provider_email ?? "",
  providerPhone: template.provider_phone ?? "",
  governingLaw: template.governing_law ?? "",
});

export default function ContractTemplates() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContractTemplate | null>(null);

  const templatesQ = useQuery({
    queryKey: ["platform", "contract-templates"],
    queryFn: () => platformApi.contractTemplates(),
  });

  /*
   * Read here as well as inside the PIN card, so the editor knows whether a
   * signature can be attached at all before somebody spends five minutes
   * drawing one. React Query serves both from the same cache entry.
   */
  const pinQ = useQuery({
    queryKey: ["platform", "signing-pin"],
    queryFn: () => platformApi.signingPinStatus(),
  });

  const templates = useMemo(() => templatesQ.data?.templates ?? [], [templatesQ.data]);
  const placeholders = templatesQ.data?.placeholders ?? [];
  const providerDefaults = templatesQ.data?.provider_defaults ?? null;
  const live = templates.find((template) => template.is_active) ?? null;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["platform", "contract-templates"] });

  const saveM = useMutation({
    mutationFn: async ({ input, pin }: { input: TemplateDraft; pin: string | null }) => {
      const payload = {
        name: input.name.trim(),
        description: input.description.trim() || null,
        body: input.body,
        isActive: input.isActive,
        providerSignatureImage: input.providerSignatureImage,
        providerStampImage: input.providerStampImage,
        providerSignerName: input.providerSignerName.trim() || null,
        providerSignerTitle: input.providerSignerTitle.trim() || null,
        providerLegalName: input.providerLegalName.trim() || null,
        providerTin: input.providerTin.trim() || null,
        providerRegistrationNo: input.providerRegistrationNo.trim() || null,
        providerAddress: input.providerAddress.trim() || null,
        providerEmail: input.providerEmail.trim() || null,
        providerPhone: input.providerPhone.trim() || null,
        governingLaw: input.governingLaw.trim() || null,
        // Sent only when a mark moved. The server checks against what it holds
        // rather than trusting this, so an omitted PIN on a signature change is
        // refused there too.
        ...(pin ? { pin } : {}),
      };

      return input.id
        ? platformApi.updateContractTemplate(input.id, payload)
        : platformApi.createContractTemplate(payload);
    },
    onSuccess: async (_data, variables) => {
      await invalidate();
      // A wrong PIN counts against the lockout, so the card's status is stale
      // after any save that carried one.
      if (variables.pin) {
        await queryClient.invalidateQueries({ queryKey: ["platform", "signing-pin"] });
      }
      setDraft(null);
      toast.success(variables.input.id ? "Template saved." : "Template created.");
    },
    onError: async (error: unknown) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "signing-pin"] });
      toast.error(error instanceof Error ? error.message : "Could not save the template.");
    },
  });

  const activateM = useMutation({
    mutationFn: (template: ContractTemplate) =>
      platformApi.updateContractTemplate(template.id, { isActive: true }),
    onSuccess: async (_data, template) => {
      await invalidate();
      toast.success(`"${template.name}" is now the live contract.`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not activate that template."),
  });

  const deleteM = useMutation({
    mutationFn: (template: ContractTemplate) => platformApi.deleteContractTemplate(template.id),
    onSuccess: async () => {
      await invalidate();
      setConfirmDelete(null);
      toast.success("Template deleted.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not delete that template."),
  });

  return (
    <PageContainer className="px-0 py-0 lg:px-0">
      <PlatformPageHeader
        title="Contract Templates"
        description="The agreement customers read and sign after choosing a plan, before they are asked to pay."
        actions={
          <PrimaryAction icon={Plus} onClick={() => setDraft({ ...emptyDraft })}>
            New template
          </PrimaryAction>
        }
      />

      <StatGrid
        columns={4}
        items={[
          {
            label: "Templates",
            value: templates.length.toLocaleString(),
            icon: FileText,
            tone: "indigo",
            helper: "Drafts and live versions",
          },
          {
            label: "Live contract",
            value: live ? "Active" : "None",
            icon: FileSignature,
            tone: live ? "emerald" : "amber",
            helper: live ? `${live.name} · v${live.version}` : "Customers see nothing to sign",
          },
          {
            label: "Countersigned",
            value: live?.provider_signature_image ? "Yes" : "No",
            icon: PenTool,
            tone: live?.provider_signature_image ? "emerald" : "amber",
            helper: live?.provider_signature_image
              ? `Attached ${shortDate(live.signature_attached_at)}`
              : "Contracts go out signed by one party",
          },
          {
            label: "Provider details",
            value: live?.provider_legal_name ? "Complete" : "Missing",
            icon: Users,
            tone: live?.provider_legal_name ? "emerald" : "amber",
            helper: live?.provider_legal_name
              ? live.provider_legal_name
              : "ShopCore is named by brand only",
          },
        ]}
      />

      <SigningPinCard />

      <SectionCard
        icon={FileSignature}
        tone="indigo"
        title="Templates"
        description="One is live at a time. Activating a template stands the others down."
      >
        {templatesQ.isLoading ? (
          <EmptyNote icon={Loader2} text="Loading templates…" />
        ) : templates.length === 0 ? (
          <EmptyNote
            icon={FileText}
            text="No contract template yet. Create one and activate it, and customers will be asked to sign it before paying."
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {template.name}
                    </span>

                    {template.is_active ? (
                      <StatusPill tone="emerald" icon={CheckCircle2}>
                        Live
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Draft</StatusPill>
                    )}

                    <StatusPill tone="sky">v{template.version}</StatusPill>

                    {/*
                      Worth saying out loud: a template with no signature of ours
                      produces a contract signed by one party, and that is not
                      visible anywhere else until a customer downloads one.
                    */}
                    {template.provider_signature_image ? (
                      <StatusPill tone="violet" icon={PenTool}>
                        Countersigned
                      </StatusPill>
                    ) : (
                      <StatusPill tone="amber" icon={TriangleAlert}>
                        No ShopCore signature
                      </StatusPill>
                    )}

                    {/* One party named by its registered details and the other
                        by a brand is the half a dispute starts with. */}
                    {template.provider_legal_name ? null : (
                      <StatusPill tone="amber" icon={TriangleAlert}>
                        No provider details
                      </StatusPill>
                    )}

                    {/* A {{token}} nothing can fill would print literally on a
                        customer's contract, so it is said out loud here. */}
                    {template.unknown_placeholders.length > 0 ? (
                      <StatusPill tone="amber" icon={TriangleAlert}>
                        {template.unknown_placeholders.length} unknown placeholder
                        {template.unknown_placeholders.length === 1 ? "" : "s"}
                      </StatusPill>
                    ) : null}
                  </span>

                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {template.description ?? "No description"} · {template.placeholders_used.length}{" "}
                    field{template.placeholders_used.length === 1 ? "" : "s"} filled in · updated{" "}
                    {shortDate(template.updated_at)}
                  </span>
                </span>

                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {!template.is_active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={activateM.isPending}
                      onClick={() => activateM.mutate(template)}
                    >
                      Make live
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setDraft(toDraft(template))}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-destructive hover:text-destructive"
                    disabled={template.is_active}
                    title={
                      template.is_active
                        ? "The live contract cannot be deleted — make another one live first."
                        : undefined
                    }
                    onClick={() => setConfirmDelete(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ContractTemplateEditor
        draft={draft}
        placeholders={placeholders}
        providerDefaults={providerDefaults}
        pinConfigured={Boolean(pinQ.data?.configured)}
        saving={saveM.isPending}
        onClose={() => setDraft(null)}
        onSave={(next, pin) => saveM.mutate({ input: next, pin })}
      />

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              "{confirmDelete?.name}" will be removed. Contracts already signed against it keep
              their own copy of what was signed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteM.isPending}
              onClick={() => confirmDelete && deleteM.mutate(confirmDelete)}
            >
              {deleteM.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
