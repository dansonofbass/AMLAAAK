import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { FeatureCollection } from "geojson";
import { containsPoint } from "../src/lib/geography";
describe("verified administrative geography", () => {
  it("locates Tehran within the supplied ADM1 province, not an invented city polygon", () => {
    const data = JSON.parse(
      readFileSync(
        new URL("../public/iran-provinces.geojson", import.meta.url),
        "utf8",
      ),
    ) as FeatureCollection;
    const matches = data.features.filter((f) => containsPoint(f, 51.39, 35.69));
    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.some(
        (f) =>
          f.properties?.shapeName === "Tehran" &&
          f.properties?.shapeType === "ADM1",
      ),
    ).toBe(true);
  });
  it("rejects points outside and respects polygon holes", () => {
    const box = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
      },
    };
    expect(containsPoint(box, 2, 2)).toBe(true);
    expect(containsPoint(box, 5, 5)).toBe(false);
    expect(containsPoint(box, 20, 20)).toBe(false);
  });
});
