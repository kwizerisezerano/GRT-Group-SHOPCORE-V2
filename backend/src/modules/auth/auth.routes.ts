import { Router } from "express";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import * as authService from "./auth.service";
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  refreshSchema,
  signupSchema,
  verifyOtpSchema,
} from "./auth.schemas";

export const authRouter = Router();

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    sendSuccess(res, { messageKey: "auth.signupSuccess", data: result, status: 201 });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    sendSuccess(res, { messageKey: "auth.loginSuccess", data: result });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    sendSuccess(res, { messageKey: "auth.tokenRefreshed", data: result });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);
    // 200 rather than 204: requirement 8 asks every response to carry a
    // message, and a 204 body is discarded by definition.
    sendSuccess(res, { messageKey: "auth.logoutSuccess" });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    sendSuccess(res, { messageKey: "auth.profileLoaded", data: result });
  })
);

authRouter.get(
  "/is-platform-admin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    sendSuccess(res, {
      messageKey: "auth.profileLoaded",
      data: { isPlatformAdmin: result.isPlatformAdmin },
    });
  })
);

authRouter.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    sendSuccess(res, { messageKey: "auth.passwordResetRequested", status: 202 });
  })
);

authRouter.post(
  "/password-reset/complete",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = passwordResetCompleteSchema.parse(req.body);
    await authService.completePasswordReset(token, newPassword);
    sendSuccess(res, { messageKey: "auth.passwordResetCompleted" });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, { messageKey: "auth.passwordChanged", data: result });
  })
);

/**
 * Second factor for a member finishing their first sign-in. Both routes are
 * behind requireAuth: the account is already authenticated by this point —
 * what is still unproven is control of the mailbox — so the user id comes
 * from the token rather than the request body, and one session cannot ask
 * for or spend another account's code.
 */
authRouter.post(
  "/otp/request",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.requestLoginOtp(req.user!.id);
    sendSuccess(res, { messageKey: "auth.otpSent", data: result });
  })
);

authRouter.post(
  "/otp/verify",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyLoginOtp(req.user!.id, code);
    sendSuccess(res, { messageKey: "auth.otpVerified", data: result });
  })
);
