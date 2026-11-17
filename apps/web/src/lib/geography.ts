import type { Feature, Geometry, Position } from "geojson";
function inRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function containsPoint(
  feature: Feature<Geometry>,
  longitude: number,
  latitude: number,
) {
  const g = feature.geometry;
  const polygons =
    g.type === "Polygon"
      ? [g.coordinates]
      : g.type === "MultiPolygon"
        ? g.coordinates
        : [];
  return polygons.some(
    (rings) =>
      rings.length > 0 &&
      inRing([longitude, latitude], rings[0]) &&
      !rings.slice(1).some((hole) => inRing([longitude, latitude], hole)),
  );
}
