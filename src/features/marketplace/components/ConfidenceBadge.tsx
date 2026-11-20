import type { Confidence } from "../types";

const tones: Record<Confidence, string> = {
  High: "bg-emerald-100 text-emerald-950",
  Medium: "bg-amber-100 text-amber-950",
  Low: "bg-rose-100 text-rose-950",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[confidence]}`}>
      {confidence} confidence
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
      Demo
    </span>
  );
}
