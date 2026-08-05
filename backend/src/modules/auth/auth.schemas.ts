import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../../i18n";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
  newPassword: z.string().min(8),
});
