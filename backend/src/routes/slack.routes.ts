import { Router, Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth.middleware";
import { listSlackChannels } from "../services/slack.service";
import {
  createSlackOAuthState,
  consumeSlackOAuthState,
} from "../services/slack-oauth-state.service";
import { encryptSlackToken } from "../utils/slack-crypto";

const router = Router();

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  scope?: string;
  team?: {
    id: string;
    name: string;
  };
}

router.get(
  "/connect",
  authMiddleware,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!env.SLACK_CLIENT_ID || !env.SLACK_REDIRECT_URI) {
        res.status(500).json({
          success: false,
          message: "Slack OAuth configuration is missing.",
        });
        return;
      }

      const userId = res.locals.userId as string;
      const state = await createSlackOAuthState(userId);

      const params = new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        scope: "chat:write,channels:read,groups:read",
        redirect_uri: env.SLACK_REDIRECT_URI,
        state,
      });

      res.redirect(
        `https://slack.com/oauth/v2/authorize?${params.toString()}`
      );
    } catch (error) {
      console.error("Slack OAuth initialization failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to initialize Slack authorization.",
      });
    }
  }
);

// Slack OAuth callback
router.get(
  "/callback",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const state =
        typeof req.query.state === "string" ? req.query.state : "";

      if (!state) {
        res.status(400).json({
          success: false,
          message: "Missing OAuth state.",
        });
        return;
      }

      // Validate and consume state. It cannot be reused.
      const userId = await consumeSlackOAuthState(state);

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired OAuth state.",
        });
        return;
      }

      if (typeof req.query.error === "string") {
        res.status(400).json({
          success: false,
          message: "Slack authorization was denied.",
        });
        return;
      }

      const code =
        typeof req.query.code === "string" ? req.query.code : "";

      if (!code) {
        res.status(400).json({
          success: false,
          message: "Missing Slack authorization code.",
        });
        return;
      }

      if (
        !env.SLACK_CLIENT_ID ||
        !env.SLACK_CLIENT_SECRET ||
        !env.SLACK_REDIRECT_URI
      ) {
        res.status(500).json({
          success: false,
          message: "Slack OAuth configuration is incomplete.",
        });
        return;
      }

      // Exchange authorization code for a Slack bot token.
      const tokenParams = new URLSearchParams({
        code,
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        redirect_uri: env.SLACK_REDIRECT_URI,
      });

      const slackResponse = await fetch(
        "https://slack.com/api/oauth.v2.access",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenParams.toString(),
        }
      );

      const slackData =
        (await slackResponse.json()) as SlackOAuthResponse;

      if (!slackResponse.ok || !slackData.ok) {
        console.error(
          "Slack token exchange failed:",
          slackData.error || slackResponse.status
        );

        res.status(502).json({
          success: false,
          message: "Slack token exchange failed.",
        });
        return;
      }

      if (
        !slackData.access_token ||
        !slackData.team?.id
      ) {
        res.status(502).json({
          success: false,
          message: "Slack returned incomplete installation data.",
        });
        return;
      }

      // Encrypt the bot token before storing it.
      const encryptedBotToken = encryptSlackToken(
        slackData.access_token
      );

      await prisma.slackIntegration.upsert({
        where: {
          userId,
        },
        update: {
          teamId: slackData.team.id,
          teamName: slackData.team.name || null,
          botUserId: slackData.bot_user_id || null,
          encryptedBotToken,
          scopes: slackData.scope || "",
        },
        create: {
          userId,
          teamId: slackData.team.id,
          teamName: slackData.team.name || null,
          botUserId: slackData.bot_user_id || null,
          encryptedBotToken,
          scopes: slackData.scope || "",
        },
      });

      res.status(200).json({
        success: true,
        message: "Slack workspace connected successfully.",
        workspace: slackData.team.name,
      });
    } catch (error) {
      console.error("Slack OAuth callback failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to complete Slack authorization.",
      });
    }
  }
);


// List available Slack channels
router.get(
  "/channels",
  authMiddleware,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const userId = res.locals.userId as string;
      const result = await listSlackChannels(userId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Slack channel listing failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve Slack channels.",
      });
    }
  }
);

// Save the notification channel
router.post(
  "/channel",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = res.locals.userId as string;
      const channelId = req.body?.channelId;

      if (
        typeof channelId !== "string" ||
        !/^[A-Z0-9]+$/.test(channelId)
      ) {
        res.status(400).json({
          success: false,
          message: "A valid Slack channel ID is required.",
        });
        return;
      }

      const result = await listSlackChannels(userId);

      const selectedChannel = result.channels.find(
        (channel) =>
          channel.id === channelId && channel.isMember
      );

      if (!selectedChannel) {
        res.status(400).json({
          success: false,
          message: "Channel not found or bot is not a member.",
        });
        return;
      }

      await prisma.slackIntegration.update({
        where: { userId },
        data: { channelId },
      });

      res.status(200).json({
        success: true,
        message: "Slack notification channel saved.",
        channel: selectedChannel.name,
      });
    } catch (error) {
      console.error("Slack channel selection failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to save Slack notification channel.",
      });
    }
  }
);


export default router;

