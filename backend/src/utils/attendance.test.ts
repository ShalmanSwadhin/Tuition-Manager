import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, countCompleted } from "./attendance";

test("target 12, completed 8 -> remaining 4, progress 66.7%", () => {
  const s = summarize(12, 8);
  assert.equal(s.remaining, 4);
  assert.equal(s.progressPercent, 66.7);
});

test("target 16, completed 10 -> remaining 6", () => {
  const s = summarize(16, 10);
  assert.equal(s.remaining, 6);
});

test("completed can exceed target without remaining going negative", () => {
  const s = summarize(12, 15);
  assert.equal(s.remaining, 0);
  assert.equal(s.progressPercent, 125);
});

test("countCompleted only counts status === completed", () => {
  const sessions = [
    { status: "completed" },
    { status: "scheduled" },
    { status: "cancelled" },
    { status: "completed" },
  ];
  assert.equal(countCompleted(sessions), 2);
});

test("scheduling or cancelling never counts toward completed", () => {
  assert.equal(countCompleted([{ status: "scheduled" }, { status: "cancelled" }]), 0);
});
