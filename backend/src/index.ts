import express from "express";
// import open from "open";
import "dotenv/config";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhookHandler } from "./webhooks/clerk";
import { getEnv } from "./lib/env";

const app = express();
const env = getEnv();
const rawJson = express.raw({type: 'application/json', limit: "1mb"});

// don't parse the webhook event data, it should be the raw format
app.post("/webhook/clerk", rawJson,(req, res) => {
  void clerkWebhookHandler(req, res);
})

app.use(express.json())
app.use(cors())
app.use(clerkMiddleware());


app.listen(env.PORT, async () => {
  console.log(`listening port http://localhost:${env.PORT}`);
  // await open(`http://localhost:${env.PORT}`);
})