import { ApiError } from "./ApiError.js";
import { withCache } from "./cache.js";

const BASE_URL = "https://www.alphavantage.co/query";
const QUOTE_TTL_MS = 60 * 1000; // quotes move fast, but a 1-minute cache absorbs repeat/burst lookups
const OVERVIEW_TTL_MS = 24 * 60 * 60 * 1000; // fundamentals barely change day to day
const FETCH_TIMEOUT_MS = 10_000;

async function callAlphaVantage(params) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "ALPHA_VANTAGE_API_KEY is not configured on the server");
  }

  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new ApiError(504, "Alpha Vantage request timed out");
    }
    throw new ApiError(502, "Failed to reach Alpha Vantage");
  }

  if (!response.ok) {
    throw new ApiError(502, `Alpha Vantage request failed with status ${response.status}`);
  }

  const data = await response.json();

  // Alpha Vantage returns HTTP 200 even for errors/rate limits, so check the body.
  if (data["Error Message"]) {
    throw new ApiError(404, data["Error Message"]);
  }
  if (data["Note"] || data["Information"]) {
    throw new ApiError(429, data["Note"] || data["Information"]);
  }

  return data;
}

export async function getStockPrice(ticker) {
  return withCache(`quote:${ticker}`, QUOTE_TTL_MS, async () => {
    const data = await callAlphaVantage({ function: "GLOBAL_QUOTE", symbol: ticker });
    const quote = data["Global Quote"];

    if (!quote || Object.keys(quote).length === 0) {
      throw new ApiError(404, `No quote data found for ticker "${ticker}"`);
    }

    return {
      symbol: quote["01. symbol"],
      price: Number(quote["05. price"]),
      change: Number(quote["09. change"]),
      changePercent: quote["10. change percent"],
      volume: Number(quote["06. volume"]),
      latestTradingDay: quote["07. latest trading day"],
      previousClose: Number(quote["08. previous close"]),
      open: Number(quote["02. open"]),
      high: Number(quote["03. high"]),
      low: Number(quote["04. low"]),
    };
  });
}

export async function getCompanyOverview(ticker) {
  return withCache(`overview:${ticker}`, OVERVIEW_TTL_MS, async () => {
    const data = await callAlphaVantage({ function: "OVERVIEW", symbol: ticker });

    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(404, `No company overview found for ticker "${ticker}"`);
    }

    return data;
  });
}
