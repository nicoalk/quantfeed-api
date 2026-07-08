import { Router } from "express";
import { getStockPrice } from "../services/alphaVantage.js";
import { ApiError } from "../services/ApiError.js";

export const stockPriceRouter = Router();

stockPriceRouter.get("/stock-price", async (req, res, next) => {
  try {
    const { ticker } = req.query;
    if (!ticker) {
      throw new ApiError(400, "Query param 'ticker' is required");
    }

    const price = await getStockPrice(ticker.toUpperCase());
    res.json(price);
  } catch (err) {
    next(err);
  }
});
