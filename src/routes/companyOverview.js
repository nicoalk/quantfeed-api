import { Router } from "express";
import { getCompanyOverview } from "../services/alphaVantage.js";
import { ApiError } from "../services/ApiError.js";

export const companyOverviewRouter = Router();

companyOverviewRouter.get("/company-overview", async (req, res, next) => {
  try {
    const { ticker } = req.query;
    if (!ticker) {
      throw new ApiError(400, "Query param 'ticker' is required");
    }

    const overview = await getCompanyOverview(ticker.toUpperCase());
    res.json(overview);
  } catch (err) {
    next(err);
  }
});
