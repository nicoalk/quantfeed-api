import "dotenv/config";
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import {
  createInflowFacilitator,
  createInflowSellerClient,
  inflowAccepts,
  inflowSchemeRegistrations,
} from "@inflowpayai/x402-seller";
import { Mppx } from "mppx/server";
import { inflow as inflowMppMethod } from "@inflowpayai/mpp-seller";
import { createX402ChallengeServer } from "./src/payments/x402Challenge.js";
import { createPaymentDispatcher } from "./src/payments/dispatcher.js";
import { stockPriceRouter } from "./src/routes/stockPrice.js";
import { companyOverviewRouter } from "./src/routes/companyOverview.js";
import { businessNewsRouter } from "./src/routes/businessNews.js";
import { asX402Price, asMppAmount, MPP_CURRENCY } from "./src/config/pricing.js";

const app = express();
const PORT = process.env.PORT || 3000;
const apiKey = process.env.INFLOW_API_KEY;
const environment = process.env.INFLOW_ENVIRONMENT || "production";

const inflow = createInflowFacilitator({ environment, apiKey });
const client = await createInflowSellerClient({ environment, apiKey });

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", (req, res) => {
  res.json({
    name: "QuantFeed API",
    endpoints: {
      "GET /stock-price": "?ticker=AAPL",
      "GET /company-overview": "?ticker=AAPL",
      "GET /business-news": "?q=federal reserve",
    },
  });
});

const x402Routes = {
  "GET /stock-price": { accepts: await inflowAccepts(client, { price: asX402Price("GET /stock-price"), schemes: ["balance"], networks: ["inflow:1"] }) },
  "GET /company-overview": { accepts: await inflowAccepts(client, { price: asX402Price("GET /company-overview"), schemes: ["balance"], networks: ["inflow:1"] }) },
  "GET /business-news": { accepts: await inflowAccepts(client, { price: asX402Price("GET /business-news"), schemes: ["balance"], networks: ["inflow:1"] }) },
};
const x402Schemes = await inflowSchemeRegistrations(client);

// The real gate for an x402-credentialed request (verify + deferred settle).
const x402Middleware = paymentMiddlewareFromConfig(x402Routes, [inflow], x402Schemes);
// A second, parallel instance used only to produce a plain challenge object
// (for merging into a combined 402) without writing to res. See
// src/payments/x402Challenge.js for why this can't reuse x402Middleware.
const x402ChallengeServer = createX402ChallengeServer([inflow], x402Schemes, x402Routes);

const mppx = Mppx.create({
  methods: [inflowMppMethod({ apiKey, environment, currency: MPP_CURRENCY })],
});

for (const routeKey of Object.keys(x402Routes)) {
  const path = routeKey.split(" ")[1];
  app.get(
    path,
    createPaymentDispatcher({
      x402Middleware,
      x402ChallengeServer,
      mppx,
      amount: asMppAmount(routeKey),
    }),
  );
}

app.use(stockPriceRouter);
app.use(companyOverviewRouter);
app.use(businessNewsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error(err);
  }
  res.status(statusCode).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`stock-news-api listening on http://localhost:${PORT}`);
});
