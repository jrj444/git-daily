import { describe, it, expect } from "vitest";
import { utcDate } from "../utils";

describe("utcDate", () => {
  it("returns a Date at UTC midnight for '2026-05-14'", () => {
    const d = utcDate("2026-05-14");
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe("2026-05-14T00:00:00.000Z");
  });

  it("has UTC hours/minutes/seconds all zero", () => {
    const d = utcDate("2026-01-01");
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it("works correctly regardless of local timezone", () => {
    // The key guarantee: the UTC date portion always matches the input string
    const d = utcDate("2026-12-31");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(11); // 0-indexed
    expect(d.getUTCDate()).toBe(31);
  });

  it("handles leap year date", () => {
    const d = utcDate("2024-02-29");
    expect(d.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });
});
