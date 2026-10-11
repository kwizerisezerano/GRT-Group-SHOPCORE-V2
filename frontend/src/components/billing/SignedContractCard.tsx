import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ContractPaper } from "@/components/contracts/ContractPaper";
import { SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { contractsApi, downloadContractPdf, type ContractPartyIdentity } from "@/lib/apiClient";

/**
 * The agreement this workspace signed, and a way to keep a copy.
 *
 * A contract you cannot re-read is not much of a contract. It is shown in full
 * rather than as a line saying one exists, because the question a customer
 * opens this to answer is "what did I actually agree to", and a download-only
 * link answers that with a file dialog.
 *
 * Rendered by the same component as the signing screen and laid out like the
 * PDF, so the copy on this page, the copy they read before paying and the copy
 * in their downloads folder are recognisably one document rather than three
 * presentations of the same text.
 *
 * Renders nothing at all when there is no contract — workspaces created before
 * this step existed, and those a platform admin set up by hand, legitimately
 * have none, and an empty "no contract found" panel on every one of their
 * billing pages would be noise rather than information.
 */

const longDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

export function SignedContractCard() {
  const [downloading, setDownloading] = useState(false);

  const contractQ = useQuery({
    queryKey: ["billing", "contract"],
    queryFn: () => contractsApi.mine(),
    // A workspace either has one or does not; a 404 is an answer, not a fault.
    retry: false,
  });

  const contract = contractQ.data;
  if (contractQ.isLoading || !contract) return null;

  const download = async () => {
    setDownloading(true);

    try {
      await downloadContractPdf();
    } catch (error) {
      toast.error("The contract could not be downloaded", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  };

  const signedOn = longDate(contract.signed_at);

  return (
    <SectionCard
      icon={FileSignature}
      tone="indigo"
      title="Your service agreement"
      description={`Signed by ${contract.signer_name} on ${signedOn}.`}
      actions={
        <Button variant="outline" className="rounded-2xl" disabled={downloading} onClick={download}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
      }
    >
      <div className="max-h-[560px] overflow-y-auto rounded-2xl border border-border bg-muted/30 p-6">
        <ContractPaper
          reference={`SC-${contract.id.slice(0, 8).toUpperCase()}`}
          templateName={contract.template_name}
          templateVersion={contract.template_version}
          provider={{
            caption: "Between",
            name: contract.provider?.legal_name || "ShopCore",
            details: identityLines(contract.provider),
            role: "the Provider",
          }}
          customer={{
            caption: "And",
            name: contract.customer?.legal_name || contract.signer_name,
            details: identityLines(contract.customer),
            role: "the Customer",
          }}
          terms={[
            { label: "Plan", value: contract.plan_name },
            {
              label: "Billing",
              value: CYCLE_LABEL[contract.billing_cycle] ?? contract.billing_cycle,
            },
            {
              label: "Amount",
              value: `${contract.currency} ${Math.round(Number(contract.amount)).toLocaleString()}`,
            },
            { label: "Signed", value: signedOn },
          ]}
          body={contract.body}
          execution={
            contract.provider?.governing_law
              ? `IN WITNESS WHEREOF the parties executed this agreement on ${signedOn}, and agree that it is governed by the laws of ${contract.provider.governing_law}.`
              : `IN WITNESS WHEREOF the parties executed this agreement on ${signedOn}.`
          }
          signatures={[
            {
              caption: "For the Provider",
              signature: contract.provider_signature_image,
              stamp: contract.provider_stamp_image,
              name: contract.provider_signer_name ?? "ShopCore",
              subtitle: contract.provider_signer_title ?? "Authorised signatory",
              date: signedOn,
            },
            {
              caption: "For the Customer",
              signature: contract.signature_image,
              stamp: contract.stamp_image,
              name: contract.signer_name,
              subtitle: contract.customer?.legal_name
                ? `for ${contract.customer.legal_name}`
                : "Authorised signatory",
              date: signedOn,
            },
          ]}
        />
      </div>
    </SectionCard>
  );
}

/** A party's identifying lines, with the unknown ones left out. */
function identityLines(party: ContractPartyIdentity | undefined): string[] {
  if (!party) return [];

  return [
    party.tin ? `TIN: ${party.tin}` : null,
    party.registration_no ? `Reg. No: ${party.registration_no}` : null,
    party.address,
    party.email ? `Email: ${party.email}` : null,
    party.phone ? `Tel: ${party.phone}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
}
