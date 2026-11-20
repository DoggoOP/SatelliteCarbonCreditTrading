import { describe, expect, it } from "vitest";
import { BUFFER_PCT } from "./constants";
import { issueCredits } from "./creditMath";
import { MarketplaceError } from "./errors";

describe("issueCredits", () => {
  it("withholds 10 / 20 / 30 percent by confidence", () => {
    expect(issueCredits(100, "High")).toMatchObject({ bufferPct: 10, bufferTCO2e: 10, bankableTCO2e: 90, grossTCO2e: 100 });
    expect(issueCredits(100, "Medium")).toMatchObject({ bufferPct: 20, bufferTCO2e: 20, bankableTCO2e: 80 });
    expect(issueCredits(100, "Low")).toMatchObject({ bufferPct: 30, bufferTCO2e: 30, bankableTCO2e: 70 });
    expect(BUFFER_PCT).toEqual({ High: 10, Medium: 20, Low: 30 });
  });

  it("keeps buffer plus bankable equal to the rounded gross", () => {
    for (const [gross, confidence] of [
      [0.03, "Low"],
      [10.01, "High"],
      [999.99, "Medium"],
      [1800, "High"],
    ] as const) {
      const issued = issueCredits(gross, confidence);
      expect(issued.bufferTCO2e + issued.bankableTCO2e).toBeCloseTo(issued.grossTCO2e, 10);
    }
    expect(issueCredits(0.03, "Low")).toEqual({
      grossTCO2e: 0.03,
      bufferPct: 30,
      bufferTCO2e: 0.01,
      bankableTCO2e: 0.02,
    });
    expect(issueCredits(10.01, "High")).toMatchObject({ bufferTCO2e: 1, bankableTCO2e: 9.01 });
  });

  it("rejects negative volume and unknown confidence", () => {
    expect(() => issueCredits(-1, "High")).toThrow(MarketplaceError);
    expect(() => issueCredits(10, "High " as "High")).toThrow(MarketplaceError);
  });
});
