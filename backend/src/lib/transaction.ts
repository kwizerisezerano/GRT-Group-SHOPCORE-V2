import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { TransactionClient } from "./stockMovement";

/**
 * Runs work in a transaction, retrying when the database rejects it for
 * contention rather than for anything wrong with the request.
 *
 * Row locks make concurrent checkouts correct, but they also make deadlocks
 * and lock-wait timeouts a normal event under load: two transactions taking
 * the same locks in different orders is a scheduling accident, not a bug in
 * either one. MySQL resolves it by killing one, and without this the victim
 * surfaced to the cashier as an opaque 500 — a sale that neither completed
 * nor explained itself.
 *
 * Retrying is safe precisely because the transaction rolled back completely:
 * there is no partial sale to reconcile, so running it again is equivalent to
 * having run it once. Backoff is jittered so two victims do not collide again
 * on the same retry tick.
 */

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 25;

/** Contention, not invalid input — the caller should try again unchanged. */
function isTransient(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: "write conflict or deadlock, please retry".
    if (error.code === "P2034") return true;

    // Raw-query failures arrive as P2010 with the driver's message attached.
    if (error.code === "P2010") {
      const message = String(error.meta?.message ?? error.message);
      return /deadlock|lock wait timeout/i.test(message);
    }
  }

  // Some driver errors are not wrapped at all.
  return /deadlock|lock wait timeout/i.test(String((error as Error)?.message ?? ""));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runInTransaction<T>(
  work: (tx: TransactionClient) => Promise<T>,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        timeout: options.timeoutMs ?? 15_000,
        // Repeatable read is MySQL's default and is what makes FOR UPDATE
        // meaningful here; stated explicitly so a server configured
        // otherwise does not silently weaken the guarantee.
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    } catch (error) {
      lastError = error;

      // A business rule rejection (insufficient stock, unknown product) is
      // not contention. Surface it immediately rather than retrying something
      // that will fail identically three more times.
      if (!isTransient(error) || attempt === MAX_ATTEMPTS) throw error;

      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * BASE_DELAY_MS);
    }
  }

  throw lastError;
}
