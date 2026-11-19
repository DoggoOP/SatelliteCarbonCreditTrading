import { Router } from "express";
import type { AnalysisRequest } from "../../shared/contract";
import { analyzeArea } from "../engine/analyze";
import { HttpError } from "../http";

export const analyzeRouter = Router();

analyzeRouter.post("/analyze", async (request, response) => {
  try {
    const body = request.body as AnalysisRequest;
    const result = await analyzeArea(body);
    response.json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Analysis failed";
    response.status(status).json({ error: message });
  }
});
