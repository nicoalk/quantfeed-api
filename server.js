import "dotenv/config";
import express from "express";
import { stockPriceRouter } from "./src/routes/stockPrice.js";
import { companyOverviewRouter } from "./src/routes/companyOverview.js";
import { businessNewsRouter } from "./src/routes/businessNews.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => res.json({ status: "ok" }));

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
