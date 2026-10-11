import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  decryptNullable,
  encrypt,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";

/**
 * The signed-in user's own profile.
 *
 * Distinct from /auth/me, which answers "who am I and what may I do" for
 * session bootstrap. This is the editable record — display name, phone,
 * avatar, language — read by the sidebar on every authenticated page and
 * written by profile settings.
 *
 * Not built on crudModuleFactory: there is exactly one row per caller,
 * addressed by the token rather than by an id in the path, so there is no
 * list, no create and no delete to generate.
 */

export const profileRouter = Router();
profileRouter.use(requireAuth);

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(191).optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  avatarUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(512)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});

type ProfileRow = {
  id: string;
  tenantId: string | null;
  displayNameEncrypted: string | null;
  phoneEncrypted: string | null;
  language: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Decrypts on the way out. snake_case to match the rest of the wire format. */
function serialize(profile: ProfileRow) {
  return {
    id: profile.id,
    tenant_id: profile.tenantId,
    display_name: decryptNullable(profile.displayNameEncrypted),
    phone: decryptNullable(profile.phoneEncrypted),
    language: profile.language,
    avatar_url: profile.avatarUrl,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUnique({ where: { id: req.user!.id } });
    if (!profile) throw HttpError.notFound("profile.notFound");

    sendSuccess(res, { messageKey: "profile.loaded", data: serialize(profile) });
  })
);

profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    // Accepts either wire convention: the frontend sends snake_case, but this
    // endpoint is also the natural one to call from a script.
    const body = req.body ?? {};
    const input = updateProfileSchema.parse({
      displayName: body.displayName ?? body.display_name,
      phone: body.phone,
      avatarUrl: body.avatarUrl ?? body.avatar_url,
      language: body.language,
    });

    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) data.displayNameEncrypted = encrypt(input.displayName);
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
    if (input.language !== undefined) data.language = input.language;

    if (input.phone !== undefined) {
      const phoneHash = phoneBlindIndexNullable(input.phone);

      // phone_hash is unique across profiles, so a clash is another person's
      // number. Caught here to return a clear 409 rather than a 500 from the
      // constraint.
      if (phoneHash) {
        const taken = await prisma.profile.findUnique({ where: { phoneHash } });
        if (taken && taken.id !== req.user!.id) {
          throw HttpError.conflict("profile.phoneTaken", { code: "duplicate_record" });
        }
      }

      data.phoneEncrypted = encryptNullable(input.phone);
      data.phoneHash = phoneHash;
    }

    /*
     * Upsert, not update.
     *
     * A Profile shares its primary key with the User, and every path that
     * creates an account is supposed to create one alongside — but not every
     * account in the wild has one. `update` throws when the row is missing,
     * which surfaced as a 500 the first time such a person saved their
     * profile: nothing in the request was wrong, and there was no way for
     * them to get past it.
     *
     * Because the key is the user id, an upsert cannot create an orphan or
     * collide with anyone else's row — it just fills in what should already
     * have been there.
     */
    const profile = await prisma.profile.upsert({
      where: { id: req.user!.id },
      update: data,
      create: {
        id: req.user!.id,
        language: input.language ?? "en",
        ...data,
      },
    });

    // The display name is mirrored on the user row, which /auth/me reads.
    // Updating one without the other would let the two disagree.
    if (input.displayName !== undefined) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { displayNameEncrypted: encrypt(input.displayName) },
      });
    }

    sendSuccess(res, { messageKey: "profile.updated", data: serialize(profile) });
  })
);
