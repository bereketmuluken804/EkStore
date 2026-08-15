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
import meRouter from "./routes/meRouter";
import productRouter from "./routes/productRouter";
import streamRouter from "./routes/streamRouter";
import checkoutRouter from "./routes/checkoutRouter";
import adminRouter from "./routes/adminRouter";

import { polarWebhookHandler } from "./webhooks/polar";
import * as Sentry from "@sentry/node";
import { sentryClerkUserMiddleware } from "./middleware/sentryClerkUser";


const app = express();
const env = getEnv();
const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// don't parse the webhook event data, it should be the raw format
app.post("/webhook/clerk", rawJson, (req, res) => {
	void clerkWebhookHandler(req, res);
});


app.post('/webhook/polar', rawJson, (req, res) => {
  void polarWebhookHandler(req, res);
})
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

//after clerk because we use getAuth in side this
app.use(sentryClerkUserMiddleware);
app.get("/health", (_, res) => {
	res.json({ ok: true });
});
 
app.use("/api/me", meRouter);
app.use("/api/products", productRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/admin", adminRouter);
// serving the frontend
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
// sentry will be attached to the respons object
Sentry.setupExpressErrorHandler(app);

app.use(
  (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const sentryId = (res as express.Response & { sentry?: string }).sentry;

    res.status(500).json({
      error: "Internal server error",
      ...(sentryId !== undefined && { sentryId }),
    });
  },
);
app.listen(env.PORT, async () => {
	console.log(`listening port http://localhost:${env.PORT}`);
	if (env.NODE_ENV === "production") {
		keepAlive.start();
	}
});
