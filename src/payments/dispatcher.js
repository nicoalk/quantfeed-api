import { payment } from "mppx/express";
import { hasX402Credential } from "./x402Challenge.js";
import { hasMppCredential, getMppChallenge, getMppTransactionId } from "./mppChallenge.js";
import { isMppTransactionConsumed } from "./mppReplayGuard.js";

/**
 * Per-route gate that accepts payment via either protocol instead of
 * requiring both. MPP wins when a request somehow carries both credentials,
 * per the InFlow doc's stated routing rule (MPP wins when both are detected).
 */
export function createPaymentDispatcher({ x402Middleware, x402ChallengeServer, mppx, amount }) {
  return async function paymentDispatcher(req, res, next) {
    if (hasMppCredential(req) && !isMppTransactionConsumed(getMppTransactionId(req))) {
      return payment(mppx.charge, { amount })(req, res, next);
    }
    if (hasX402Credential(req)) {
      return x402Middleware(req, res, next);
    }

    const [x402Response, mppResponse] = await Promise.all([
      x402ChallengeServer.getChallenge(req).catch((error) => {
        console.error("x402 challenge generation failed:", error.message, error.stack);
        return null;
      }),
      getMppChallenge(mppx, amount, req).catch((error) => {
        console.error("MPP challenge generation failed:", error.message, error.stack);
        return null;
      }),
    ]);

    if (!x402Response && !mppResponse) {
      res.status(502).json({ error: "Unable to generate a payment challenge" });
      return;
    }

    res.status(402);
    const body = {};

    if (x402Response) {
      for (const [key, value] of Object.entries(x402Response.headers)) {
        res.setHeader(key, value);
      }
      body.x402 = x402Response.body ?? {};
    }

    if (mppResponse) {
      for (const [key, value] of Object.entries(mppResponse.headers)) {
        res.setHeader(key, value);
      }
      try {
        body.mpp = JSON.parse(mppResponse.body);
      } catch {
        body.mpp = mppResponse.body;
      }
    }

    // Both challenges' own headers were copied in above (MPP's includes its
    // own Content-Type: application/problem+json), but the body here is a
    // custom {x402, mpp} wrapper, not a single RFC 9457 problem object -
    // so the label must be overridden after copying, not before.
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(body);
  };
}
