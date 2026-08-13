import { Router } from "express";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { createPendingWorkspace } from "./workspace.service";

export const workspaceRouter = Router();

workspaceRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await prisma.publicSubscriptionPlanCatalog.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { code: "asc" },
    });
    sendSuccess(res, { messageKey: "workspace.plansLoaded", data: { plans } });
  })
);

workspaceRouter.get(
  "/payment-methods",
  asyncHandler(async (_req, res) => {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
    sendSuccess(res, { messageKey: "workspace.paymentMethodsLoaded", data: { paymentMethods } });
  })
);

workspaceRouter.post(
  "/pending",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await createPendingWorkspace({ ...req.body, userId: req.user!.id });
    sendSuccess(res, { messageKey: "workspace.created", data: result });
  })
);
