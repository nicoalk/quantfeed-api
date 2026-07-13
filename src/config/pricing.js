// Single source of truth for per-call pricing. x402 prices (declared in
// paymentMiddlewareFromConfig) and MPP prices (declared per-route via mppx's
// payment() middleware) don't sync automatically — both integrations should read
// from this object instead of hardcoding prices in two places.
export const PRICING_USD = {
  "GET /stock-price": 0.01,
  "GET /company-overview": 0.02,
  "GET /business-news": 0.02,
};

export const MPP_CURRENCY = "USDC";

export function asX402Price(routeKey) {
  return `$${PRICING_USD[routeKey].toFixed(2)}`;
}

export function asMppAmount(routeKey) {
  return PRICING_USD[routeKey].toFixed(2);
}
