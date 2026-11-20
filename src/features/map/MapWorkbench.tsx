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
  sentinelTileTemplate?: string | null;
  onChange: (next: { name: string; geometry: Polygon }) => void;
  onAnalyze: () => void;
}

type LngLat = [number, number];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapWorkbench({ name, geometry, busy, sentinelTileTemplate = null, onChange, onAnalyze }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geometryRef = useRef(geometry);
  const drawingRef = useRef(false);
  const draftRef = useRef<LngLat[]>([]);
  const satelliteRef = useRef<{ template: string | null; show: boolean }>({ template: null, show: true });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [showSatellite, setShowSatellite] = useState(true);
  geometryRef.current = geometry;
  drawingRef.current = drawing;
  draftRef.current = draft;
  satelliteRef.current = { template: sentinelTileTemplate, show: showSatellite };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = centroidOf(geometryRef.current);
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: start,
        zoom: 11,
        fadeDuration: 0,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Map failed to start");
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("aoi", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: geometryRef.current },
      });
      map.addSource("draft", { type: "geojson", data: EMPTY });
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
      map.addLayer({
        id: "draft-fill",
        type: "fill",
        source: "draft",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#b8612e", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "LineString"]],
        paint: { "line-color": "#b8612e", "line-width": 2 },
      });
      map.addLayer({
        id: "draft-points",
        type: "circle",
        source: "draft",
        filter: ["==", ["geometry-type"], "MultiPoint"],
        paint: { "circle-radius": 5, "circle-color": "#b8612e", "circle-stroke-width": 2, "circle-stroke-color": "#fffcf7" },
      });
      fit(map, geometryRef.current);
      applySatellite(map, satelliteRef.current.template, satelliteRef.current.show);
    });
    map.on("click", (event) => {
      if (!drawingRef.current) return;
      const next: LngLat[] = [...draftRef.current, [event.lngLat.lng, event.lngLat.lat]];
      draftRef.current = next;
      setDraft(next);
      paintDraft(map, next);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("aoi")) return;
    const source = map.getSource("aoi") as maplibregl.GeoJSONSource;
    source.setData({ type: "Feature", properties: {}, geometry });
    if (!drawingRef.current) fit(map, geometry);
  }, [geometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource("draft")) return;
    paintDraft(map, draft);
  }, [draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applySatellite(map, sentinelTileTemplate, showSatellite);
  }, [sentinelTileTemplate, showSatellite]);

  function stopDraw() {
    drawingRef.current = false;
    draftRef.current = [];
    setDrawing(false);
    setDraft([]);
    const map = mapRef.current;
    if (map) {
      map.doubleClickZoom.enable();
      map.getCanvas().style.cursor = "";
      if (map.getSource("draft")) paintDraft(map, []);
    }
  }

  function startDraw() {
    const map = mapRef.current;
    drawingRef.current = true;
    draftRef.current = [];
    setDrawing(true);
    setDraft([]);
    setUploadError(null);
    if (map) {
      map.doubleClickZoom.disable();
      map.getCanvas().style.cursor = "crosshair";
      if (map.getSource("draft")) paintDraft(map, []);
    }
  }

  function choosePreset(preset: ForestPreset) {
    stopDraw();
    setUploadError(null);
    onChange({ name: preset.name, geometry: preset.geometry });
    const map = mapRef.current;
    const source = map?.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) return;
    source.setData({ type: "Feature", properties: {}, geometry: preset.geometry });
    fit(map, preset.geometry);
  }

  function finishShape() {
    if (draft.length < 3) return;
    const ring = [...draft, draft[0]];
    const polygon: Polygon = { type: "Polygon", coordinates: [ring] };
    stopDraw();
    onChange({ name: "Drawn stand", geometry: polygon });
  }

  function onUpload(text: string) {
    try {
      const polygon = parsePolygon(text);
      if (!polygon) {
        setUploadError("Paste a Polygon, a Feature, or a FeatureCollection.");
        return;
      }
      stopDraw();
      setUploadError(null);
      onChange({ name: "Uploaded boundary", geometry: polygon });
    } catch {
      setUploadError("That text is not JSON.");
    }
  }

  const presetSelected = !drawing && PRESETS.some((preset) => preset.name === name);
  const draftPolygon: Polygon | null =
    draft.length >= 3 ? { type: "Polygon", coordinates: [[...draft, draft[0]]] } : null;
  const hectaresLabel = draftPolygon
    ? `${areaHectares(draftPolygon).toFixed(0)} ha`
    : drawing
      ? `${draft.length} corners`
      : `${areaHectares(geometry).toFixed(0)} ha`;

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper shadow-card">
      <div ref={containerRef} className="h-[420px] w-full" />
      <div className="space-y-3 border-t border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted" htmlFor="forest-preset">
            Forest
          </label>
          <select
            id="forest-preset"
            className="rounded-full border border-line bg-canvas px-3 py-2 text-sm"
            value={presetSelected ? name : "custom"}
            onChange={(event) => {
              const preset = PRESETS.find((item) => item.name === event.target.value);
              if (preset) choosePreset(preset);
            }}
          >
            {presetSelected ? null : <option value="custom">{drawing ? "Custom draw" : name}</option>}
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => (drawing ? stopDraw() : startDraw())}
            className="rounded-full border border-line px-3 py-2 text-sm"
          >
            {drawing ? "Cancel draw" : "Draw instead"}
          </button>
          {sentinelTileTemplate ? (
            <button
              type="button"
              onClick={() => setShowSatellite((value) => !value)}
              className="rounded-full border border-line px-3 py-2 text-sm"
            >
              {showSatellite ? "Hide satellite" : "Show satellite"}
            </button>
          ) : null}
        </div>
        {drawing ? (
          <p className="text-sm text-copper">
            Click the map to drop corners ({draft.length} so far). Three points, then finish.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {drawing ? "Drawing" : name} · <span className="font-medium text-ink">{hectaresLabel}</span>
          </p>
          <div className="flex gap-2">
            {drawing ? (
              <>
                <Button tone="ghost" onClick={() => setDraft((points) => points.slice(0, -1))} disabled={draft.length === 0}>
                  Undo
                </Button>
                <Button onClick={finishShape} disabled={draft.length < 3}>
                  Finish shape
                </Button>
              </>
            ) : (
              <Button onClick={onAnalyze} disabled={busy} className="px-5 py-2.5">
                {busy ? "Reading satellites…" : "Analyze with satellites"}
              </Button>
            )}
          </div>
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

function paintDraft(map: maplibregl.Map, points: LngLat[]) {
  const source = map.getSource("draft") as maplibregl.GeoJSONSource | undefined;
  source?.setData(draftCollection(points));
}

function draftCollection(points: LngLat[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (points.length >= 3) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
    });
  } else if (points.length >= 2) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: points },
    });
  }
  if (points.length > 0) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "MultiPoint", coordinates: points },
    });
  }
  return { type: "FeatureCollection", features };
}

function applySatellite(map: maplibregl.Map, template: string | null, show: boolean) {
  if (!map.getLayer("aoi-fill")) return;
  const id = "sentinel";
  if (!show || !template) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    return;
  }
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
  map.addSource(id, { type: "raster", tiles: [template], tileSize: 256 });
  map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } }, "aoi-fill");
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
