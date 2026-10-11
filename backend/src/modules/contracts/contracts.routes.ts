import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { amountInWords } from "../../lib/amountWords";
import { decryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { renderActiveContract } from "./contracts.render";
import { renderContractPdf } from "./contracts.pdf";
import { assertImage } from "./contracts.service";

/**
 * The customer's side of the contract.
 *
 * Two things happen here. Before paying, a customer previews the agreement
 * filled in with their own details — that is `POST /contracts/preview`, and it
 * runs before any workspace exists, which is why the business details come in
 * the request rather than being read from a tenant row.
 *
 * The signature itself is not taken here. It travels with `POST
 * /workspace/pending`, in the same request that creates the workspace and puts
 * the charge on the wire, so a workspace cannot come into existence with no
 * contract behind it. That ordering is the whole point: sign, then pay.
 *
 * Afterwards the tenant can read it back and download it as a PDF.
 */

export const contractsRouter = Router();

contractsRouter.use(requireAuth);

const previewSchema = z.object({
  planCode: z.string().trim().min(1).max(32),
  billingCycle: z.enum(["monthly", "six_months", "annual"]),
  businessName: z.string().trim().min(1).max(191),
  tinNumber: z.string().trim().max(32).optional().nullable(),
  businessPhone: z.string().trim().max(32).optional().nullable(),
  businessAddress: z.string().trim().max(191).optional().nullable(),
});

contractsRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = previewSchema.parse({
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
      businessName: body.businessName ?? body.business_name,
      tinNumber: body.tinNumber ?? body.tin_number,
      businessPhone: body.businessPhone ?? body.business_phone,
      businessAddress: body.businessAddress ?? body.business_address,
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailEncrypted: true, displayNameEncrypted: true },
    });

    const rendered = await renderActiveContract({
      companyName: input.businessName,
      tinNumber: input.tinNumber ?? null,
      ownerName: decryptNullable(user?.displayNameEncrypted ?? null) ?? input.businessName,
      ownerEmail: decryptNullable(user?.emailEncrypted ?? null) ?? "",
      businessPhone: input.businessPhone ?? null,
      businessAddress: input.businessAddress ?? null,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
    });

    sendSuccess(res, {
      messageKey: "contracts.previewed",
      data: {
        /*
         * Named, not spread — but the provider's signature and stamp are named
         * in.
         *
         * They were left out to save bandwidth while the screen showed only
         * the body text. The screen now shows the whole document, and a
         * contract displayed with the customer's signature block empty beside
         * a provider block that is simply absent reads as though ShopCore has
         * not agreed to anything. Two small marks are a fair price for the
         * customer seeing, before they pay, the same document the PDF will
         * hand them.
         */
        template: {
          id: rendered.template.id,
          name: rendered.template.name,
          version: rendered.template.version,
          provider_signature_image: rendered.template.providerSignatureImage,
          provider_stamp_image: rendered.template.providerStampImage,
          provider_signer_name: rendered.template.providerSignerName,
          provider_signer_title: rendered.template.providerSignerTitle,
        },
        provider: {
          legal_name: rendered.provider.legalName,
          tin: rendered.provider.tin,
          registration_no: rendered.provider.registrationNo,
          address: rendered.provider.address,
          email: rendered.provider.email,
          phone: rendered.provider.phone,
          governing_law: rendered.provider.governingLaw,
        },
        customer: {
          legal_name: input.businessName,
          tin: input.tinNumber ?? null,
          address: input.businessAddress ?? null,
          phone: input.businessPhone ?? null,
          email: decryptNullable(user?.emailEncrypted ?? null) ?? null,
        },
        body: rendered.body,
        plan: rendered.plan,
        amount: rendered.amount,
        amount_in_words: amountInWords(rendered.amount),
        currency: rendered.currency,
        term_months: rendered.termMonths,
        period_start: rendered.periodStart,
        period_end: rendered.periodEnd,
        signer_name: decryptNullable(user?.displayNameEncrypted ?? null) ?? "",
        signer_email: decryptNullable(user?.emailEncrypted ?? null) ?? "",
      },
    });
  }),
);

const generateSchema = previewSchema.extend({
  signatureImage: z.string().min(1),
  stampImage: z.string().min(1).optional().nullable(),
  signerName: z.string().trim().min(1).max(191),
});

/**
 * The signed contract as a PDF, before the workspace exists.
 *
 * The moment somebody signs, this produces the finished document with their
 * signature and stamp on it, so they can read and keep the thing they just
 * agreed to rather than being told they will receive it after paying. Nothing
 * is stored here — the workspace it would belong to has not been created yet —
 * and it is rendered again, identically, when the signature is filed at
 * checkout. It costs one render and removes the entire class of "I paid and
 * never got a copy".
 */
contractsRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = generateSchema.parse({
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
      businessName: body.businessName ?? body.business_name,
      tinNumber: body.tinNumber ?? body.tin_number,
      businessPhone: body.businessPhone ?? body.business_phone,
      businessAddress: body.businessAddress ?? body.business_address,
      signatureImage: body.signatureImage ?? body.signature_image,
      stampImage: body.stampImage ?? body.stamp_image,
      signerName: body.signerName ?? body.signer_name,
    });

    assertImage(input.signatureImage, "signatureImage");
    if (input.stampImage) assertImage(input.stampImage, "stampImage");

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailEncrypted: true, displayNameEncrypted: true },
    });

    const rendered = await renderActiveContract({
      companyName: input.businessName,
      tinNumber: input.tinNumber ?? null,
      ownerName: decryptNullable(user?.displayNameEncrypted ?? null) ?? input.businessName,
      ownerEmail: decryptNullable(user?.emailEncrypted ?? null) ?? "",
      businessPhone: input.businessPhone ?? null,
      businessAddress: input.businessAddress ?? null,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
    });

    const pdf = await renderContractPdf({
      templateName: rendered.template.name,
      templateVersion: rendered.template.version,
      body: rendered.body,
      signerName: input.signerName,
      signatureImage: input.signatureImage,
      stampImage: input.stampImage ?? null,
      providerSignatureImage: rendered.template.providerSignatureImage,
      providerStampImage: rendered.template.providerStampImage,
      providerSignerName: rendered.template.providerSignerName,
      providerSignerTitle: rendered.template.providerSignerTitle,
      providerLegalName: rendered.provider.legalName,
      providerTin: rendered.provider.tin,
      providerRegistrationNo: rendered.provider.registrationNo,
      providerAddress: rendered.provider.address,
      providerEmail: rendered.provider.email,
      providerPhone: rendered.provider.phone,
      governingLaw: rendered.provider.governingLaw,
      customerLegalName: input.businessName,
      customerTin: input.tinNumber ?? null,
      customerAddress: input.businessAddress ?? null,
      customerPhone: input.businessPhone ?? null,
      customerEmail: decryptNullable(user?.emailEncrypted ?? null),
      planName: rendered.plan.name,
      billingCycle: input.billingCycle,
      amount: rendered.amount,
      currency: rendered.currency,
      signedAt: new Date(),
      companyName: input.businessName,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="shopcore-service-agreement.pdf"');
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  }),
);

/** The contract this workspace signed. */
contractsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const contract = await findOwnContract(req.user!.tenantId);

    sendSuccess(res, {
      messageKey: "contracts.loaded",
      data: {
        id: contract.id,
        template_name: contract.templateName,
        template_version: contract.templateVersion,
        body: contract.body,
        signer_name: contract.signerName,
        signature_image: contract.signatureImage,
        stamp_image: contract.stampImage,
        provider_signature_image: contract.providerSignatureImage,
        provider_stamp_image: contract.providerStampImage,
        provider_signer_name: contract.providerSignerName,
        provider_signer_title: contract.providerSignerTitle,
        provider: {
          legal_name: contract.providerLegalName,
          tin: contract.providerTin,
          registration_no: contract.providerRegistrationNo,
          address: contract.providerAddress,
          email: contract.providerEmail,
          phone: contract.providerPhone,
          governing_law: contract.governingLaw,
        },
        customer: {
          legal_name: contract.customerLegalName,
          tin: contract.customerTin,
          address: contract.customerAddress,
          phone: decryptNullable(contract.customerPhoneEncrypted),
          email: decryptNullable(contract.signerEmailEncrypted),
        },
        plan_code: contract.planCode,
        plan_name: contract.planName,
        billing_cycle: contract.billingCycle,
        amount: contract.amount,
        currency: contract.currency,
        signed_at: contract.signedAt,
      },
    });
  }),
);

/** The same contract as a PDF, signature and stamp drawn in. */
contractsRouter.get(
  "/mine/pdf",
  asyncHandler(async (req, res) => {
    const contract = await findOwnContract(req.user!.tenantId);

    /*
     * The workspace's own name on the document, rather than the signer's, so a
     * filed contract reads as being with the business it binds.
     */
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId! },
      select: { name: true },
    });

    const pdf = await renderContractPdf({
      ...contract,
      /*
       * Spread carries the snapshotted identities straight through, except the
       * two columns that are stored encrypted — those are named explicitly, so
       * the document prints a phone number rather than a ciphertext envelope.
       */
      customerPhone: decryptNullable(contract.customerPhoneEncrypted),
      customerEmail: decryptNullable(contract.signerEmailEncrypted),
      companyName: contract.customerLegalName ?? tenant?.name ?? null,
      reference: `SC-${contract.id.slice(0, 8).toUpperCase()}`,
    });

    const filename = `shopcore-contract-${contract.signedAt.toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  }),
);

/**
 * The caller's own contract, or a 404.
 *
 * Scoped to the tenant on the token rather than an id in the URL, so there is
 * no id to tamper with — one workspace cannot ask for another's agreement.
 */
async function findOwnContract(tenantId: string | null) {
  if (!tenantId) {
    throw HttpError.badRequest("workspace.requiresTenant", { code: "requires_tenant" });
  }

  const contract = await prisma.signedContract.findFirst({
    where: { tenantId },
    orderBy: { signedAt: "desc" },
  });

  if (!contract) {
    throw HttpError.notFound("contracts.notFound", { code: "contract_not_found" });
  }

  return contract;
}
