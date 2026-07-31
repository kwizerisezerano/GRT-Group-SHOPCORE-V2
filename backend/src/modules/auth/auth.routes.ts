import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import * as authService from "./auth.service";
import {
  loginSchema,
  logoutSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  refreshSchema,
  signupSchema,
} from "./auth.schemas";

export const authRouter = Router();

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    res.status(201).json(result);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    res.status(200).json(result);
  })
);

authRouter.get(
  "/is-platform-admin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    res.status(200).json({ isPlatformAdmin: result.isPlatformAdmin });
  })
);

authRouter.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.status(202).json({ message: "If that email exists, a reset link has been sent." });
  })
);

authRouter.post(
  "/password-reset/complete",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = passwordResetCompleteSchema.parse(req.body);
    await authService.completePasswordReset(token, newPassword);
    res.status(200).json({ message: "Password updated." });
  })
);
