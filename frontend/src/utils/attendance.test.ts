import { describe, it, expect } from "vitest";
import { summarize } from "./attendance";

describe("summarize", () => {
  it("target 12, completed 8 -> remaining 4, progress 66.7%", () => {
    const s = summarize(12, 8);
    expect(s.remaining).toBe(4);
    expect(s.progressPercent).toBe(66.7);
  });

  it("target 16, completed 10 -> remaining 6", () => {
    expect(summarize(16, 10).remaining).toBe(6);
  });

  it("never returns a negative remaining when completed exceeds target", () => {
    const s = summarize(12, 15);
    expect(s.remaining).toBe(0);
    expect(s.progressPercent).toBe(125);
  });

  it("handles a zero target without dividing by zero", () => {
    const s = summarize(0, 0);
    expect(s.progressPercent).toBe(0);
    expect(s.remaining).toBe(0);
  });
});
