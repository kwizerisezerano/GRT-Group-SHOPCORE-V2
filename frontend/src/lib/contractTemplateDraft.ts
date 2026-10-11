import { FULL_CONTRACT_STARTER } from "@/lib/contractSample";

/**
 * A contract template as the console edits it.
 *
 * The API speaks snake_case and treats a missing field as "leave what is
 * stored alone"; a form field is a string that is either filled in or empty.
 * This is the shape in between, and it lives here rather than beside the editor
 * component so importing it does not drag a React component into a module that
 * only wanted a type — and so the editor file exports components only, which is
 * what keeps fast refresh working on it.
 */
export type TemplateDraft = {
  id: string | null;
  name: string;
  description: string;
  body: string;
  isActive: boolean;

  /** ShopCore's own side of the agreement. */
  providerSignatureImage: string | null;
  providerStampImage: string | null;
  providerSignerName: string;
  providerSignerTitle: string;

  /** Who ShopCore is on the face of the document. */
  providerLegalName: string;
  providerTin: string;
  providerRegistrationNo: string;
  providerAddress: string;
  providerEmail: string;
  providerPhone: string;
  governingLaw: string;
};

/**
 * What "New template" opens onto.
 *
 * The body starts as a complete agreement rather than an empty box. Asking
 * somebody to draft a subscription contract from memory produces four clauses
 * about payment and none about data, liability or notices — the ones nobody
 * misses until the day they are needed. Starting complete makes editing the
 * default and omission a decision.
 */
export const emptyDraft: TemplateDraft = {
  id: null,
  name: "",
  description: "",
  body: FULL_CONTRACT_STARTER,
  isActive: false,
  providerSignatureImage: null,
  providerStampImage: null,
  providerSignerName: "",
  providerSignerTitle: "",
  providerLegalName: "",
  providerTin: "",
  providerRegistrationNo: "",
  providerAddress: "",
  providerEmail: "",
  providerPhone: "",
  governingLaw: "",
};
