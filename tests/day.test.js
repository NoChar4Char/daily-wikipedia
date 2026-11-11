import { describe, expect, it } from "vitest";
import { addDays, dayKey, nextReset } from "../src/day.js";

describe("dayKey (resets at 04:00 UTC+8 = 20:00 UTC)", () => {
  it("stays on the previous day just before the reset", () => {
    expect(dayKey(new Date("2026-11-02T19:59:59Z"))).toBe("2026-11-02");
  });

  it("rolls over exactly at the reset", () => {
    expect(dayKey(new Date("2026-11-02T20:00:00Z"))).toBe("2026-11-03");
  });

  it("covers the whole 24h window", () => {
    expect(dayKey(new Date("2026-11-03T19:59:59Z"))).toBe("2026-11-03");
  });
});

describe("nextReset", () => {
  it("returns the next 20:00 UTC", () => {
    expect(nextReset(new Date("2026-11-03T10:00:00Z")).toISOString()).toBe(
      "2026-11-03T20:00:00.000Z",
    );
    expect(nextReset(new Date("2026-11-03T20:00:00Z")).toISOString()).toBe(
      "2026-11-04T20:00:00.000Z",
    );
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
