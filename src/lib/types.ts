export type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type NdviPoint = {
  date: string;
  ndvi: number;
  sceneCloud: number;
};

export type AnalysisResult = {
  engine: "builtin" | "data-engine";
  generatedAt: string;
  areaHa: number;
  centroid: [number, number] | null;
  meanNdvi: number | null;
  medianNdvi: number | null;
  meanEvi: number | null;
  ndviSeries: NdviPoint[];
  biomass: {
    densityMgHa: number;
    totalMg: number;
    coverage: number;
    gediCoverage: number;
    method: string;
    methodDetail: string;
    hgbDensityMgHa: number | null;
    chlorisDensityMgHa: number | null;
    ndviDensityMgHa: number | null;
    hgbYear: number | null;
    chlorisYear: number | null;
  };
  carbon: {
    stockTC: number;
    stockTCo2e: number;
    annualSequestrationTdmHa: number;
    annualSequestrationTCo2eHa: number;
    annualSequestrationTCo2e: number;
    sequestrationMethod: string;
    carbonFraction: number;
  };
  uncertainty: {
    level: "High" | "Medium" | "Low";
    score: number;
    agbdLow: number;
    agbdHigh: number;
    carbonTCLow: number;
    carbonTCHigh: number;
    notes: string[];
  };
  quality: {
    validPixelFraction: number | null;
    cloudFraction: number | null;
    sceneId: string | null;
    sceneDate: string | null;
    sceneCloudCover: number | null;
  };
  landcover: {
    treeFraction: number | null;
    majorityClass: string | null;
    ipccZone: string;
  };
  overlay: { tileUrl: string | null };
  sources: { name: string; detail: string }[];
  limitations: string[];
};

export type GeocodeHit = {
  label: string;
  lat: number;
  lon: number;
  bbox: number[] | null;
};
