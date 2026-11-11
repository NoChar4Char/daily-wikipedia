import { describe, expect, it } from "vitest";
import { createRng, shuffle } from "../scripts/lib/random.js";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("2026-11-03:sample");
    const b = createRng("2026-11-03:sample");
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
  });

  it("differs between seeds", () => {
    expect(createRng("2026-11-03:sample")()).not.toBe(
      createRng("2026-11-04:sample")(),
    );
  });
});

describe("shuffle", () => {
  it("is a deterministic permutation", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(items, createRng("x"));
    expect(out).toEqual(shuffle(items, createRng("x")));
    expect([...out].sort()).toEqual(items);
  });
});
