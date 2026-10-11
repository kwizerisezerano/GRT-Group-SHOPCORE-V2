import { prisma } from "../../db/prisma";
import { encryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { isCompleteImage } from "./contracts.pdf";
import { renderActiveContract, type ContractFacts } from "./contracts.render";

/**
 * Storing what a customer signed.
 *
 * ## What is trusted and what is not
 *
 * The signature image and the typed name come from the client, because they
 * can only come from there — a drawing made in a browser. The contract text
 * does not: the server renders it again here from the same template and the
 * same business details, and stores its own output. So the file a customer
 * downloads years later is the wording we served, not a body a modified client
 * posted back.
 *
 * `templateId` is checked against the template that is actually live. If an
 * operator activates a different contract between the preview and the signature
 * — a narrow window, but a real one — the signature is refused rather than
 * silently attached to wording the signer never read.
 */

/** A data URL for a small PNG or JPEG. */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * 2 MB of base64 per image.
 *
 * A signature drawn on a canvas is a few tens of kilobytes and a photographed
 * stamp a few hundred. The ceiling is here so a client cannot push megabytes
 * into a LONGTEXT column on an endpoint that is reachable before any payment.
 */
const MAX_IMAGE_CHARS = 2_000_000;

export type SignatureInput = {
  templateId: string;
  signatureImage: string;
  stampImage?: string | null;
  signerName: string;
};

/** Shared with the generate endpoint, which accepts the same two images. */
export function assertImage(value: string, what: string): void {
  if (!IMAGE_DATA_URL.test(value.trim())) {
    throw HttpError.badRequest("contracts.signatureRequired", {
      code: "invalid_signature_image",
      details: { field: what },
    });
  }

  if (value.length > MAX_IMAGE_CHARS) {
    throw HttpError.badRequest("contracts.signatureRequired", {
      code: "signature_image_too_large",
      details: { field: what },
    });
  }

  /*
   * A truncated image is refused here, at the boundary, rather than dropped
   * quietly at render time.
   *
   * Browsers display incomplete PNGs without complaint, so somebody can upload
   * one, see it perfectly in the preview, and have every contract they sign come
   * out with a blank signature line. Saying so now — while they still have the
   * file open — is the only point at which they can do anything about it.
   */
  const base64 = value.slice(value.indexOf(",") + 1).replace(/\s/g, "");
  if (!isCompleteImage(Buffer.from(base64, "base64"))) {
    throw HttpError.badRequest("contracts.imageUnreadable", {
      code: "image_unreadable",
      details: { field: what },
    });
  }
}

export async function recordSignedContract(params: {
  tenantId: string;
  userId: string;
  email: string;
  signature: SignatureInput;
  facts: ContractFacts;
  signedIp: string | null;
}) {
  const { tenantId, signature, facts, signedIp } = params;

  assertImage(signature.signatureImage, "signatureImage");
  if (signature.stampImage) assertImage(signature.stampImage, "stampImage");

  const existing = await prisma.signedContract.findFirst({ where: { tenantId } });
  if (existing) {
    throw HttpError.badRequest("contracts.alreadySigned", { code: "contract_already_signed" });
  }

  const rendered = await renderActiveContract(facts);

  if (rendered.template.id !== signature.templateId) {
    throw HttpError.badRequest("contracts.noActiveTemplate", { code: "contract_template_changed" });
  }

  return prisma.signedContract.create({
    data: {
      tenantId,
      templateId: rendered.template.id,
      templateName: rendered.template.name,
      templateVersion: rendered.template.version,
      body: rendered.body,
      signerName: signature.signerName,
      signerEmailEncrypted: encryptNullable(params.email || undefined),
      signatureImage: signature.signatureImage,
      stampImage: signature.stampImage ?? null,
      /*
       * Copied, not referenced. The template can be re-signed by a different
       * director next year, and that must not rewrite what this contract shows.
       */
      providerSignatureImage: rendered.template.providerSignatureImage,
      providerStampImage: rendered.template.providerStampImage,
      providerSignerName: rendered.template.providerSignerName,
      providerSignerTitle: rendered.template.providerSignerTitle,

      /*
       * Both parties' registered identities, snapshotted for the same reason
       * the body is. A re-downloaded PDF has to name who it bound on the day
       * it was signed — ShopCore moving office, or the customer correcting
       * their address, must not rewrite an agreement already made.
       */
      providerLegalName: rendered.provider.legalName,
      providerTin: rendered.provider.tin,
      providerRegistrationNo: rendered.provider.registrationNo,
      providerAddress: rendered.provider.address,
      providerEmail: rendered.provider.email,
      providerPhone: rendered.provider.phone,
      governingLaw: rendered.provider.governingLaw,

      customerLegalName: facts.companyName,
      customerTin: facts.tinNumber?.trim() || null,
      customerAddress: facts.businessAddress?.trim() || null,
      customerPhoneEncrypted: encryptNullable(facts.businessPhone?.trim() || undefined),

      planCode: rendered.plan.code,
      planName: rendered.plan.name,
      billingCycle: facts.billingCycle,
      amount: rendered.amount,
      currency: rendered.currency,
      signedIp,
    },
  });
}
