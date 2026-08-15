import type { Env } from "./env.js";

// This file is a thin wrapper around Polar's "create checkout" REST API.
// Polar (https://polar.sh) is the payments provider for this store. Instead of
// hitting the Polar API directly from controllers/routes, everything is
// centralized here so the HTTP details live in one place.

// ---------------------------------------------------------------------------
// Type describing the JSON body we send to POST /v1/checkouts/
// ---------------------------------------------------------------------------
type CheckoutCreateBody = {
  // The Polar product IDs that will be in the cart. In this app there is a
  // single "generic" product configured via env.POLAR_CHECKOUT_PRODUCT_ID and
  // the real money amount is set per-checkout via `prices` below.
  products: string[];

  // Optional map of productId -> list of price options. Lets us override the
  // price of a product for this specific checkout session (this is how we
  // charge a dynamic total, since the total depends on the user's cart).
  prices?: Record<
    string,
    Array<{
      amount_type: "fixed"; // "fixed" = a plain amount (as opposed to a recurring subscription price)
      price_amount: number; // The amount in the currency's smallest unit (e.g. cents for USD)
      price_currency: string; // ISO 4217 currency code, e.g. "usd"
    }>
  >;

  // Where the customer is sent after a SUCCESSFUL payment. Polar will replace
  // the {CHECKOUT_ID} placeholder with the real checkout session id.
  success_url: string;

  // Where the customer is sent if they abandon the checkout (the "back to
  // cart" link in Polar's hosted page).
  return_url?: string;

  // Our own identifier for this customer, stored on Polar so we can correlate
  // the session back to a user in our database later.
  external_customer_id?: string;

  // Pre-fills the email address on Polar's hosted checkout page so the
  // customer does not have to type it.
  customer_email?: string;

  // Arbitrary key/value data attached to the checkout. This is echoed back to
  // us in the webhook, which is how we know which checkout_session row to
  // mark as paid (see src/webhooks/polar.ts).
  metadata?: Record<string, string | number | boolean>;
};

// ---------------------------------------------------------------------------
// Creates a hosted checkout session on Polar and returns its id + redirect URL.
// ---------------------------------------------------------------------------
export async function polarCreateCheckout(env: Env, body: CheckoutCreateBody) {
  // Read the private API token from the environment. This is the credential
  // Polar issues to us; it must never be exposed to the client.
  const token = env.POLAR_ACCESS_TOKEN;

  // If the token is missing (env validation marks it optional), fail fast with
  // a clear message instead of sending a doomed request to Polar.
  if (!token) throw new Error("POLAR_ACCESS_TOKEN is not configured");

  // Make the actual HTTP call to Polar's REST API.
  // POLAR_API_BASE defaults to https://api.polar.sh but can be overridden
  // (e.g. for local dev against a mock server).
  const res = await fetch(`${env.POLAR_API_BASE}/v1/checkouts/`, {
    method: "POST", // Creating a new resource -> POST
    headers: {
      // Polar authenticates requests with a bearer token.
      Authorization: `Bearer ${token}`,
      // Tell Polar the body is JSON so it parses it correctly.
      "Content-Type": "application/json",
    },
    // Serialize the request body (typed above) into a JSON string.
    body: JSON.stringify(body),
  });

  // A non-2xx response means Polar rejected the request (bad token, invalid
  // product, unsupported currency, etc.). Read the raw error body and include
  // it in the exception so failures are easy to diagnose.
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Polar checkout failed: ${res.status} ${errText}`);
  }

  // On success Polar returns the created checkout session. We only care about
  // two fields: the session id (persisted in our DB to link the webhook back
  // to the checkout) and the URL the customer should be redirected to.
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}