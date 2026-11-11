import { describe, expect, it } from "vitest";
import {
  couldBeLevel,
  levelFor,
  nicheScore,
  scoreBounds,
} from "../scripts/lib/niche.js";

// Real numbers from en.wikipedia (Nov 2026).
const obama = {
  allTimeViews: 107_388_379,
  incomingLinks: 33_397,
  languages: 255,
};
const echinaster = { allTimeViews: 15_353, incomingLinks: 15, languages: 8 };
const maloSelce = { allTimeViews: 118, incomingLinks: 0, languages: 10 };

describe("nicheScore", () => {
  it("ranks well-known topics above obscure ones", () => {
    expect(nicheScore(obama)).toBeGreaterThan(nicheScore(echinaster));
    expect(nicheScore(echinaster)).toBeGreaterThan(nicheScore(maloSelce));
  });

  it("weights relevance far more than views", () => {
    const viral = { allTimeViews: 5_000_000, incomingLinks: 0, languages: 1 };
    const referenced = {
      allTimeViews: 5_000,
      incomingLinks: 2_000,
      languages: 80,
    };
    expect(nicheScore(referenced)).toBeGreaterThan(nicheScore(viral));
  });

  it("maps to the expected levels", () => {
    expect(levelFor(nicheScore(obama))).toBe(1);
    expect(levelFor(nicheScore(echinaster))).toBe(4);
    expect(levelFor(nicheScore(maloSelce))).toBe(5);
  });
});

describe("couldBeLevel", () => {
  it("rules out levels the views can't reach", () => {
    const bounds = scoreBounds(0); // no relevance at all
    expect(couldBeLevel(1, bounds)).toBe(false);
    expect(couldBeLevel(5, bounds)).toBe(true);
  });
});
