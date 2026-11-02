import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifySessionToken, sessionCookie } from "../services/session.service";

export async function authMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = _req.cookies?.[sessionCookie.name];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const userId = await verifySessionToken(token);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found",
      });
      return;
    }

    res.locals.userId = user.id;
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    res.status(500).json({
      success: false,
      message: "Authentication verification failed",
    });
  }
}
