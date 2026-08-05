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
  planCode: z.string().min(1),
  billingCycle: z.enum(["monthly", "six_months", "annual"]),
  paymentMethod: z.string().optional(),
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
