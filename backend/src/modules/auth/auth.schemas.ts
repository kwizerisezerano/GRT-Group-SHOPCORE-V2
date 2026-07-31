import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  // display_name/phone arrive already AES-encrypted client-side
  // (src/lib/encryption.ts) - opaque ciphertext strings to this backend.
  displayName: z.string().min(1),
  businessName: z.string().min(1),
  businessPhone: z.string().optional(),
  businessLocation: z.string().optional(),
  businessType: z.string().optional(),
  teamSize: z.string().optional(),
  language: z.enum(["en", "fr", "rw", "sw"]).optional(),
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
