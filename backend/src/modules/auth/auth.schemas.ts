import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../../i18n";

export const signupSchema = z.object({
  email: z.string().email(),
  /*
   * The signup form already demands a symbol, a digit and mixed case. The
   * backend accepted any 8 characters, so anything calling the API directly
   * - a script, a stale client, a mobile app - could create an account far
   * weaker than the UI allows. The server is the enforcement point, so the
   * rule lives here too.
   */
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password must be 200 characters or fewer")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
  // display_name/phone arrive as plaintext over TLS and are encrypted
  // server-side (lib/crypto.ts) before they reach the database. The browser
  // must never hold the encryption key.
  displayName: z.string().min(1),
  businessName: z.string().min(1),
  businessPhone: z.string().optional(),
  businessLocation: z.string().optional(),
  businessType: z.string().optional(),
  teamSize: z.string().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  /*
   * Optional, because choosing a plan is its own screen now.
   *
   * Signup creates the account and nothing else; the customer then picks a
   * plan and pays, and *that* is what creates the workspace (POST
   * /workspace/pending). Asking somebody to commit to a price before they
   * have an account is the step most people abandon on, and it forced this
   * endpoint to do two unrelated jobs.
   *
   * Still accepted together for the callers that send them — the old
   * single-shot signup keeps working unchanged.
   */
  planCode: z.string().min(1).optional(),
  billingCycle: z.enum(["monthly", "six_months", "annual"]).optional(),
  paymentMethod: z.string().optional(),
  /*
   * The number the mobile money prompt is sent to. Optional because card and
   * bank transfer do not use one, and validated against the chosen method by
   * the payment service rather than here - only that layer knows which
   * methods are mobile money.
   */
  payerPhone: z.string().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(1),
  // Same policy as signup — a reset must not be a way around it.
  newPassword: signupSchema.shape.password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  // Same policy as signup — changing your password must not be a way around it.
  newPassword: signupSchema.shape.password,
});

/**
 * Six digits, and only digits. Trimmed first because a code pasted out of an
 * email very often arrives with a trailing space.
 */
export const verifyOtpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});
