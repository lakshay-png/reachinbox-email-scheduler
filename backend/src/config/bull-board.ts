import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import basicAuth from "express-basic-auth";

import { emailQueue } from "../queues/email.queue";
import { env } from "./env";

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();

export const bullBoardAuth = basicAuth({
  users: {
    [env.BULL_BOARD_USERNAME]: env.BULL_BOARD_PASSWORD,
  },
  challenge: true,
  realm: "ReachInbox Bull Board",
});