/**
 * "180 Days" calculation engine — pure functions, no DOM access.
 * Designed so the same logic can later run inside a Supabase Edge Function.
 *
 * Conventions:
 * - Dates are ISO strings "YYYY-MM-DD" (local, no timezone math needed).
 * - Weekend in Kuwait: Friday (5) and Saturday (6).
 * - A "working day" is a weekday that is not an official holiday.
 * - Leave days only deduct when they fall on a working day.
 */

const WEEKEND_DAYS = [5, 6]; // Friday, Saturday

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

export function isWeekend(iso) {
  return WEEKEND_DAYS.includes(toDate(iso).getDay());
}

export function isWorkingDay(iso, holidaySet) {
  return !isWeekend(iso) && !holidaySet.has(iso);
}

/** Iterate ISO dates from startISO to endISO inclusive. */
export function* dateRange(startISO, endISO) {
  const end = toDate(endISO);
  for (let d = toDate(startISO); d <= end; d.setDate(d.getDate() + 1)) {
    yield toISO(d);
  }
}

/** Count working days in [startISO, endISO] inclusive. */
export function countWorkingDays(startISO, endISO, holidaySet) {
  if (toDate(startISO) > toDate(endISO)) return 0;
  let count = 0;
  for (const iso of dateRange(startISO, endISO)) {
    if (isWorkingDay(iso, holidaySet)) count++;
  }
  return count;
}

/**
 * Expand day-based leaves into the set of working days they consume.
 * Overlapping leaves count once. Weekend/holiday days inside a leave
 * range do not deduct.
 */
export function leaveWorkingDays(leaves, holidaySet) {
  const days = new Set();
  for (const leave of leaves) {
    for (const iso of dateRange(leave.start_date, leave.end_date)) {
      if (isWorkingDay(iso, holidaySet)) days.add(iso);
    }
  }
  return days;
}

/**
 * Convert hourly permissions into deducted days.
 * Per month, hours above `monthlyAllowanceHours` are excess; the yearly
 * sum of excess hours is divided by `dailyWorkHours` (floored) to get
 * full deducted days.
 *
 * NOTE: allowance/limits must be verified against current CSC rules
 * (roadmap Phase 1) — both parameters are user-configurable settings.
 */
export function permissionDeduction(permissions, { monthlyAllowanceHours, dailyWorkHours }) {
  const byMonth = {};
  for (const p of permissions) {
    const month = p.date.slice(0, 7); // "YYYY-MM"
    byMonth[month] = (byMonth[month] || 0) + Number(p.hours);
  }
  let excessHours = 0;
  for (const hours of Object.values(byMonth)) {
    excessHours += Math.max(0, hours - monthlyAllowanceHours);
  }
  const deductedDays = dailyWorkHours > 0 ? Math.floor(excessHours / dailyWorkHours) : 0;
  return { excessHours, deductedDays, byMonth };
}

/**
 * Main dashboard computation.
 *
 * @param {object} opts
 * @param {number} opts.year          calendar year being tracked
 * @param {string} opts.todayISO      today's date
 * @param {number} opts.targetDays    e.g. 180 admin / 135 teaching
 * @param {string[]} opts.holidays    ISO dates of official holidays
 * @param {Array}  opts.leaves        [{entry_type, start_date, end_date}]
 * @param {Array}  opts.permissions   [{date, hours}]
 * @param {number} opts.monthlyAllowanceHours
 * @param {number} opts.dailyWorkHours
 */
export function computeStats(opts) {
  const {
    year, todayISO, targetDays, holidays, leaves, permissions,
    monthlyAllowanceHours, dailyWorkHours,
  } = opts;

  const holidaySet = new Set(holidays);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Clamp "today" into the tracked year.
  let today = todayISO;
  if (toDate(today) < toDate(yearStart)) today = yearStart;
  if (toDate(today) > toDate(yearEnd)) today = yearEnd;

  const leaveDays = leaveWorkingDays(leaves, holidaySet);
  const perm = permissionDeduction(permissions, { monthlyAllowanceHours, dailyWorkHours });

  // Days actually worked so far: working days elapsed minus leaves taken
  // on those days, minus days lost to accumulated permissions.
  let elapsedWorking = 0;
  let elapsedLeave = 0;
  for (const iso of dateRange(yearStart, today)) {
    if (!isWorkingDay(iso, holidaySet)) continue;
    elapsedWorking++;
    if (leaveDays.has(iso)) elapsedLeave++;
  }
  const completedDays = Math.max(0, elapsedWorking - elapsedLeave - perm.deductedDays);

  // Future capacity: remaining working days after today, minus leaves
  // already scheduled in the future.
  let futureWorking = 0;
  let futureLeave = 0;
  if (toDate(today) < toDate(yearEnd)) {
    const tomorrow = toISO(new Date(toDate(today).getTime() + 86400000));
    for (const iso of dateRange(tomorrow, yearEnd)) {
      if (!isWorkingDay(iso, holidaySet)) continue;
      futureWorking++;
      if (leaveDays.has(iso)) futureLeave++;
    }
  }

  const remainingNeeded = Math.max(0, targetDays - completedDays);
  const maxAchievable = completedDays + futureWorking - futureLeave;
  const margin = maxAchievable - targetDays; // spare leave days before the bonus is lost

  let zone; // green: safe, yellow: careful, red: target unreachable
  if (margin < 0) zone = "red";
  else if (margin < 10) zone = "yellow";
  else zone = "green";

  const achieved = completedDays >= targetDays;

  return {
    completedDays,
    targetDays,
    remainingNeeded,
    futureWorking: futureWorking - futureLeave,
    maxAchievable,
    margin,
    zone: achieved ? "green" : zone,
    achieved,
    elapsedWorking,
    elapsedLeave,
    permissionExcessHours: perm.excessHours,
    permissionDeductedDays: perm.deductedDays,
  };
}
