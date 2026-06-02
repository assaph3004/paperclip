import { describe, expect, it } from "vitest";
import { daysToMs } from "./time.js";

describe("daysToMs", () => {
  it("converts whole days to milliseconds", () => {
    expect(daysToMs(1)).toBe(86_400_000);
    expect(daysToMs(0)).toBe(0);
    expect(daysToMs(2.5)).toBe(216_000_000);
  });
});
