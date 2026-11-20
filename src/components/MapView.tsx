import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Polygon } from "../lib/types";

type DrawMode = "idle" | "polygon" | "rectangle";

type Props = {
  aoi: Polygon | null;
  mode: DrawMode;
  focus: { west: number; south: number; east: number; north: number; token: number } | null;
  ndviTiles: string | null;
  showNdvi: boolean;
  onAoi: (geometry: Polygon | null) => void;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapView({ aoi, mode, focus, ndviTiles, showNdvi, onAoi }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const modeRef = useRef<DrawMode>(mode);
  const vertsRef = useRef<number[][]>([]);
  const dragRef = useRef<{ start: maplibregl.LngLat } | null>(null);
  const rectRef = useRef<Polygon | null>(null);
  const onAoiRef = useRef(onAoi);
  onAoiRef.current = onAoi;
  modeRef.current = mode;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution:
              "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          },
        },
        layers: [{ id: "satellite", type: "raster", source: "satellite" }],
      },
      center: [-59.955, -2.955],
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    const addDrawLayers = () => {
      if (map.getSource("aoi")) return;
      map.addSource("aoi", { type: "geojson", data: EMPTY });
      map.addSource("draft", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi",
        paint: { "fill-color": "#f0c14a", "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: "aoi-casing",
        type: "line",
        source: "aoi",
        paint: { "line-color": "#04110c", "line-width": 14, "line-opacity": 1 },
      });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: "aoi",
        paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 1 },
      });
      map.addLayer({
        id: "draft-casing",
        type: "line",
        source: "draft",
        paint: { "line-color": "#07140f", "line-width": 7 },
      });
      map.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        paint: { "line-color": "#ffe08a", "line-width": 3, "line-dasharray": [1.4, 1] },
      });
      map.addLayer({
        id: "draft-pts",
        type: "circle",
        source: "draft",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-width": 2, "circle-stroke-color": "#04110c" },
      });
    };
    if (map.isStyleLoaded()) addDrawLayers();
    else map.on("load", addDrawLayers);

    const setDraft = (coordinates: number[][]) => {
      const source = map.getSource("draft") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      const features: GeoJSON.Feature[] = coordinates.map((c) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: c },
      }));
      if (coordinates.length >= 2) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        });
      }
      source.setData({ type: "FeatureCollection", features });
    };

    const finishPolygon = () => {
      const verts = vertsRef.current;
      if (verts.length >= 3) {
        const ring = [...verts, verts[0]];
        onAoiRef.current({ type: "Polygon", coordinates: [ring] });
      }
      vertsRef.current = [];
      setDraft([]);
    };

    map.on("click", (event) => {
      if (modeRef.current !== "polygon") return;
      const verts = vertsRef.current;
      if (verts.length >= 3) {
        const first = map.project(verts[0] as [number, number]);
        const dx = first.x - event.point.x;
        const dy = first.y - event.point.y;
        if (Math.hypot(dx, dy) < 14) {
          finishPolygon();
          return;
        }
      }
      verts.push([event.lngLat.lng, event.lngLat.lat]);
      setDraft(verts);
    });

    map.on("dblclick", (event) => {
      if (modeRef.current !== "polygon") return;
      event.preventDefault();
      if (vertsRef.current.length) vertsRef.current.pop();
      finishPolygon();
    });

    map.on("mousedown", (event) => {
      if (modeRef.current !== "rectangle") return;
      event.preventDefault();
      dragRef.current = { start: event.lngLat };
      map.dragPan.disable();
    });

    map.on("mousemove", (event) => {
      const drag = dragRef.current;
      if (!drag || modeRef.current !== "rectangle") return;
      const west = Math.min(drag.start.lng, event.lngLat.lng);
      const east = Math.max(drag.start.lng, event.lngLat.lng);
      const south = Math.min(drag.start.lat, event.lngLat.lat);
      const north = Math.max(drag.start.lat, event.lngLat.lat);
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      };
      rectRef.current = geometry;
      const source = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
      source?.setData({ type: "Feature", properties: {}, geometry });
    });

    const endDrag = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      map.dragPan.enable();
      if (rectRef.current) onAoiRef.current(rectRef.current);
    };
    window.addEventListener("mouseup", endDrag);

    mapRef.current = map;
    return () => {
      window.removeEventListener("mouseup", endDrag);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      map.doubleClickZoom[mode === "polygon" ? "disable" : "enable"]();
      map.getCanvas().style.cursor = mode === "idle" ? "" : "crosshair";
      if (mode !== "polygon") {
        vertsRef.current = [];
        const draft = map.getSource("draft") as maplibregl.GeoJSONSource | undefined;
        draft?.setData(EMPTY);
      }
    };
    if (map.getSource("draft")) apply();
    else map.once("load", apply);
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
      if (!source) return false;
      source.setData(aoi ? { type: "Feature", properties: {}, geometry: aoi } : EMPTY);
      return true;
    };
    // isStyleLoaded stays false while raster tiles are still arriving, so gate on the source.
    if (!apply()) map.once("load", apply);
  }, [aoi]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const apply = () => {
      map.fitBounds(
        [
          [focus.west, focus.south],
          [focus.east, focus.north],
        ],
        { padding: 48, duration: 700, maxZoom: 15 },
      );
    };
    if (map.isStyleLoaded() || map.getLayer("satellite")) apply();
    else map.once("load", apply);
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("ndvi")) map.removeLayer("ndvi");
      if (map.getSource("ndvi")) map.removeSource("ndvi");
      if (showNdvi && ndviTiles) {
        const source = ndviTiles.includes("tilejson.json")
          ? { type: "raster" as const, url: ndviTiles, tileSize: 256 }
          : { type: "raster" as const, tiles: [ndviTiles], tileSize: 256 };
        map.addSource("ndvi", source);
        map.addLayer(
          { id: "ndvi", type: "raster", source: "ndvi", paint: { "raster-opacity": 0.72 } },
          "aoi-fill",
        );
        for (const id of ["aoi-fill", "aoi-casing", "aoi-line", "draft-casing", "draft-line", "draft-pts"]) {
          if (map.getLayer(id)) map.moveLayer(id);
        }
      }
    };
    if (map.getLayer("satellite")) apply();
    else map.once("load", apply);
  }, [ndviTiles, showNdvi]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
