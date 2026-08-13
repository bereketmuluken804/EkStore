import express from "express";
// import open from "open";
import "dotenv/config";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhookHandler } from "./webhooks/clerk";
import { getEnv } from "./lib/env";
import path from "path";
import fs from "fs";
import keepAlive from "./lib/cron";

const app = express();
const env = getEnv();
const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// don't parse the webhook event data, it should be the raw format
app.post("/webhook/clerk", rawJson, (req, res) => {
	void clerkWebhookHandler(req, res);
});

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get("/health", (_, res) => {
  res.json({ ok: true });
});
const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
	app.use(express.static(publicDir));

	app.get("/{*any}", (req, res, next) => {
		if (req.method !== "GET" && req.method !== "HEAD") {
			next();
			return;
		}

		if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
			next();
			return;
		}

		res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
	});
}

app.listen(env.PORT, async () => {
	console.log(`listening port http://localhost:${env.PORT}`);
	if (env.NODE_ENV === "production") {
		keepAlive.start();
	}
});
