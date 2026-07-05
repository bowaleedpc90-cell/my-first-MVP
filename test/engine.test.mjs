// Run with: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countWorkingDays,
  isWeekend,
  isWorkingDay,
  leaveWorkingDays,
  permissionDeduction,
  computeStats,
} from "../js/engine.js";

test("weekend is Friday and Saturday", () => {
  assert.equal(isWeekend("2026-07-03"), true);  // Friday
  assert.equal(isWeekend("2026-07-04"), true);  // Saturday
  assert.equal(isWeekend("2026-07-05"), false); // Sunday (working day in Kuwait)
  assert.equal(isWeekend("2026-07-02"), false); // Thursday
});

test("holidays are excluded from working days", () => {
  const holidays = new Set(["2026-02-25", "2026-02-26"]);
  assert.equal(isWorkingDay("2026-02-25", holidays), false);
  // Feb 22-26, 2026: Sun-Thu = 5 weekdays, minus 2 holidays = 3
  assert.equal(countWorkingDays("2026-02-22", "2026-02-26", holidays), 3);
});

test("full week counts 5 working days without holidays", () => {
  assert.equal(countWorkingDays("2026-07-05", "2026-07-11", new Set()), 5);
});

test("leave days on weekends/holidays do not deduct, overlaps count once", () => {
  const holidays = new Set(["2026-07-07"]); // Tuesday
  const leaves = [
    { start_date: "2026-07-05", end_date: "2026-07-11" }, // Sun..Sat
    { start_date: "2026-07-09", end_date: "2026-07-12" }, // overlaps Thu, adds Sun
  ];
  const days = leaveWorkingDays(leaves, holidays);
  // Week 1: Sun, Mon, Wed, Thu (Tue holiday, Fri/Sat weekend) + next Sun = 5
  assert.equal(days.size, 5);
});

test("permission hours convert to deducted days above monthly allowance", () => {
  const permissions = [
    { date: "2026-01-05", hours: 5 },
    { date: "2026-01-20", hours: 5 }, // Jan total 10, allowance 2 -> 8 excess
    { date: "2026-02-10", hours: 1 }, // under allowance -> 0 excess
  ];
  const r = permissionDeduction(permissions, { monthlyAllowanceHours: 2, dailyWorkHours: 7 });
  assert.equal(r.excessHours, 8);
  assert.equal(r.deductedDays, 1); // floor(8/7)
});

test("computeStats: no leaves, mid-year", () => {
  const stats = computeStats({
    year: 2026,
    todayISO: "2026-07-05",
    targetDays: 180,
    holidays: [],
    leaves: [],
    permissions: [],
    monthlyAllowanceHours: 0,
    dailyWorkHours: 7,
  });
  assert.equal(stats.completedDays, stats.elapsedWorking);
  assert.equal(stats.remainingNeeded, 180 - stats.completedDays);
  assert.equal(stats.maxAchievable, stats.completedDays + stats.futureWorking);
  assert.equal(stats.zone, "green");
});

test("computeStats: excessive leave turns the zone red", () => {
  // A leave covering the entire remaining year makes the target unreachable.
  const stats = computeStats({
    year: 2026,
    todayISO: "2026-03-01",
    targetDays: 180,
    holidays: [],
    leaves: [{ entry_type: "sick", start_date: "2026-03-02", end_date: "2026-12-31" }],
    permissions: [],
    monthlyAllowanceHours: 0,
    dailyWorkHours: 7,
  });
  assert.equal(stats.futureWorking, 0);
  assert.ok(stats.margin < 0);
  assert.equal(stats.zone, "red");
});

test("computeStats: past leave reduces completed days", () => {
  const base = {
    year: 2026,
    todayISO: "2026-07-05",
    targetDays: 180,
    holidays: [],
    permissions: [],
    monthlyAllowanceHours: 0,
    dailyWorkHours: 7,
  };
  const without = computeStats({ ...base, leaves: [] });
  const withLeave = computeStats({
    ...base,
    leaves: [{ entry_type: "annual", start_date: "2026-06-14", end_date: "2026-06-18" }], // Sun-Thu
  });
  assert.equal(withLeave.completedDays, without.completedDays - 5);
});

test("computeStats: achieved target reports green regardless of margin", () => {
  const stats = computeStats({
    year: 2026,
    todayISO: "2026-12-31",
    targetDays: 10,
    holidays: [],
    leaves: [],
    permissions: [],
    monthlyAllowanceHours: 0,
    dailyWorkHours: 7,
  });
  assert.ok(stats.achieved);
  assert.equal(stats.zone, "green");
  assert.equal(stats.remainingNeeded, 0);
});
