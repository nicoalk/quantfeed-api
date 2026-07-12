import "dotenv/config";
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import {
  createInflowFacilitator,
  createInflowSellerClient,
  inflowAccepts,
  inflowSchemeRegistrations,
} from "@inflowpayai/x402-seller";
import { stockPriceRouter } from "./src/routes/stockPrice.js";
import { companyOverviewRouter } from "./src/routes/companyOverview.js";
import { businessNewsRouter } from "./src/routes/businessNews.js";
import { asX402Price } from "./src/config/pricing.js";

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

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /stock-price": { accepts: await inflowAccepts(client, { price: asX402Price("GET /stock-price"), schemes: ["balance"], networks: ["inflow:1"] }) },
      "GET /company-overview": { accepts: await inflowAccepts(client, { price: asX402Price("GET /company-overview"), schemes: ["balance"], networks: ["inflow:1"] }) },
      "GET /business-news": { accepts: await inflowAccepts(client, { price: asX402Price("GET /business-news"), schemes: ["balance"], networks: ["inflow:1"] }) },
    },
    [inflow],
    await inflowSchemeRegistrations(client),
  )
);

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
