// Run with: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isWeekend,
  workdaysBetween,
  totalWorkdaysInYear,
  calculateExcludedWorkdays,
  monthlyPermissionUsage,
  permissionDeductedDays,
  calculateRemainingToTarget,
  calculateSafetyBuffer,
  calculateStatus,
  computeStats,
  simulateLeave,
} from "../js/engine.js";

const KW = ["friday", "saturday"];

test("weekend is Friday and Saturday by default", () => {
  assert.equal(isWeekend("2026-07-03", KW), true);  // Friday
  assert.equal(isWeekend("2026-07-04", KW), true);  // Saturday
  assert.equal(isWeekend("2026-07-05", KW), false); // Sunday (workday in Kuwait)
});

test("configurable weekend (Sat/Sun)", () => {
  assert.equal(isWeekend("2026-07-05", ["saturday", "sunday"]), true);
  assert.equal(isWeekend("2026-07-03", ["saturday", "sunday"]), false); // Friday now a workday
});

test("workdaysBetween excludes weekends and holidays", () => {
  // Feb 22-26 2026 = Sun..Thu (5 weekdays); minus 2 holidays = 3
  assert.equal(workdaysBetween("2026-02-22", "2026-02-26", KW, ["2026-02-25", "2026-02-26"]), 3);
  assert.equal(workdaysBetween("2026-07-05", "2026-07-11", KW, []), 5);
});

test("totalWorkdaysInYear is reasonable for 2026", () => {
  const n = totalWorkdaysInYear(2026, KW, []);
  assert.ok(n >= 255 && n <= 262, `got ${n}`); // ~260 weekdays
});

test("excluded workdays dedupe overlaps and skip weekend/holiday", () => {
  const holidays = ["2026-07-07"]; // Tuesday
  const leaves = [
    { start_date: "2026-07-05", end_date: "2026-07-11" }, // Sun..Sat
    { start_date: "2026-07-09", end_date: "2026-07-12" }, // overlaps Thu, adds Sun
  ];
  const days = calculateExcludedWorkdays(leaves, KW, holidays);
  // Week1 workdays: Sun,Mon,Wed,Thu (Tue holiday, Fri/Sat weekend) + next Sun = 5
  assert.equal(days.size, 5);
});

test("single-day leave (no end_date) counts one workday", () => {
  const days = calculateExcludedWorkdays([{ start_date: "2026-07-05" }], KW, []);
  assert.equal(days.size, 1);
});

test("monthly permission usage aggregates hours and count", () => {
  const perms = [
    { date: "2026-07-01", hours: 2 },
    { date: "2026-07-15", hours: 3 },
    { date: "2026-08-02", hours: 1 },
  ];
  const u = monthlyPermissionUsage(perms, "2026-07");
  assert.equal(u.hours, 5);
  assert.equal(u.count, 2);
});

test("permission hours above monthly limit convert to deducted days", () => {
  const perms = [
    { date: "2026-01-05", hours: 10 },
    { date: "2026-01-20", hours: 10 }, // Jan=20, limit 12 -> 8 excess
    { date: "2026-02-10", hours: 3 },  // under limit -> 0
  ];
  const r = permissionDeductedDays(perms, 12, 7);
  assert.equal(r.excessHours, 8);
  assert.equal(r.deductedDays, 1); // floor(8/7)
});

test("safety buffer and status thresholds (20 / 10)", () => {
  assert.equal(calculateRemainingToTarget(180, 123), 57);
  assert.equal(calculateSafetyBuffer(128, 57), 71);
  assert.equal(calculateStatus(71), "safe");
  assert.equal(calculateStatus(20), "safe");
  assert.equal(calculateStatus(19), "warning");
  assert.equal(calculateStatus(10), "warning");
  assert.equal(calculateStatus(9), "danger");
  assert.equal(calculateStatus(-3), "danger");
});

const baseOpts = {
  year: 2026,
  todayISO: "2026-07-05",
  targetDays: 180,
  weekendDays: KW,
  holidays: [],
  leaves: [],
  permissions: [],
  monthlyPermHours: 12,
  monthlyPermCount: 4,
  dailyWorkHours: 7,
};

test("computeStats: percent, buffer, and equation fields", () => {
  const s = computeStats(baseOpts);
  assert.equal(s.completedDays, s.elapsedWorking);
  assert.equal(s.remainingToTarget, Math.max(0, 180 - s.completedDays));
  assert.equal(s.safetyBuffer, s.availableWorkDays - s.remainingToTarget);
  assert.equal(s.percent, Math.round((s.completedDays / 180) * 100));
  assert.equal(s.status, "safe");
});

test("computeStats: past leave reduces completed by its workdays", () => {
  const withLeave = computeStats({
    ...baseOpts,
    leaves: [{ entry_type: "annual", start_date: "2026-06-14", end_date: "2026-06-18" }], // Sun-Thu = 5
  });
  const without = computeStats(baseOpts);
  assert.equal(withLeave.completedDays, without.completedDays - 5);
});

test("computeStats: no day double-counted (leave over a holiday/weekend)", () => {
  // Leave spanning a holiday + weekend: only true workdays deduct.
  const s = computeStats({
    ...baseOpts,
    holidays: ["2026-06-16"],
    leaves: [{ entry_type: "sick", start_date: "2026-06-13", end_date: "2026-06-17" }],
    // Jun 13 Sat, 14 Sun, 15 Mon, 16 Tue(holiday), 17 Wed -> workdays: Sun,Mon,Wed = 3
  });
  const without = computeStats({ ...baseOpts, holidays: ["2026-06-16"] });
  assert.equal(without.completedDays - s.completedDays, 3);
});

test("computeStats: unreachable target => danger", () => {
  const s = computeStats({
    ...baseOpts,
    todayISO: "2026-03-01",
    leaves: [{ entry_type: "sick", start_date: "2026-03-02", end_date: "2026-12-31" }],
  });
  assert.equal(s.availableWorkDays, 0);
  assert.equal(s.reachable, false);
  assert.equal(s.status, "danger");
});

test("computeStats: current-month permission usage surfaced", () => {
  const s = computeStats({
    ...baseOpts,
    permissions: [
      { date: "2026-07-02", hours: 2 },
      { date: "2026-07-20", hours: 1 },
      { date: "2026-06-10", hours: 5 },
    ],
  });
  assert.equal(s.permMonthHours, 3);
  assert.equal(s.permMonthCount, 2);
  assert.equal(s.monthlyPermHours, 12);
  assert.equal(s.monthlyPermCount, 4);
});

test("simulateLeave: reports deducted days and buffer change without saving", () => {
  const leave = { entry_type: "annual", start_date: "2026-07-13", end_date: "2026-07-22" };
  const sim = simulateLeave(baseOpts, leave);
  assert.ok(sim.workdaysDeducted > 0);
  assert.equal(sim.bufferAfter, sim.bufferBefore - sim.workdaysDeducted);
  // original opts not mutated
  assert.equal(baseOpts.leaves.length, 0);
});

test("computeStats: achieved target reports safe", () => {
  const s = computeStats({ ...baseOpts, todayISO: "2026-12-31", targetDays: 10 });
  assert.ok(s.achieved);
  assert.equal(s.status, "safe");
  assert.equal(s.remainingToTarget, 0);
});
