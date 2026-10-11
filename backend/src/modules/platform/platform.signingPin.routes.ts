import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { hashPassword, verifyPassword } from "../../lib/password";

/**
 * The signing PIN — a second, deliberate confirmation before ShopCore's own
 * signature or stamp is attached to a contract template.
 *
 * ## Why a PIN rather than the session alone
 *
 * Being signed in proves somebody authenticated at some point today. Applying
 * a company signature to the agreement every future customer will sign is not
 * an ordinary edit: it is the act that binds ShopCore. A short code re-typed at
 * that moment answers a different question from the session's — *is the person
 * at this keyboard still the person who signed in* — which is exactly the
 * question an unattended console, a borrowed laptop or a hijacked tab raises.
 *
 * ## Why not the account password
 *
 * The password is typed here to *manage* the PIN, and nowhere else. A password
 * re-typed several times an hour in the middle of ordinary work is a password
 * that ends up on a sticky note, and one shoulder-surfed keystroke costs the
 * whole account rather than one action. A PIN is scoped: it authorises
 * attaching a mark and nothing else, and it is rate-limited hard enough that
 * being short does not make it weak.
 *
 * ## Why it locks
 *
 * Four digits is ten thousand possibilities, which is nothing to a script and a
 * great deal to a person typing. Five wrong tries buys a fifteen-minute
 * lockout, so the PIN's strength comes from the ceiling on attempts rather than
 * from its length — the same trade a bank card makes.
 */

export const platformSigningPinRouter = Router();

/** Wrong tries allowed before the PIN stops answering for a while. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const PIN_SHAPE = /^\d{4,8}$/;

/**
 * Rejects the PINs that make the attempt ceiling meaningless.
 *
 * "0000", "1111", "1234", "4321" and their longer cousins are the first things
 * anyone tries, so allowing them would spend the whole attempt budget on the
 * handful of codes a guesser starts with.
 */
function assertStrongPin(pin: string): void {
  if (!PIN_SHAPE.test(pin)) {
    throw HttpError.badRequest("platform.signingPinWeak", { code: "signing_pin_weak" });
  }

  const digits = [...pin].map(Number);

  const allSame = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);

  if (allSame || ascending || descending) {
    throw HttpError.badRequest("platform.signingPinWeak", { code: "signing_pin_weak" });
  }
}

/** Minutes still to wait, rounded up so "0 minutes" is never shown. */
const minutesLeft = (until: Date) =>
  Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));

/**
 * Checks a PIN, counting the failures.
 *
 * Throws rather than returning a boolean: every caller's correct response to a
 * wrong PIN is to abandon the write, and a boolean invites one of them to
 * forget to check it.
 */
export async function assertSigningPin(userId: string, pin: string | undefined): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      signingPinHash: true,
      signingPinFailedAttempts: true,
      signingPinLockedUntil: true,
    },
  });

  if (!user?.signingPinHash) {
    throw HttpError.badRequest("platform.signingPinNotSet", { code: "signing_pin_not_set" });
  }

  if (user.signingPinLockedUntil && user.signingPinLockedUntil.getTime() > Date.now()) {
    throw new HttpError(429, "signing_pin_locked", "platform.signingPinLocked", {
      params: { minutes: minutesLeft(user.signingPinLockedUntil) },
    });
  }

  if (!pin || !PIN_SHAPE.test(pin)) {
    throw HttpError.badRequest("platform.signingPinRequired", { code: "signing_pin_required" });
  }

  if (await verifyPassword(pin, user.signingPinHash)) {
    /*
     * Only written when there is something to clear. A correct PIN on an
     * untouched counter is the common case, and it should not cost a write.
     */
    if (user.signingPinFailedAttempts > 0 || user.signingPinLockedUntil) {
      await prisma.user.update({
        where: { id: userId },
        data: { signingPinFailedAttempts: 0, signingPinLockedUntil: null },
      });
    }
    return;
  }

  const attempts = user.signingPinFailedAttempts + 1;
  const locked = attempts >= MAX_ATTEMPTS;

  await prisma.user.update({
    where: { id: userId },
    data: {
      // The counter resets with the lockout, so the next window starts clean
      // rather than locking again on the first mistake after it expires.
      signingPinFailedAttempts: locked ? 0 : attempts,
      signingPinLockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
    },
  });

  if (locked) {
    throw new HttpError(429, "signing_pin_locked", "platform.signingPinLocked", {
      params: { minutes: LOCKOUT_MINUTES },
    });
  }

  throw new HttpError(403, "signing_pin_incorrect", "platform.signingPinIncorrect", {
    details: { attemptsLeft: MAX_ATTEMPTS - attempts },
  });
}

/** Confirms the caller's account password before the PIN itself is changed. */
async function assertAccountPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(403, "password_incorrect", "platform.signingPinPasswordIncorrect");
  }
}

platformSigningPinRouter.get(
  "/signing-pin",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { signingPinHash: true, signingPinSetAt: true, signingPinLockedUntil: true },
    });

    const lockedUntil =
      user?.signingPinLockedUntil && user.signingPinLockedUntil.getTime() > Date.now()
        ? user.signingPinLockedUntil
        : null;

    sendSuccess(res, {
      messageKey: "platform.signingPinStatus",
      data: {
        configured: Boolean(user?.signingPinHash),
        set_at: user?.signingPinSetAt ?? null,
        locked_until: lockedUntil,
      },
    });
  }),
);

const setPinSchema = z.object({
  pin: z.string().trim(),
  /** The account password — proof of identity for changing the PIN itself. */
  password: z.string().min(1),
});

platformSigningPinRouter.put(
  "/signing-pin",
  asyncHandler(async (req, res) => {
    const input = setPinSchema.parse(req.body ?? {});

    await assertAccountPassword(req.user!.id, input.password);
    assertStrongPin(input.pin);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        signingPinHash: await hashPassword(input.pin),
        signingPinSetAt: new Date(),
        // A new PIN clears an old PIN's lockout: the person proved who they are
        // with their password, and leaving them locked out of a code that no
        // longer exists would be a lock with no key.
        signingPinFailedAttempts: 0,
        signingPinLockedUntil: null,
      },
    });

    sendSuccess(res, {
      messageKey: "platform.signingPinSet",
      data: { configured: true },
    });
  }),
);

platformSigningPinRouter.delete(
  "/signing-pin",
  asyncHandler(async (req, res) => {
    const password = z.string().min(1).parse((req.body ?? {}).password);
    await assertAccountPassword(req.user!.id, password);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        signingPinHash: null,
        signingPinSetAt: null,
        signingPinFailedAttempts: 0,
        signingPinLockedUntil: null,
      },
    });

    sendSuccess(res, {
      messageKey: "platform.signingPinCleared",
      data: { configured: false },
    });
  }),
);
