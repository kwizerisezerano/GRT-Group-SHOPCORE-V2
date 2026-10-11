import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { CONTRACT_PLACEHOLDERS, PROVIDER_DEFAULTS } from "../contracts/contracts.render";
import { assertImage } from "../contracts/contracts.service";
import { assertSigningPin } from "./platform.signingPin.routes";

/**
 * Contract templates — the agreement customers sign before they pay.
 *
 * Platform-admin only, and mounted under the platform router which already
 * enforces that. This is ShopCore's contract with its customers, so no tenant
 * can see or edit one.
 *
 * ## Placeholders
 *
 * A template is stored once with `{{placeholders}}` and filled per customer at
 * the moment it is shown. The alternative — rendering a copy per signup — means
 * a wording correction never reaches anyone who signed earlier, and there is no
 * single answer to "what does our contract currently say".
 *
 * The catalogue of fillable tokens is imported from `contracts.render`, which
 * is the code that actually supplies the values. Two hand-maintained lists
 * would drift, and drift here means a customer reading `{{amout}}` on a signed
 * agreement.
 *
 * ## Why attaching a signature costs a PIN
 *
 * Everything else on a template is words, and words can be corrected. The
 * signature and stamp are the marks that bind ShopCore to every contract this
 * template will ever issue, so applying them asks for a second confirmation
 * from the person at the keyboard — see `platform.signingPin.routes`. The
 * provider's *name and title* are gated with them, because a signature image
 * under somebody else's name is the same forgery by another route.
 */

export { CONTRACT_PLACEHOLDERS };

export const platformContractsRouter = Router();

const templateSchema = z.object({
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().min(1),
  isActive: z.boolean().optional(),

  /*
   * ShopCore's own signature and stamp, applied to every contract issued from
   * this template. They live here rather than being asked for per customer
   * because they are the same every time — uploading them once is both less
   * work and one fewer chance to attach the wrong one.
   *
   * An explicit null clears; omitting the field leaves what is stored alone.
   */
  providerSignatureImage: z.string().min(1).optional().nullable(),
  providerStampImage: z.string().min(1).optional().nullable(),
  providerSignerName: z.string().trim().max(191).optional().nullable(),
  providerSignerTitle: z.string().trim().max(191).optional().nullable(),

  /*
   * Who ShopCore is, in the legal sense. Without these the customer's side of
   * the agreement is fully identified and the provider's side reads as a brand
   * name, which is the half a dispute would start with.
   */
  providerLegalName: z.string().trim().max(191).optional().nullable(),
  providerTin: z.string().trim().max(32).optional().nullable(),
  providerRegistrationNo: z.string().trim().max(64).optional().nullable(),
  providerAddress: z.string().trim().max(255).optional().nullable(),
  providerEmail: z.string().trim().max(191).optional().nullable(),
  providerPhone: z.string().trim().max(32).optional().nullable(),
  governingLaw: z.string().trim().max(191).optional().nullable(),

  /** Re-typed by the admin whenever the signature, stamp or signer changes. */
  pin: z.string().trim().max(16).optional(),
});

type TemplateInput = z.infer<typeof templateSchema>;

/** The fields whose change requires the PIN. */
const SIGNING_FIELDS = [
  "providerSignatureImage",
  "providerStampImage",
  "providerSignerName",
  "providerSignerTitle",
] as const;

/**
 * Did this request try to change the mark that binds ShopCore?
 *
 * Compared against what is stored rather than merely "was the field present":
 * the console sends the whole draft back on every save, so a name-only edit
 * carries the existing signature with it, and treating that as an attach would
 * ask for a PIN on every keystroke-level correction — which teaches people to
 * type the PIN without reading why.
 */
function touchesSignature(
  input: Partial<TemplateInput>,
  existing: Record<(typeof SIGNING_FIELDS)[number], string | null> | null,
): boolean {
  return SIGNING_FIELDS.some((field) => {
    const next = input[field];
    if (next === undefined) return false;

    const current = existing?.[field] ?? null;
    return (next ?? null) !== current;
  });
}

/** Validates the two images the same way a customer's signature is validated. */
function assertProviderImages(input: {
  providerSignatureImage?: string | null;
  providerStampImage?: string | null;
}) {
  if (input.providerSignatureImage) {
    assertImage(input.providerSignatureImage, "providerSignatureImage");
  }
  if (input.providerStampImage) {
    assertImage(input.providerStampImage, "providerStampImage");
  }
}

/** Serialises a template, and reports which placeholders it actually uses. */
function serialize(template: {
  id: string;
  name: string;
  description: string | null;
  body: string;
  isActive: boolean;
  version: number;
  providerSignatureImage: string | null;
  providerStampImage: string | null;
  providerSignerName: string | null;
  providerSignerTitle: string | null;
  providerLegalName: string | null;
  providerTin: string | null;
  providerRegistrationNo: string | null;
  providerAddress: string | null;
  providerEmail: string | null;
  providerPhone: string | null;
  governingLaw: string | null;
  signatureAttachedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const used = CONTRACT_PLACEHOLDERS.filter((p) => template.body.includes(p.token)).map(
    (p) => p.token,
  );

  /*
   * Anything in {{…}} that is not a placeholder we can fill. Surfacing it is
   * the difference between an author noticing a typo now and a customer
   * reading "{{compnay_name}}" on their contract.
   */
  const unknown = [...new Set(template.body.match(/\{\{[^}]+\}\}/g) ?? [])].filter(
    (token) => !CONTRACT_PLACEHOLDERS.some((p) => p.token === token),
  );

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    body: template.body,
    is_active: template.isActive,
    version: template.version,
    provider_signature_image: template.providerSignatureImage,
    provider_stamp_image: template.providerStampImage,
    provider_signer_name: template.providerSignerName,
    provider_signer_title: template.providerSignerTitle,
    provider_legal_name: template.providerLegalName,
    provider_tin: template.providerTin,
    provider_registration_no: template.providerRegistrationNo,
    provider_address: template.providerAddress,
    provider_email: template.providerEmail,
    provider_phone: template.providerPhone,
    governing_law: template.governingLaw,
    signature_attached_at: template.signatureAttachedAt,
    placeholders_used: used,
    unknown_placeholders: unknown,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

platformContractsRouter.get(
  "/contract-templates",
  asyncHandler(async (_req, res) => {
    const templates = await prisma.contractTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    sendSuccess(res, {
      messageKey: "platform.contractTemplatesListed",
      data: {
        templates: templates.map(serialize),
        placeholders: CONTRACT_PLACEHOLDERS,
        /*
         * What the renderer falls back to when the provider block is blank, so
         * the editor can show the same words in its preview rather than an
         * empty line the author cannot account for.
         */
        provider_defaults: {
          legal_name: PROVIDER_DEFAULTS.legalName,
          address: PROVIDER_DEFAULTS.address,
          governing_law: PROVIDER_DEFAULTS.governingLaw,
        },
      },
    });
  }),
);

platformContractsRouter.post(
  "/contract-templates",
  asyncHandler(async (req, res) => {
    const input = templateSchema.parse(req.body ?? {});
    assertProviderImages(input);

    const signing = touchesSignature(input, null);
    if (signing) await assertSigningPin(req.user!.id, input.pin);

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.contractTemplate.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          body: input.body,
          isActive: input.isActive ?? false,
          providerSignatureImage: input.providerSignatureImage ?? null,
          providerStampImage: input.providerStampImage ?? null,
          providerSignerName: input.providerSignerName ?? null,
          providerSignerTitle: input.providerSignerTitle ?? null,
          providerLegalName: input.providerLegalName ?? null,
          providerTin: input.providerTin ?? null,
          providerRegistrationNo: input.providerRegistrationNo ?? null,
          providerAddress: input.providerAddress ?? null,
          providerEmail: input.providerEmail ?? null,
          providerPhone: input.providerPhone ?? null,
          governingLaw: input.governingLaw ?? null,
          signatureAttachedBy: signing ? req.user!.id : null,
          signatureAttachedAt: signing ? new Date() : null,
          createdBy: req.user?.id ?? null,
        },
      });

      if (created.isActive) await deactivateOthers(tx, created.id);
      return created;
    });

    sendSuccess(res, {
      messageKey: "platform.contractTemplateCreated",
      data: serialize(template),
      status: 201,
    });
  }),
);

platformContractsRouter.put(
  "/contract-templates/:id",
  asyncHandler(async (req, res) => {
    const input = templateSchema.partial().parse(req.body ?? {});
    assertProviderImages(input);

    const existing = await prisma.contractTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw HttpError.notFound("platform.contractTemplateNotFound", {
        code: "contract_template_not_found",
      });
    }

    /*
     * The PIN is demanded before anything is written, so a wrong one leaves the
     * template exactly as it was rather than half-updated.
     */
    const signing = touchesSignature(input, existing);
    if (signing) await assertSigningPin(req.user!.id, input.pin);

    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.contractTemplate.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          description: input.description === undefined ? existing.description : input.description,
          body: input.body ?? existing.body,
          isActive: input.isActive ?? existing.isActive,
          /*
           * The version moves only when the wording does. Renaming a template
           * or toggling which one is live does not change what anybody agreed
           * to, and bumping it for that would make the number meaningless as a
           * record of what was signed.
           */
          version: input.body && input.body !== existing.body ? existing.version + 1 : existing.version,

          /*
           * `undefined` leaves the stored image alone; an explicit null clears
           * it. Without that distinction a rename would wipe the signature,
           * because a partial update sends only the fields that changed.
           */
          providerSignatureImage:
            input.providerSignatureImage === undefined
              ? existing.providerSignatureImage
              : input.providerSignatureImage,
          providerStampImage:
            input.providerStampImage === undefined
              ? existing.providerStampImage
              : input.providerStampImage,
          providerSignerName:
            input.providerSignerName === undefined
              ? existing.providerSignerName
              : input.providerSignerName,
          providerSignerTitle:
            input.providerSignerTitle === undefined
              ? existing.providerSignerTitle
              : input.providerSignerTitle,

          providerLegalName:
            input.providerLegalName === undefined
              ? existing.providerLegalName
              : input.providerLegalName,
          providerTin: input.providerTin === undefined ? existing.providerTin : input.providerTin,
          providerRegistrationNo:
            input.providerRegistrationNo === undefined
              ? existing.providerRegistrationNo
              : input.providerRegistrationNo,
          providerAddress:
            input.providerAddress === undefined ? existing.providerAddress : input.providerAddress,
          providerEmail:
            input.providerEmail === undefined ? existing.providerEmail : input.providerEmail,
          providerPhone:
            input.providerPhone === undefined ? existing.providerPhone : input.providerPhone,
          governingLaw:
            input.governingLaw === undefined ? existing.governingLaw : input.governingLaw,

          // Left alone unless the mark itself moved, so the record answers
          // "who signed this template" rather than "who last renamed it".
          signatureAttachedBy: signing ? req.user!.id : existing.signatureAttachedBy,
          signatureAttachedAt: signing ? new Date() : existing.signatureAttachedAt,
        },
      });

      if (updated.isActive) await deactivateOthers(tx, updated.id);
      return updated;
    });

    sendSuccess(res, {
      messageKey: "platform.contractTemplateUpdated",
      data: serialize(template),
    });
  }),
);

platformContractsRouter.delete(
  "/contract-templates/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.contractTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw HttpError.notFound("platform.contractTemplateNotFound", {
        code: "contract_template_not_found",
      });
    }

    /*
     * The live template cannot be deleted out from under the signup flow.
     * Activate another one first — an explicit choice about what customers
     * sign, rather than a deletion that silently leaves nothing.
     */
    if (existing.isActive) {
      throw HttpError.badRequest("platform.contractTemplateActive", {
        code: "contract_template_active",
      });
    }

    await prisma.contractTemplate.delete({ where: { id: existing.id } });

    sendSuccess(res, {
      messageKey: "platform.contractTemplateDeleted",
      data: { id: existing.id },
    });
  }),
);

/** Exactly one template is live; activating one stands the others down. */
async function deactivateOthers(tx: Prisma.TransactionClient, keepId: string) {
  await tx.contractTemplate.updateMany({
    where: { id: { not: keepId }, isActive: true },
    data: { isActive: false },
  });
}
