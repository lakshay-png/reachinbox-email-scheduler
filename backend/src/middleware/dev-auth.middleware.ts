
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

export async function devAuthMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (env.NODE_ENV !== "development") {
    res.status(403).json({
      success: false,
      message: "Development authentication is disabled.",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        googleId: "dev-google-user",
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Development user not found. Run the database seed.",
      });
      return;
    }

    res.locals.userId = user.id;
    next();
  } catch (error) {
    next(error);
  }
}
