import type { Request, Response } from "express";
import { getEnv } from "../lib/env.js";
import { checkoutSessions, orderItems, orders } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { Webhook } from "standardwebhooks";

// ---------------------------------------------------------------------------
// Polar webhook handler.
//
// Polar POSTs signed events to this endpoint whenever something happens in the
// checkout flow (e.g. "order.paid"). The critical job of this file is to turn
// a confirmed payment notification into a persisted `orders` row in OUR
// database, atomically, and without double-charging or double-creating an
// order. That requires: (1) verifying the signature, (2) deduplicating
// retried events, and (3) doing the DB writes inside a transaction.
// ---------------------------------------------------------------------------

// Node's fetch-style header API and Express's req.headers both allow a header
// value to be either a single string OR an array of strings. This helper
// normalizes that: if Express handed us an array, take the first entry.
function headerString(headers: Request["headers"], name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

// When we created the checkout (see src/lib/polar.ts), we stuffed our own
// `checkout_session_id` into the metadata of the checkout. Polar copies that
// metadata onto the resulting order, so this helper digs it back out. That id
// is the link between a Polar event and the matching row in our
// `checkout_sessions` table.
function checkoutSessionIdFromMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const sessionId = (metadata as Record<string, unknown>).checkout_session_id;
  return typeof sessionId === "string" ? sessionId : undefined;
}

// Polar may deliver the SAME event multiple times (retries on failure, or the
// same order appearing in several events). We must only create the order once.
// This helper returns true if an order for the given Polar order id OR the
// given checkout id already exists AND is already marked "paid".
async function alreadyPaid(polarOrderId?: string, checkoutId?: string) {
  // Look up by the unique Polar order id first (the strongest dedup key).
  if (polarOrderId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarOrderId, polarOrderId))
      .limit(1);
    if (row?.status === "paid") return true;
  }
  // Fall back to the Polar checkout id (unique on orders too).
  if (checkoutId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarCheckoutId, checkoutId))
      .limit(1);
    if (row?.status === "paid") return true;
  }
  return false;
}

// The happy path: a payment succeeded, so promote the pending checkout session
// into a permanent order. Everything runs in ONE transaction so that either
// all the writes commit together or none of them do — we never end up with an
// order but no line items, or a deleted checkout session but no order.
async function fulfillCheckoutSession(
  sessionId: string,
  polarOrderId: string | undefined,
  checkoutId: string | undefined,
) {
  return await db.transaction(async (tx) => {
    // Read the checkout session row, locking it with FOR UPDATE so two
    // concurrent webhook deliveries for the same session can't both proceed.
    // The lock also guards against the row disappearing mid-transaction.
    const [session] = await tx
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, sessionId))
      .for("update");

    // Session is gone (already fulfilled/deleted by a duplicate event).
    if (!session) return false;

    // Create the paid order, copying over the money amount, the customer, and
    // the Polar identifiers so we can dedup later. `?? ` / spread handle the
    // case where one of the Polar ids is missing.
    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.userId,
        status: "paid",
        totalCents: session.totalCents,
        polarCheckoutId: checkoutId ?? session.polarCheckoutId ?? null,
        ...(polarOrderId ? { polarOrderId } : {}),
      })
      .returning();

    // Snap the frozen line items from the checkout session into order_items.
    // We store the unit price at the time of purchase (not live from the
    // products table) so the order is a permanent record of what was charged.
    if (session.lines.length) {
      await tx.insert(orderItems).values(
        session.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      );
    }

    // The session has served its purpose — remove it so a later webhook
    // retry sees no session and falls through to the dedup checks.
    await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, sessionId));

    return true;
  });
}

// Main entry point: wired to the /webhooks/polar route in src/index.ts.
export async function polarWebhookHandler(req: Request, res: Response) {
  const env = getEnv();

  try {
    // If no secret is configured we cannot verify events, so refuse politely
    // with 503 (temporarily unavailable) instead of trusting anything.
    if (!env.POLAR_WEBHOOK_SECRET) {
      res.status(503).send("Polar webhooks not configured");
      return;
    }

    // Express routes that use a raw body parser give us the request body as a
    // Buffer already; otherwise coerce whatever we got into one. Signature
    // verification operates on the EXACT bytes, so we must not re-stringify.
    const raw = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));

    // standardwebhooks expects the secret base64-encoded. Our secret is a raw
    // string, so we base64 it here.
    const wh = new Webhook(Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf8").toString("base64"));

    // Polar sends the signature evidence in three standard headers.
    const id = headerString(req.headers, "webhook-id");
    const ts = headerString(req.headers, "webhook-timestamp");
    const sig = headerString(req.headers, "webhook-signature");

    // All three are required to verify; without them it's an invalid request.
    if (!id || !ts || !sig) {
      res.status(400).json({ error: "Missing webhook headers" });
      return;
    }

    // THE security check: recompute the HMAC over the raw body using our
    // secret and compare it to the signature Polar sent. If this throws, the
    // event is forged or corrupted and we reject it in the catch below.
    wh.verify(raw, { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig });

    // Now that we trust the sender, parse the JSON payload. `data` carries the
    // order object, whose shape varies by `type`.
    const event = JSON.parse(raw.toString("utf8")) as {
      type: string;
      data?: Record<string, unknown>;
    };

    // We only care about `order.paid` — the definitive "money collected" event.
    if (event.type === "order.paid" && event.data) {
      const data = event.data;
      // The Polar order id is at the top level of the order object...
      const polarOrderId = typeof data.id === "string" ? data.id : undefined;
      // ...and the id of the checkout session that produced this order is at
      // data.checkout_id.
      const checkoutId = typeof data.checkout_id === "string" ? data.checkout_id : undefined;

      // Dedup first: if a previous delivery already turned this into a paid
      // order, acknowledge the event but do nothing. (Acknowledge = 200 so
      // Polar stops retrying.)
      if (await alreadyPaid(polarOrderId, checkoutId)) {
        res.json({ ok: true, duplicate: true });
        return;
      }

      // Find our checkout session via the metadata we attached at creation.
      const sessionId = checkoutSessionIdFromMetadata(data);

      // We know which session this is: try to fulfill it.
      if (sessionId) {
        const ok = await fulfillCheckoutSession(sessionId, polarOrderId, checkoutId);

        if (ok) {
          res.json({ ok: true });
          return;
        }

        // Fulfillment returned false, meaning the session was already gone.
        // Before calling it a failure, re-check whether the order was created
        // by a concurrent duplicate delivery.
        if (await alreadyPaid(polarOrderId, checkoutId)) {
          res.json({ ok: true, duplicate: true });
          return;
        }

        // Genuinely unresolvable (e.g. session row deleted without an order).
        // Log it and respond 500 so Polar retries later.
        console.error("Polar order.paid: could not fulfill checkout session", {
          sessionId,
          checkoutId,
        });

        res.status(500).json({ error: "Checkout fulfillment failed" });
        return;
      }
      // No sessionId: we still ack with ok so Polar doesn't retry forever —
      // the order might belong to a flow we don't track in DB.
    }

    // Everything else: acknowledged, nothing to do. Returning 200 (not 4xx)
    // tells Polar the event was handled.
    res.json({ ok: true });
  } catch (err) {
    // Signature mismatch, malformed JSON, DB failure, etc. — reject with 400
    // so Polar retries the delivery.
    console.error("Polar webhook error", err);
    res.status(400).json({ error: "Invalid webhook" });
  }
}