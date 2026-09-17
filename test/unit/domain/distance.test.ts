import { describe, expect, it } from "vitest";
import { haversineDistance } from "../../../src/domain/distance.ts";

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistance(40.0, -74.0, 40.0, -74.0)).toBe(0);
  });

  it("LA to NYC ≈ 3,944 km", () => {
    const d = haversineDistance(33.9425, -118.408056, 40.639722, -73.778889);
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(4000);
  });

  it("London to Paris ≈ 340 km", () => {
    const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  it("antipodal points ≈ 20,000 km", () => {
    const d = haversineDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19900);
    expect(d).toBeLessThan(20100);
  });
});
