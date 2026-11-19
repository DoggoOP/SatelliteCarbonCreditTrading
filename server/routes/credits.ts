import { Router } from "express";
import { CREDIT_DISCLAIMER, type CreateListingRequest, type PurchaseRequest } from "../../shared/contract";
import { addListing, listListings, portfolio, recordPurchase } from "../store/ledger";

export const creditsRouter = Router();

creditsRouter.get("/credits", (_request, response) => {
  response.json(listListings());
});

creditsRouter.get("/portfolio", (_request, response) => {
  response.json(portfolio());
});

creditsRouter.post("/credits", async (request, response) => {
  try {
    const body = request.body as CreateListingRequest;
    const analysis = body.analysis;
    const issuable = analysis?.credits?.annualIssuableTco2e;
    if (!analysis?.id || issuable == null || issuable <= 0) {
      response.status(400).json({
        error: "This stand has no positive buffered removals to list. Standing stock is not a credit.",
      });
      return;
    }
    if (analysis.uncertainty.band === "insufficient") {
      response.status(400).json({ error: "Confidence is insufficient. Do not list this polygon." });
      return;
    }
    const suggested = analysis.credits.suggestedPriceUsdPerTonne ?? 12;
    const price = body.pricePerTonneUsd ?? suggested;
    if (!Number.isFinite(price) || price < 1 || price > 200) {
      response.status(400).json({ error: "Price must be between $1 and $200 per tonne." });
      return;
    }
    const listing = await addListing({
      id: `crd_${crypto.randomUUID().slice(0, 8)}`,
      analysisId: analysis.id,
      projectName: analysis.name,
      regionLabel: analysis.name,
      vintageYear: new Date().getUTCFullYear(),
      annualTco2e: issuable,
      remainingTco2e: issuable,
      pricePerTonneUsd: price,
      confidence: analysis.uncertainty.band,
      status: "listed",
      areaHa: analysis.areaHa,
      carbonStockTco2e: analysis.stock.carbonStockTco2e,
      methodNote: `${analysis.forecast.method} ${CREDIT_DISCLAIMER}`,
      createdAt: new Date().toISOString(),
    });
    response.status(201).json(listing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list credits";
    response.status(500).json({ error: message });
  }
});

creditsRouter.post("/credits/:id/purchase", async (request, response) => {
  try {
    const body = request.body as PurchaseRequest;
    const buyerName = body.buyerName?.trim();
    if (!buyerName || buyerName.length > 80) {
      response.status(400).json({ error: "Enter a buyer name under 80 characters." });
      return;
    }
    const receipt = await recordPurchase(request.params.id, buyerName, Number(body.tco2e));
    response.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase failed";
    const status = message === "Listing not found" ? 404 : 400;
    response.status(status).json({ error: message });
  }
});
