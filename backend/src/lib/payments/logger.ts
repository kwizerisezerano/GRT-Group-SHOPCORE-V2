import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { redactPayload } from "./redact";

/**
 * Writes one line of the payment audit trail.
 *
 * Never throws. A payment that succeeded must not be reported as failed
 * because the row describing it could not be written — the money has already
 * moved by then. Failures here go to stderr, which is the one place a
 * logging failure can still be seen.
 */

export type PaymentLogEntry = {
  transactionId?: string | null;
  referenceId?: string | null;
  tenantId?: string | null;
  /** request | response | callback | status_check | error */
  direction: "request" | "response" | "callback" | "status_check" | "error";
  /** collection.initiate | callback.received | status.poll | ... */
  event: string;
  provider?: string;
  httpStatus?: number | null;
  resultStatus?: string | null;
  message?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
  durationMs?: number | null;
  ipAddress?: string | null;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return redactPayload(value) as Prisma.InputJsonValue;
}

import fs from "fs/promises";
import path from "path";

export async function writePaymentLog(entry: PaymentLogEntry): Promise<void> {
  try {
    const data = {
      transactionId: entry.transactionId ?? null,
      referenceId: entry.referenceId ?? null,
      tenantId: entry.tenantId ?? null,
      direction: entry.direction,
      event: entry.event.slice(0, 64),
      provider: entry.provider ?? "lmbtech",
      httpStatus: entry.httpStatus ?? null,
      resultStatus: entry.resultStatus ?? null,
      message: entry.message ?? null,
      requestPayload: toJson(entry.requestPayload),
      responsePayload: toJson(entry.responsePayload),
      errorMessage: entry.errorMessage ?? null,
      durationMs: entry.durationMs ?? null,
      ipAddress: entry.ipAddress ?? null,
    };

    // Save to the database
    await prisma.paymentLog.create({ data });

    // Also write to a local .log file
    const logFilePath = path.join(process.cwd(), "payments.log");
    const logLine = JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + "\n";
    await fs.appendFile(logFilePath, logLine, "utf8");

  } catch (error) {
    console.error("[payments] could not write payment log", {
      event: entry.event,
      referenceId: entry.referenceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
