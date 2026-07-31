import { Router } from "express";
import { prisma } from "../../db/prisma";
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
    res.json({ plans });
  })
);

workspaceRouter.get(
  "/payment-methods",
  asyncHandler(async (_req, res) => {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
    res.json({ paymentMethods });
  })
);

workspaceRouter.post(
  "/pending",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await createPendingWorkspace({ ...req.body, userId: req.user!.id });
    res.json(result);
  })
);
