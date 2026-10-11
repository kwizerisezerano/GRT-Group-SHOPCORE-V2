import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSignature,
  Loader2,
  RotateCcw,
  Stamp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AuthHeading, AuthShell, type AuthAside } from "@/components/auth/AuthShell";
import { ContractPaper, type PaperSignature } from "@/components/contracts/ContractPaper";
import { SignaturePad } from "@/components/onboarding/SignaturePad";
import { StepDots } from "@/components/onboarding/StepDots";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { contractsApi } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  readOnboardingBusiness,
  readPlanChoice,
  readSignedContract,
  rememberSignedContract,
  type OnboardingContract,
} from "@/lib/onboardingDraft";

/**
 * Step four: reading and signing the agreement.
 *
 * ## Why this sits before payment
 *
 * The customer agrees to what they are buying, then pays for it. The other
 * order — take the money, produce the contract afterwards — leaves a charge on
 * somebody's phone against terms they had not seen, which is the one thing here
 * that cannot be put right after the fact.
 *
 * ## Why the whole document is on screen
 *
 * This page used to show the clause text and nothing else. Who the two parties
 * are, the amount set out as a commercial term, the execution sentence and the
 * two signature blocks all appeared for the first time in the PDF — after the
 * person had agreed. So the reader was accepting one thing and receiving
 * another, and had no way to see where their signature was going to land.
 *
 * Now the same document is rendered here as `ContractPaper` draws it and as the
 * PDF prints it, and the signature and stamp appear *on the document* as they
 * are made. The place to sign is visible before there is anything in it.
 *
 * ## What is actually stored
 *
 * The text is rendered by the server and shown as it came back. The signature
 * goes into the browser's draft and travels with the request that creates the
 * workspace, where the server renders the same contract again and stores its
 * own copy. So nothing about the agreement's wording depends on this page
 * having been honest.
 *
 * ## Coming back
 *
 * The draft is written the moment there is something worth keeping, keyed to
 * the account that made it, and read back on arrival. Refreshing, closing the
 * tab, or returning the next morning finds the signature already there and
 * offers to carry on — being asked to sign a second time is indistinguishable
 * from the first attempt having failed.
 */

const CONTRACT_ASIDE: AuthAside = {
  icon: FileSignature,
  eyebrow: "Almost there",
  title: "Read it before you pay",
  description:
    "This is the agreement between your business and ShopCore, filled in with the details you gave us and the plan you picked.",
  points: [
    "Nothing is charged until you have signed",
    "Your signature is kept if you come back later",
    "You can download the signed copy any time",
  ],
};

/** Two megabytes — a photographed stamp, not a scanned document. */
const MAX_STAMP_BYTES = 2 * 1024 * 1024;

const longDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The same reference the PDF prints, so the two documents match on sight. */
const referenceFor = (date: Date) =>
  `SC-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export default function Contract() {
  const { user, loading, tenantId } = useAuth();
  const navigate = useNavigate();
  const stampInput = useRef<HTMLInputElement | null>(null);
  /** The blob URL already saved, so a re-render does not save it twice. */
  const savedRef = useRef<string | null>(null);
  const agreementRef = useRef<HTMLDivElement | null>(null);

  const choice = readPlanChoice();
  const business = readOnboardingBusiness();

  /**
   * The draft this account left behind — read once we know whose account it is.
   *
   * Deliberately *not* read during the first render. `user` is null while the
   * session is still being restored, and a read with no account id skips the
   * ownership check — which on a shared shop laptop would hand the previous
   * signer's mark to whoever is signing up now, already ticked and ready to
   * submit under their name. So it waits for auth to settle.
   */
  const [restored, setRestored] = useState<OnboardingContract | null>(null);

  const [agreed, setAgreed] = useState(false);
  /** Whether the reader has reached the foot of the agreement. */
  const [readToEnd, setReadToEnd] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  /** Dismissed once they choose to sign again, so the notice stops nagging. */
  const [showRestored, setShowRestored] = useState(false);

  /** Restoring happens once. "Sign again" must not be undone by a re-render. */
  const restoredOnce = useRef(false);

  useEffect(() => {
    if (loading || !user || restoredOnce.current) return;

    restoredOnce.current = true;

    const draft = readSignedContract(user.id);
    if (!draft) return;

    setRestored(draft);
    setSignature(draft.signatureImage);
    setStamp(draft.stampImage);
    setAgreed(true);
    setShowRestored(true);
  }, [loading, user]);

  /** The generated document: a blob URL once the server has drawn it. */
  const [generated, setGenerated] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const contractQ = useQuery({
    queryKey: ["onboarding", "contract", choice?.planCode, choice?.billingCycle],
    enabled: Boolean(choice && business),
    queryFn: () =>
      contractsApi.preview({
        planCode: choice!.planCode,
        billingCycle: choice!.billingCycle,
        businessName: business?.businessName ?? "My business",
        tinNumber: business?.tinNumber || null,
        businessPhone: business?.businessPhone || null,
        businessAddress: business?.businessLocation || null,
      }),
  });

  const contractData = contractQ.data;

  /*
   * Reaching the bottom is noted, not enforced.
   *
   * Blocking the checkbox until somebody scrolls is a dark pattern in reverse:
   * it does not make anyone read, it just makes them drag a scrollbar. What it
   * is good for is answering "is there more?" — so the fade lifts and the
   * header says so, and the decision stays theirs.
   *
   * A short slack of 24px, because fractional device pixels mean the arithmetic
   * rarely lands exactly on zero.
   */
  const onAgreementScroll = () => {
    const box = agreementRef.current;
    if (!box || readToEnd) return;

    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 24) setReadToEnd(true);
  };

  /*
   * A short agreement never scrolls, so the cue would sit there unanswerable.
   * Measured after paint, and again whenever the body changes.
   */
  useEffect(() => {
    const box = agreementRef.current;
    if (!box) return;

    if (box.scrollHeight <= box.clientHeight + 24) setReadToEnd(true);
  }, [contractData?.body]);

  /*
   * The signature is written down as soon as it exists, not when "Continue" is
   * pressed.
   *
   * Between signing and pressing that button a person can refresh, lose the
   * tab, or have their phone die, and every one of those used to cost them the
   * signature. Saving at the moment of the mark means the worst case is
   * returning to a page that already knows what they did.
   */
  useEffect(() => {
    if (!agreed || !signature || !contractData) return;

    rememberSignedContract({
      templateId: contractData.template.id,
      signatureImage: signature,
      stampImage: stamp,
      signerName: contractData.signer_name || business?.businessName || "",
      agreedAt: restored?.agreedAt ?? new Date().toISOString(),
      accountId: user?.id ?? null,
    });
    // business, restored and user are read-only inputs to the draft; re-running
    // on their identity would rewrite `agreedAt` for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreed, signature, stamp, contractData?.template.id, contractData?.signer_name]);

  /*
   * The document is drawn the moment there is something to draw.
   *
   * Not behind a button: a person who has read the terms, ticked the box and
   * signed has done everything that was asked of them, and making them press
   * "generate" before they may press "pay" is a step that exists only because
   * it was easier to build. The effect re-runs when the signature or the stamp
   * changes, so a re-drawn signature replaces the document rather than leaving
   * a stale one attached to a new mark.
   */
  useEffect(() => {
    if (!choice || !agreed || !signature || !contractData) {
      setGenerated((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    setGenerating(true);
    setGenerateError(null);

    contractsApi
      .generate({
        planCode: choice.planCode,
        billingCycle: choice.billingCycle,
        businessName: business?.businessName ?? "My business",
        tinNumber: business?.tinNumber || null,
        businessPhone: business?.businessPhone || null,
        businessAddress: business?.businessLocation || null,
        signatureImage: signature,
        stampImage: stamp,
        signerName: contractData.signer_name || business?.businessName || "Owner",
      })
      .then((blob) => {
        if (cancelled) return;

        created = URL.createObjectURL(blob);
        setGenerated((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return created;
        });

        /*
         * Saved to their device the moment it exists, without being asked for.
         *
         * The customer is one click from a payment screen and then from a
         * sign-in page; the copy of what they signed should already be theirs
         * by then rather than depending on them noticing a link on a screen
         * they are leaving. It is still reachable afterwards — "View contract"
         * here, and the workspace's billing page keeps it permanently — so the
         * automatic save is a convenience, not the only chance to get it.
         *
         * Done once per generated document: re-drawing the signature produces
         * a new one and saves that, which is right, but a re-render of this
         * component must not save the same file again.
         */
        if (savedRef.current !== created) {
          savedRef.current = created;

          const link = document.createElement("a");
          link.href = created;
          link.download = "shopcore-service-agreement.pdf";
          document.body.appendChild(link);
          link.click();

          // Torn down on a timer: doing it in this tick cancels the download
          // before it starts, silently. See downloadContractPdf in apiClient.
          setTimeout(() => link.remove(), 60_000);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGenerateError(error instanceof Error ? error.message : "The contract could not be generated.");
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
      // Only the URL this run made; the one on screen belongs to whichever run
      // last won, and revoking that here would blank a working preview.
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreed, signature, stamp, contractData?.template.id]);

  /**
   * The two signature blocks, as the document shows them.
   *
   * ShopCore's side comes from the live template — the customer sees who is
   * countersigning before they commit, not after. Their own side updates as
   * they sign, so the mark lands on the document in front of them.
   */
  const signatures = useMemo<[PaperSignature, PaperSignature] | null>(() => {
    if (!contractData) return null;

    return [
      {
        caption: "For the Provider",
        signature: contractData.template.provider_signature_image,
        stamp: contractData.template.provider_stamp_image,
        name: contractData.template.provider_signer_name || contractData.provider.legal_name || "ShopCore",
        subtitle: contractData.template.provider_signer_title || "Authorised signatory",
        date: longDate(new Date()),
        emptyHint: "Countersigned by ShopCore on issue",
      },
      {
        caption: "For the Customer",
        signature,
        stamp,
        name: contractData.signer_name || business?.businessName || "You",
        subtitle: business?.businessName ? `for ${business.businessName}` : "Authorised signatory",
        date: signature ? longDate(new Date()) : null,
        emptyHint: "Your signature goes here — draw or upload it below",
        awaiting: true,
      },
    ];
  }, [contractData, signature, stamp, business?.businessName]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && tenantId) return <Navigate to="/billing" replace />;
  if (!choice) return <Navigate to="/onboarding/plan" replace />;

  const contract = contractData;
  /* Payment is unlocked by a document that exists, not merely by a signature. */
  const ready = agreed && Boolean(signature) && Boolean(contract) && Boolean(generated);

  const pickStamp = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_STAMP_BYTES) {
      toast.error("That image is too large", {
        description: "Please use a photo under 2 MB.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setStamp(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error("That image could not be read.");
    reader.readAsDataURL(file);
  };

  /**
   * Starts over: the notice goes, and so does everything it was about.
   *
   * `restored` is cleared too, not just hidden. It carries the date of the
   * earlier signing, and a fresh signature must be dated today rather than
   * inheriting the day somebody first opened this page.
   */
  const signAgain = () => {
    setShowRestored(false);
    setRestored(null);
    setSignature(null);
    setStamp(null);
    setAgreed(false);
  };

  const submit = () => {
    if (!ready || !contract || !signature) return;

    rememberSignedContract({
      templateId: contract.template.id,
      signatureImage: signature,
      stampImage: stamp,
      signerName: contract.signer_name || business?.businessName || "",
      agreedAt: restored?.agreedAt ?? new Date().toISOString(),
      accountId: user?.id ?? null,
    });

    navigate("/onboarding/checkout");
  };

  return (
    <AuthShell aside={CONTRACT_ASIDE} width="wide">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <StepDots current={4} total={5} />

          <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding/plan")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Change plan
          </Button>
        </div>

        <AuthHeading
          title="Your service agreement"
          description="Read it through, sign at the bottom, and then choose how you would like to pay."
        />

        {/*
          The returning signer, greeted with what they already did.

          Shown above the document rather than beside the pad, because the
          question it answers — "do I have to do this again?" — is the first one
          somebody has on opening the page.
        */}
        {showRestored && restored ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">You already signed this</p>
              <p className="text-xs text-muted-foreground">
                Signed on {longDate(restored.agreedAt)}. Your signature has been put back on the
                document below — carry on to payment, or sign again if you would rather.
              </p>
            </div>

            <Button variant="outline" size="sm" className="rounded-xl" onClick={signAgain}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Sign again
            </Button>
          </div>
        ) : null}

        {contractQ.isLoading ? (
          <FormSkeleton />
        ) : contractQ.isError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                The agreement could not be loaded
              </p>
              <p className="text-sm text-muted-foreground">
                {contractQ.error instanceof Error
                  ? contractQ.error.message
                  : "Please try again in a moment."}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => contractQ.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : contract && signatures ? (
          <>
            {/*
              The agreement itself, whole and scrollable rather than truncated —
              a contract behind a "read more" is a contract nobody read.

              The card carries a header and a fade at the foot because the
              scroll box previously clipped a clause mid-sentence with nothing
              to say there was more: it read as a rendering fault rather than as
              a document that continues. The fade lifts once the reader reaches
              the end, which doubles as a quiet acknowledgement that they did.
            */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  The agreement
                </span>

                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  {readToEnd ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Read to the end
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Scroll to read it all
                    </>
                  )}
                </span>
              </div>

              <div className="relative">
                <div
                  ref={agreementRef}
                  onScroll={onAgreementScroll}
                  className="max-h-[520px] overflow-y-auto px-6 py-5"
                >
                  <ContractPaper
                    reference={referenceFor(new Date())}
                    templateName={contract.template.name}
                    templateVersion={contract.template.version}
                    provider={{
                      caption: "Between",
                      name: contract.provider.legal_name || "ShopCore",
                      details: identityLines(contract.provider),
                      role: "the Provider",
                    }}
                    customer={{
                      caption: "And",
                      name: contract.customer.legal_name || business?.businessName || "Your business",
                      details: identityLines(contract.customer),
                      role: "the Customer",
                    }}
                    terms={[
                      ["Plan", contract.plan.name],
                      ["Billing", cycleLabel(choice.billingCycle)],
                      [
                        "Amount",
                        `${contract.currency} ${Math.round(contract.amount).toLocaleString()}`,
                      ],
                      [
                        "Term",
                        `${longDate(contract.period_start)} — ${longDate(contract.period_end)}`,
                      ],
                    ].map(([label, value]) => ({ label: label as string, value: value as string }))}
                    amountInWords={`${contract.amount_in_words} ${contract.currency}`}
                    body={contract.body}
                    execution={`IN WITNESS WHEREOF the parties have executed this agreement on ${longDate(
                      new Date(),
                    )}${
                      contract.provider.governing_law
                        ? `, and agree that it is governed by the laws of ${contract.provider.governing_law}.`
                        : "."
                    }`}
                    signatures={signatures}
                  />
                </div>

                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent transition-opacity duration-300",
                    readToEnd ? "opacity-0" : "opacity-100",
                  )}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-accent/40">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span className="text-sm text-foreground">
                I have read the agreement above and I accept it on behalf of{" "}
                <strong>{business?.businessName ?? "my business"}</strong>.
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <SignaturePad value={signature} onChange={setSignature} label="Sign here" />

              <div className="space-y-2">
                {/*
                  A header row the same height as the signature column's, so the
                  two boxes below line up. They were 40px out of step, which read
                  as a mistake rather than as a pair.
                */}
                <div className="flex h-7 items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    Company stamp{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>

                  {stamp ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setStamp(null)}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                {/* Not `bg-white` — see SignaturePad: dark mode overrides it. */}
                {stamp ? (
                  <div className="h-40 rounded-2xl border border-border bg-[#ffffff] p-2">
                    <img
                      src={stamp}
                      alt="Your company stamp"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => stampInput.current?.click()}
                    className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Stamp className="h-5 w-5" />
                    <span className="text-sm font-medium text-foreground">Add your stamp</span>
                    <span className="text-xs">PNG or JPG, under 2 MB</span>
                  </button>
                )}

                <input
                  ref={stampInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) => pickStamp(event.target.files?.[0])}
                />

                <p className="text-xs text-muted-foreground">
                  {stamp
                    ? "Your stamp appears beside your signature on the document above."
                    : "Many small businesses do not have one — this is optional."}
                </p>
              </div>
            </div>

            {/*
              What the signature produced. Shown before payment rather than
              promised after it, so nobody is asked to pay for an agreement
              they have not been handed.
            */}
            {generating ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  Generating your signed contract…
                </p>
              </div>
            ) : generateError ? (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    The contract could not be generated
                  </p>
                  <p className="text-sm text-muted-foreground">{generateError}</p>
                </div>
              </div>
            ) : generated ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Your contract is ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed{stamp ? " and stamped" : ""} by{" "}
                    {contract.signer_name || business?.businessName}. A copy has been downloaded to
                    your device, and one is kept in your workspace.
                  </p>
                </div>

                {/*
                  Opened in a tab rather than downloaded: at this point they are
                  mid-signup, and a file landing in Downloads is easier to lose
                  than a tab is to close.
                */}
                <Button variant="outline" size="sm" className="rounded-xl" asChild>
                  <a href={generated} target="_blank" rel="noreferrer">
                    <Download className="mr-1.5 h-4 w-4" />
                    View contract
                  </a>
                </Button>
              </div>
            ) : null}

            <Button className="h-12 w-full rounded-xl text-base" disabled={!ready} onClick={submit}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="mr-2 h-4 w-4" />
              )}
              Continue to payment
              {ready ? <ArrowRight className="ml-1.5 h-4 w-4" /> : null}
            </Button>

            {!ready ? (
              <p className="text-center text-xs text-muted-foreground">
                {!agreed
                  ? "Tick the box above to accept the agreement."
                  : !signature
                    ? "Draw or upload your signature to continue."
                    : generating
                      ? "One moment — your contract is being generated."
                      : "Your contract could not be generated yet."}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}

const cycleLabel = (cycle: string) =>
  ({ monthly: "Monthly", six_months: "Every 6 months", annual: "Annual" })[cycle] ?? cycle;

/**
 * A party's identifying lines, with the unknown ones left out.
 *
 * Printing "TIN: —" would put a fact-shaped blank on a contract. A detail
 * nobody supplied is better absent from the party block than present and empty;
 * the clause text still carries an underscored blank where the agreement itself
 * refers to it, which is where an incomplete field actually matters.
 */
function identityLines(party: {
  tin: string | null;
  registration_no?: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}): string[] {
  return [
    party.tin ? `TIN: ${party.tin}` : null,
    party.registration_no ? `Reg. No: ${party.registration_no}` : null,
    party.address,
    party.email ? `Email: ${party.email}` : null,
    party.phone ? `Tel: ${party.phone}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
}
