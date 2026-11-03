import { test } from "node:test";
import assert from "node:assert/strict";
import { monthBounds, isValidDateStr } from "./dateUtils";

test("monthBounds returns correct start/end for a 31-day month", () => {
  const { start, end } = monthBounds(2026, 1);
  assert.equal(start, "2026-01-01");
  assert.equal(end, "2026-01-31");
});

test("monthBounds handles February in a non-leap year", () => {
  const { end } = monthBounds(2026, 2);
  assert.equal(end, "2026-02-28");
});

test("monthBounds handles February in a leap year", () => {
  const { end } = monthBounds(2028, 2);
  assert.equal(end, "2028-02-29");
});

test("monthBounds handles December without rolling into next year", () => {
  const { start, end } = monthBounds(2026, 12);
  assert.equal(start, "2026-12-01");
  assert.equal(end, "2026-12-31");
});

test("isValidDateStr rejects malformed input", () => {
  assert.equal(isValidDateStr("2026-13-40"), false);
  assert.equal(isValidDateStr("not-a-date"), false);
  assert.equal(isValidDateStr("2026-09-10"), true);
});
