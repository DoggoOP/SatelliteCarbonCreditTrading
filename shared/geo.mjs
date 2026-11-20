/** Geodesic helpers shared by the API and the map UI. */

export function polygonAreaM2(geometry) {
  const rings = geometry?.coordinates;
  if (!rings?.length) return 0;
  const outer = Math.abs(ringArea(rings[0]));
  let holes = 0;
  for (let i = 1; i < rings.length; i += 1) holes += Math.abs(ringArea(rings[i]));
  return Math.max(0, outer - holes);
}

export function polygonAreaHa(geometry) {
  return polygonAreaM2(geometry) / 10000;
}

function ringArea(coords) {
  if (!coords || coords.length < 4) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const lon1 = (coords[i][0] * Math.PI) / 180;
    const lat1 = (coords[i][1] * Math.PI) / 180;
    const lon2 = (coords[i + 1][0] * Math.PI) / 180;
    const lat2 = (coords[i + 1][1] * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return (area * R * R) / 2;
}

export function centroid(geometry) {
  const ring = geometry.coordinates[0];
  let n = ring.length;
  if (
    n > 1 &&
    ring[0][0] === ring[n - 1][0] &&
    ring[0][1] === ring[n - 1][1]
  ) {
    n -= 1;
  }
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

export function bboxOf(geometry) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      west = Math.min(west, coords[0]);
      east = Math.max(east, coords[0]);
      south = Math.min(south, coords[1]);
      north = Math.max(north, coords[1]);
      return;
    }
    for (const c of coords) walk(c);
  };
  walk(geometry.coordinates);
  return [west, south, east, north];
}

export function bboxContains(bbox, lon, lat) {
  if (!bbox || bbox.length < 4) return false;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

export function rectangle(west, south, east, north) {
  return {
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
}
