import { Router } from "express";
import { getBusinessNews } from "../services/marketaux.js";
import { ApiError } from "../services/ApiError.js";

export const businessNewsRouter = Router();

businessNewsRouter.get("/business-news", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      throw new ApiError(400, "Query param 'q' is required");
    }

    const articles = await getBusinessNews(q);
    res.json({ query: q, count: articles.length, articles });
  } catch (err) {
    next(err);
  }
});
