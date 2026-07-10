import { ApiError } from "./ApiError.js";
import { withCache } from "./cache.js";

const BASE_URL = "https://api.marketaux.com/v1/news/all";
const NEWS_TTL_MS = 5 * 60 * 1000; // headlines don't change meaningfully minute to minute
const FETCH_TIMEOUT_MS = 10_000;

export async function getBusinessNews(query) {
  return withCache(`news:${query.toLowerCase()}`, NEWS_TTL_MS, async () => {
    const apiKey = process.env.MARKETAUX_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, "MARKETAUX_API_KEY is not configured on the server");
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("search", query);
    url.searchParams.set("language", "en");
    url.searchParams.set("sort", "published_at");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("limit", "20");
    url.searchParams.set("api_token", apiKey);

    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new ApiError(504, "MarketAux request timed out");
      }
      throw new ApiError(502, "Failed to reach MarketAux");
    }

    const data = await response.json();

    if (data.error) {
      const statusCode = response.status === 401 ? 500 : response.status || 502;
      throw new ApiError(statusCode, data.error.message || "MarketAux request failed");
    }

    return data.data.map((article) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source,
      author: null,
      publishedAt: article.published_at,
    }));
  });
}
