import { describe, expect, it } from "vitest";
import { repr } from "./assert.js";

describe("repr", () => {
  it("returns defined falsy values without throwing", () => {
    expect(repr(0)).toBe(0);
    expect(repr("")).toBe("");
  });

  it("throws for null with label in message", () => {
    expect(() => repr(null, "x")).toThrow(/x/);
    expect(() => repr(null, "x")).toThrow(/null/);
  });

  it("throws for undefined with undefined in message", () => {
    expect(() => repr(undefined)).toThrow(/undefined/);
  });
});
