import cors from "cors";
import express from "express";
import { analyzeRouter } from "./routes/analyze";
import { creditsRouter } from "./routes/credits";
import { loadLedger } from "./store/ledger";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "carbonsight" });
});

app.use("/api", analyzeRouter);
app.use("/api", creditsRouter);

const port = Number(process.env.PORT ?? 8787);

await loadLedger();
app.listen(port, () => {
  console.log(`CarbonSight API on http://localhost:${port}`);
});
