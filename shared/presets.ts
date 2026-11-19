import type { Polygon } from "./contract";

export interface ForestPreset {
  id: string;
  name: string;
  region: string;
  blurb: string;
  geometry: Polygon;
}

export const PRESETS: ForestPreset[] = [
  {
    id: "redwoods",
    name: "Humboldt redwoods",
    region: "California, USA",
    blurb: "Coast redwood stand near Humboldt. Small, dense, and fast to analyze live.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-124.05, 40.32],
          [-124.03, 40.32],
          [-124.03, 40.34],
          [-124.05, 40.34],
          [-124.05, 40.32],
        ],
      ],
    },
  },
  {
    id: "amazon",
    name: "Central Amazon",
    region: "Amazonas, Brazil",
    blurb: "Closed-canopy moist forest east of Manaus.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-59.9, -2.7],
          [-59.88, -2.7],
          [-59.88, -2.68],
          [-59.9, -2.68],
          [-59.9, -2.7],
        ],
      ],
    },
  },
  {
    id: "sierra",
    name: "Sierra Nevada",
    region: "California, USA",
    blurb: "Montane forest on the western slope of the Sierra Nevada.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-120.2, 38.8],
          [-120.18, 38.8],
          [-120.18, 38.82],
          [-120.2, 38.82],
          [-120.2, 38.8],
        ],
      ],
    },
  },
];

export function presetById(id: string | null): ForestPreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
