import { ExpressAdapter, x402ResourceServer, x402HTTPResourceServer } from "@x402/express";

export function hasX402Credential(req) {
  return Boolean(req.header("payment-signature") || req.header("x-payment"));
}

/**
 * A second, parallel x402HTTPResourceServer dedicated to producing challenge
 * objects without writing to `res`. paymentMiddlewareFromConfig only exposes
 * the full Express-writing middleware, so getting a plain challenge to merge
 * with MPP's requires driving processHTTPRequest() directly - which means
 * replicating the initialize()-then-cache bookkeeping paymentMiddlewareFromConfig
 * normally does for us internally.
 */
export function createX402ChallengeServer(facilitatorClients, schemes, routes) {
  const resourceServer = new x402ResourceServer(facilitatorClients);
  for (const { network, server } of schemes) {
    resourceServer.register(network, server);
  }
  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  let initPromise = httpServer.initialize();
  let initialized = false;
  async function ensureInitialized() {
    if (initialized) return;
    if (!initPromise) initPromise = httpServer.initialize();
    try {
      await initPromise;
      initialized = true;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  }

  return {
    async getChallenge(req) {
      await ensureInitialized();
      const adapter = new ExpressAdapter(req);
      const context = {
        adapter,
        path: req.path,
        method: req.method,
        paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
      };
      const result = await httpServer.processHTTPRequest(context);
      return result.type === "payment-error" ? result.response : null;
    },
  };
}
