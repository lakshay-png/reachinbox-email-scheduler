
import { prisma } from "../lib/prisma";
import { decryptSlackToken } from "../utils/slack-crypto";

const SLACK_API_BASE = "https://slack.com/api";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

interface SlackChannelsResponse extends SlackApiResponse {
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
}

async function getSlackBotToken(userId: string): Promise<string> {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: { encryptedBotToken: true },
  });

  if (!integration) {
    throw new Error("Slack workspace is not connected.");
  }

  return decryptSlackToken(integration.encryptedBotToken);
}

export async function listSlackChannels(userId: string) {
  const token = await getSlackBotToken(userId);

  const params = new URLSearchParams({
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "200",
  });

  const response = await fetch(
    `${SLACK_API_BASE}/conversations.list?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = (await response.json()) as SlackChannelsResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to retrieve Slack channels.");
  }

  return {
    channels: (data.channels || []).map((channel) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      isMember: channel.is_member,
    })),
    nextCursor: data.response_metadata?.next_cursor || null,
  };
}

export async function sendSlackMessage(
  userId: string,
  channelId: string,
  text: string
): Promise<void> {
  const token = await getSlackBotToken(userId);

  const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      text,
    }),
  });

  const data = (await response.json()) as SlackApiResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to send Slack notification.");
  }
}
