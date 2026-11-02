import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  createGoogleOAuthState,
  consumeGoogleOAuthState,
} from "../services/google-oauth-state.service";
import {
  getGoogleAuthorizationUrl,
  verifyGoogleAuthorizationCode,
} from "../services/google-auth.service";
import {
  createSessionToken,
  sessionCookie,
} from "../services/session.service";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Start Google OAuth
router.get("/google", async (_req: Request, res: Response): Promise<void> => {
  try {
    const state = await createGoogleOAuthState();
    const authorizationUrl = getGoogleAuthorizationUrl(state);

    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("Google OAuth initiation failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to start Google authentication",
    });
  }
});

// Google OAuth callback
router.get(
  "/google/callback",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=google_denied`);
        return;
      }

      if (
        typeof code !== "string" ||
        typeof state !== "string" ||
        !(await consumeGoogleOAuthState(state))
      ) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_oauth_state`);
        return;
      }

      const profile = await verifyGoogleAuthorizationCode(code);

      const user = await prisma.$transaction(async (tx) => {
  const authenticatedUser = await tx.user.upsert({
    where: {
      googleId: profile.googleId,
    },
    update: {
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    },
    create: {
      googleId: profile.googleId,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  });

  await tx.sender.upsert({
    where: {
      userId_email: {
        userId: authenticatedUser.id,
        email: profile.email,
      },
    },
    update: {},
    create: {
      email: profile.email,
      displayName: profile.name,
      hourlyLimit: 200,
      minDelayMs: 2000,
      userId: authenticatedUser.id,
    },
  });

  return authenticatedUser;
});

      const token = await createSessionToken(user.id);

      res.cookie(sessionCookie.name, token, sessionCookie);

      res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
    } catch (error) {
      console.error("Google OAuth callback failed:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }
);

// Get current authenticated user
router.get(
  "/me",
  authMiddleware,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const userId = res.locals.userId as string;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error("Failed to retrieve authenticated user:", error);
      res.status(500).json({
        success: false,
        message: "Unable to retrieve user profile",
      });
    }
  }
);

// Logout
router.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie(sessionCookie.name, {
    httpOnly: sessionCookie.httpOnly,
    secure: sessionCookie.secure,
    sameSite: sessionCookie.sameSite,
    path: sessionCookie.path,
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
