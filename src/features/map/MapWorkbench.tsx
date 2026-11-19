import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Polygon } from "../../../shared/contract";
import { areaHectares, bboxOf, centroidOf } from "../../../shared/geo";
import { PRESETS, type ForestPreset } from "../../../shared/presets";
import { Button } from "../../components/ui/Button";
import { parsePolygon } from "./geojson";
import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  name: string;
  geometry: Polygon;
  busy: boolean;
  onChange: (next: { name: string; geometry: Polygon }) => void;
  onAnalyze: () => void;
}

export function MapWorkbench({ name, geometry, busy, onChange, onAnalyze }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geometryRef = useRef(geometry);
  const [uploadError, setUploadError] = useState<string | null>(null);
  geometryRef.current = geometry;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = centroidOf(geometryRef.current);
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: start,
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("aoi", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: geometryRef.current },
      });
      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi",
        paint: { "fill-color": "#146c43", "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: "aoi",
        paint: { "line-color": "#0f5a36", "line-width": 2 },
      });
      fit(map, geometryRef.current);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: "Feature", properties: {}, geometry });
    fit(map, geometry);
  }, [geometry]);

  function choosePreset(preset: ForestPreset) {
    setUploadError(null);
    onChange({ name: preset.name, geometry: preset.geometry });
  }

  function onUpload(text: string) {
    try {
      const polygon = parsePolygon(text);
      if (!polygon) {
        setUploadError("Paste a Polygon, a Feature, or a FeatureCollection.");
        return;
      }
      setUploadError(null);
      onChange({ name: "Uploaded boundary", geometry: polygon });
    } catch {
      setUploadError("That text is not JSON.");
    }
  }

  const hectares = areaHectares(geometry);

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper shadow-card">
      <div ref={containerRef} className="h-[340px] w-full md:h-[520px]" />
      <div className="space-y-3 border-t border-line p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => choosePreset(preset)}
              className={`rounded-full border px-3 py-1 text-sm ${
                name === preset.name ? "border-ink bg-ink text-paper" : "border-line text-ink"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {name} · <span className="font-medium text-ink">{hectares.toFixed(0)} ha</span>
          </p>
          <Button onClick={onAnalyze} disabled={busy}>
            {busy ? "Reading satellites…" : "Analyze with satellites"}
          </Button>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-muted">Upload GeoJSON</summary>
          <textarea
            className="mt-2 h-24 w-full rounded-2xl border border-line bg-canvas p-3 text-xs"
            placeholder='{"type":"Polygon","coordinates":[...]}'
            onBlur={(event) => {
              if (event.target.value.trim()) onUpload(event.target.value);
            }}
          />
          {uploadError ? <p className="mt-1 text-sm text-copper">{uploadError}</p> : null}
        </details>
      </div>
    </section>
  );
}

function fit(map: maplibregl.Map, geometry: Polygon) {
  const [west, south, east, north] = bboxOf(geometry);
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 48, duration: 500, maxZoom: 13 },
  );
}
