import { describe, it, expect } from "vitest";
import { formatNumber, parseNumber } from "../src/components/language";
import { predictionInputSchema } from "../src/lib/contracts";
describe("bilingual property input", () => {
  it("parses Persian and Arabic digits without accepting malformed prices", () => {
    expect(parseNumber("۹۰")).toBe(90);
    expect(parseNumber("١٢٣")).toBe(123);
    expect(parseNumber("۱٬۲۳۴٫۵")).toBe(1234.5);
    expect(Number.isNaN(parseNumber("1,2,3"))).toBe(true);
    expect(Number.isNaN(parseNumber(""))).toBe(true);
  });
  it("formats Persian statistics and preserves unknowns", () => {
    expect(formatNumber(420813, "fa")).toBe("۴۲۰٬۸۱۳");
    expect(formatNumber(null, "fa")).toBe("—");
    expect(formatNumber(0.166432, "en", false, 6)).toBe("0.166432");
  });
  it("essential details produce null advanced fields rather than invented defaults", () => {
    const input = predictionInputSchema.parse({
      city_slug: "tehran",
      cat3_slug: "apartment-sell",
      building_size: 90,
      rooms_count: 2,
    });
    expect(input.has_parking).toBeNull();
    expect(input.construction_year).toBeNull();
    expect(input.floor).toBeNull();
    expect(
      predictionInputSchema.parse({ ...input, has_parking: false }).has_parking,
    ).toBe(false);
  });
});
