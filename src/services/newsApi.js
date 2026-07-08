import { ApiError } from "./ApiError.js";
import { withCache } from "./cache.js";

const BASE_URL = "https://newsapi.org/v2/everything";
const NEWS_TTL_MS = 5 * 60 * 1000; // headlines don't change meaningfully minute to minute
const FETCH_TIMEOUT_MS = 10_000;

export async function getBusinessNews(query) {
  return withCache(`news:${query.toLowerCase()}`, NEWS_TTL_MS, async () => {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, "NEWS_API_KEY is not configured on the server");
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("apiKey", apiKey);

    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new ApiError(504, "NewsAPI request timed out");
      }
      throw new ApiError(502, "Failed to reach NewsAPI");
    }

    const data = await response.json();

    if (data.status === "error") {
      const statusCode = response.status === 401 ? 500 : response.status || 502;
      throw new ApiError(statusCode, data.message || "NewsAPI request failed");
    }

    return data.articles.map((article) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source?.name,
      author: article.author,
      publishedAt: article.publishedAt,
    }));
  });
}
