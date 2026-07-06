/**
 * "180 Days" calculation engine — pure functions, no DOM access.
 * Portable to a Supabase Edge Function later.
 *
 * Conventions:
 * - Dates are ISO strings "YYYY-MM-DD" (local, no timezone math needed).
 * - Weekend is configurable (default Friday + Saturday for Kuwait admin).
 * - A "working day" is a non-weekend day that is not an official holiday.
 * - Leave days only deduct when they fall on a working day; overlaps count once.
 *
 * Last update to calculation rules: 2026.
 */

export const RULES_LAST_UPDATED = 2026;

// Status thresholds (in safety-buffer working days). Editable / configurable.
export const STATUS_THRESHOLDS = { safe: 20, warning: 10 };

const DAY_NAME_TO_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/* --------------------------------------------------------------- date utils */

export function toDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso, n) {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Iterate ISO dates from startISO to endISO inclusive. */
export function* dateRange(startISO, endISO) {
  const end = toDate(endISO);
  for (let d = toDate(startISO); d <= end; d.setDate(d.getDate() + 1)) {
    yield toISO(d);
  }
}

export function weekendIndexSet(weekendDays) {
  const list = (weekendDays && weekendDays.length ? weekendDays : ["friday", "saturday"]);
  return new Set(list.map((d) => (typeof d === "number" ? d : DAY_NAME_TO_INDEX[d])));
}

export function isWeekend(iso, weekendDays) {
  return weekendIndexSet(weekendDays).has(toDate(iso).getDay());
}

export function isWorkday(iso, weekendSet, holidaySet) {
  return !weekendSet.has(toDate(iso).getDay()) && !holidaySet.has(iso);
}

/* -------------------------------------------------------- working-day counts */

export function totalWorkdaysInYear(year, weekendDays, publicHolidays) {
  const ws = weekendIndexSet(weekendDays);
  const hs = new Set(publicHolidays);
  let count = 0;
  for (const iso of dateRange(`${year}-01-01`, `${year}-12-31`)) {
    if (isWorkday(iso, ws, hs)) count++;
  }
  return count;
}

/** Inclusive count of working days in [startDate, endDate]. */
export function workdaysBetween(startDate, endDate, weekendDays, publicHolidays) {
  if (toDate(startDate) > toDate(endDate)) return 0;
  const ws = weekendIndexSet(weekendDays);
  const hs = new Set(publicHolidays);
  let count = 0;
  for (const iso of dateRange(startDate, endDate)) {
    if (isWorkday(iso, ws, hs)) count++;
  }
  return count;
}

/**
 * Expand day-based leave entries into the SET of working days they consume.
 * Overlapping ranges count once; weekend/holiday days inside a range are ignored.
 */
export function calculateExcludedWorkdays(leaveEntries, weekendDays, publicHolidays) {
  const ws = weekendIndexSet(weekendDays);
  const hs = new Set(publicHolidays);
  const days = new Set();
  for (const leave of leaveEntries) {
    if (!leave.start_date) continue;
    const end = leave.end_date || leave.start_date;
    for (const iso of dateRange(leave.start_date, end)) {
      if (isWorkday(iso, ws, hs)) days.add(iso);
    }
  }
  return days; // a Set of ISO date strings
}

/* --------------------------------------------------------------- permissions */

/** Usage of hourly permissions within a given "YYYY-MM" month. */
export function monthlyPermissionUsage(permissions, ym) {
  let hours = 0, count = 0;
  for (const p of permissions) {
    if ((p.date || "").slice(0, 7) === ym) { hours += Number(p.hours) || 0; count++; }
  }
  return { hours, count };
}

/**
 * Convert hourly permissions into deducted working days.
 * Per month, hours above `monthlyLimitHours` are excess; the yearly sum of
 * excess hours divided by `dailyWorkHours` (floored) gives full deducted days.
 */
export function permissionDeductedDays(permissions, monthlyLimitHours, dailyWorkHours) {
  const byMonth = {};
  for (const p of permissions) {
    const m = (p.date || "").slice(0, 7);
    if (!m) continue;
    byMonth[m] = (byMonth[m] || 0) + (Number(p.hours) || 0);
  }
  let excessHours = 0;
  for (const h of Object.values(byMonth)) excessHours += Math.max(0, h - monthlyLimitHours);
  const deductedDays = dailyWorkHours > 0 ? Math.floor(excessHours / dailyWorkHours) : 0;
  return { excessHours, deductedDays, byMonth };
}

/* -------------------------------------------------------------- derived math */

export function calculateRemainingToTarget(targetDays, completedDays) {
  return Math.max(0, targetDays - completedDays);
}

export function calculateSafetyBuffer(availableWorkDaysUntilEndOfYear, remainingToTarget) {
  return availableWorkDaysUntilEndOfYear - remainingToTarget;
}

export function calculateStatus(safetyBuffer, thresholds = STATUS_THRESHOLDS) {
  if (safetyBuffer >= thresholds.safe) return "safe";
  if (safetyBuffer >= thresholds.warning) return "warning";
  return "danger";
}

/* ------------------------------------------------------------ orchestration */

/**
 * Full dashboard computation.
 *
 * @param {object} o
 * @param {number} o.year
 * @param {string} o.todayISO
 * @param {number} o.targetDays
 * @param {string[]} o.weekendDays          e.g. ["friday","saturday"]
 * @param {string[]} o.holidays             ISO dates
 * @param {Array}  o.leaves                 [{entry_type,start_date,end_date}]
 * @param {Array}  o.permissions            [{date,hours}]
 * @param {number} o.monthlyPermHours       monthly hours allowance (e.g. 12)
 * @param {number} o.monthlyPermCount       monthly count allowance (e.g. 4)
 * @param {number} o.dailyWorkHours
 * @param {object} [o.thresholds]
 */
export function computeStats(o) {
  const {
    year, todayISO, targetDays, weekendDays, holidays, leaves, permissions,
    monthlyPermHours = 12, monthlyPermCount = 4, dailyWorkHours = 7,
    thresholds = STATUS_THRESHOLDS,
  } = o;

  const ws = weekendIndexSet(weekendDays);
  const hs = new Set(holidays);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let today = todayISO;
  if (toDate(today) < toDate(yearStart)) today = yearStart;
  if (toDate(today) > toDate(yearEnd)) today = yearEnd;

  const leaveDays = calculateExcludedWorkdays(leaves, weekendDays, holidays);
  const perm = permissionDeductedDays(permissions, monthlyPermHours, dailyWorkHours);

  // Elapsed working days (year start .. today, inclusive) minus leaves taken.
  let elapsedWorking = 0, elapsedLeave = 0;
  for (const iso of dateRange(yearStart, today)) {
    if (!isWorkday(iso, ws, hs)) continue;
    elapsedWorking++;
    if (leaveDays.has(iso)) elapsedLeave++;
  }
  const completedDays = Math.max(0, elapsedWorking - elapsedLeave - perm.deductedDays);

  // Future capacity (day after today .. year end) minus scheduled future leaves.
  let futureWorking = 0, futureLeave = 0;
  if (toDate(today) < toDate(yearEnd)) {
    for (const iso of dateRange(addDaysISO(today, 1), yearEnd)) {
      if (!isWorkday(iso, ws, hs)) continue;
      futureWorking++;
      if (leaveDays.has(iso)) futureLeave++;
    }
  }
  const availableWorkDays = futureWorking - futureLeave;

  const remainingToTarget = calculateRemainingToTarget(targetDays, completedDays);
  const safetyBuffer = calculateSafetyBuffer(availableWorkDays, remainingToTarget);
  const maxAchievable = completedDays + availableWorkDays;
  const reachable = maxAchievable >= targetDays;
  const achieved = completedDays >= targetDays;

  let status = calculateStatus(safetyBuffer, thresholds);
  if (!reachable) status = "danger";
  if (achieved) status = "safe";

  const percent = targetDays > 0 ? Math.round((completedDays / targetDays) * 100) : 0;

  // Current-month permission usage.
  const ym = today.slice(0, 7);
  const permMonth = monthlyPermissionUsage(permissions, ym);

  return {
    year,
    completedDays,
    targetDays,
    percent,
    availableWorkDays,
    remainingToTarget,
    safetyBuffer,
    maxAchievable,
    reachable,
    achieved,
    status,
    elapsedWorking,
    totalLeaveWorkdays: leaveDays.size,
    permMonthHours: permMonth.hours,
    permMonthCount: permMonth.count,
    monthlyPermHours,
    monthlyPermCount,
    permissionExcessHours: perm.excessHours,
    permissionDeductedDays: perm.deductedDays,
    thresholds,
  };
}

/**
 * Simulate adding a future leave and report the effect on the safety buffer.
 * Does NOT mutate any stored data.
 */
export function simulateLeave(o, leave) {
  const before = computeStats(o);
  const after = computeStats({ ...o, leaves: [...o.leaves, leave] });
  return {
    workdaysDeducted: Math.max(0, before.availableWorkDays - after.availableWorkDays),
    bufferBefore: before.safetyBuffer,
    bufferAfter: after.safetyBuffer,
    statusBefore: before.status,
    statusAfter: after.status,
    reachableAfter: after.reachable,
  };
}
