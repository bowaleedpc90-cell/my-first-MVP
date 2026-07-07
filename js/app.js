import {
  computeStats, simulateLeave, workdaysBetween, calculateExcludedWorkdays,
  monthlyPermissionUsage, toISO, toDate, addDaysISO,
} from "./engine.js";

/* ============================================================ constants */

const STORAGE_KEY = "days180.v2";
const LEGACY_KEY = "days180.v1";

// العطل الرسمية في دولة الكويت لعام 2026 وفق إعلانات ديوان الخدمة المدنية
// (قائمة مؤكدة). السنوات الأخرى تُولَّد تلقائياً في kuwaitHolidays().
const DEFAULT_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "رأس السنة الميلادية" },
  { date: "2026-01-18", name: "الإسراء والمعراج" },
  { date: "2026-02-25", name: "العيد الوطني" },
  { date: "2026-02-26", name: "عيد التحرير" },
  { date: "2026-03-20", name: "عيد الفطر" },
  { date: "2026-03-21", name: "عيد الفطر - ثاني أيام العيد" },
  { date: "2026-03-22", name: "عيد الفطر - ثالث أيام العيد" },
  { date: "2026-05-26", name: "وقفة عرفات" },
  { date: "2026-05-27", name: "عيد الأضحى" },
  { date: "2026-05-28", name: "عيد الأضحى - ثاني أيام العيد" },
  { date: "2026-05-29", name: "عيد الأضحى - ثالث أيام العيد" },
  { date: "2026-06-17", name: "رأس السنة الهجرية" },
  { date: "2026-08-27", name: "المولد النبوي الشريف" },
];

const LEAVE_TYPES = {
  annual:    { label: "دورية",   emoji: "🌴" },
  sick:      { label: "مرضية",   emoji: "🤒" },
  emergency: { label: "طارئة",   emoji: "⚡" },
  unpaid:    { label: "بدون راتب", emoji: "📋" },
  absence:   { label: "غياب",    emoji: "🚫" },
  other:     { label: "أخرى",    emoji: "📝" },
};

const WEEKDAYS = [
  { key: "sunday", label: "الأحد" }, { key: "monday", label: "الاثنين" },
  { key: "tuesday", label: "الثلاثاء" }, { key: "wednesday", label: "الأربعاء" },
  { key: "thursday", label: "الخميس" }, { key: "friday", label: "الجمعة" },
  { key: "saturday", label: "السبت" },
];

/* ---------------- Kuwait holidays for any year (auto-generated) ----------- */

// Islamic holidays as (hijri month, hijri day, name) — converted to Gregorian
// dates per year via the Kuwaiti tabular algorithm (islamic-civil), the same
// arithmetic base as Kuwait's Al-Ojairi (العجيري) calendar. Validated against
// the officially announced Kuwait 2026 dates (best match of all Intl islamic
// calendar variants; Umm al-Qura is the Saudi reference and differs by a day
// on several of them). Marked تقديري because official observance still
// follows moon sighting and CSC announcements.
const HIJRI_HOLIDAYS = [
  [1, 1, "رأس السنة الهجرية"],
  [3, 12, "المولد النبوي الشريف"],
  [7, 27, "الإسراء والمعراج"],
  [10, 1, "عيد الفطر"], [10, 2, "عيد الفطر - ثاني أيام العيد"], [10, 3, "عيد الفطر - ثالث أيام العيد"],
  [12, 9, "وقفة عرفات"], [12, 10, "عيد الأضحى"], [12, 11, "عيد الأضحى - ثاني أيام العيد"], [12, 12, "عيد الأضحى - ثالث أيام العيد"],
];
const HIJRI_FMT = new Intl.DateTimeFormat("en-u-ca-islamic-civil", { day: "numeric", month: "numeric" });

function kuwaitHolidays(year) {
  if (year === 2026) return DEFAULT_HOLIDAYS_2026.map((h) => ({ ...h }));
  const out = [
    { date: `${year}-01-01`, name: "رأس السنة الميلادية" },
    { date: `${year}-02-25`, name: "العيد الوطني" },
    { date: `${year}-02-26`, name: "عيد التحرير" },
  ];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    const parts = HIJRI_FMT.formatToParts(d);
    const hm = Number(parts.find((p) => p.type === "month").value);
    const hd = Number(parts.find((p) => p.type === "day").value);
    for (const [m, dd, name] of HIJRI_HOLIDAYS) {
      if (m === hm && dd === hd) out.push({ date: toISO(d), name: `${name} (تقديري)` });
    }
    d.setDate(d.getDate() + 1);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

const WORKTYPE_TARGET = { admin_morning: 180, admin_evening: 180, teaching: 135 };

/* ============================================================ state */

function defaultState() {
  return {
    onboarded: false,
    introSeen: false,
    pin: null,
    profile: {
      full_name: "",
      work_type: "admin_morning",
      ministry_type: "general",
      target_days: 180,
      weekend_days: ["friday", "saturday"],
      daily_work_hours: 7,
      monthly_perm_hours: 12,
      monthly_perm_count: 4,
      year: new Date().getFullYear(),
    },
    leaves: [],
    permissions: [],
    holidays: kuwaitHolidays(new Date().getFullYear()),
  };
}

function migrateLegacy(old) {
  const s = defaultState();
  if (old.profile) {
    s.profile.full_name = old.profile.full_name || "";
    s.profile.target_days = old.profile.target_days || 180;
    s.profile.daily_work_hours = old.profile.daily_work_hours || 7;
    s.profile.year = old.profile.year || s.profile.year;
    s.profile.work_type = old.profile.ministry_type === "teaching" ? "teaching" : "admin_morning";
    s.profile.monthly_perm_hours = old.profile.monthly_allowance_hours || 12;
  }
  s.leaves = old.leaves || [];
  s.permissions = old.permissions || [];
  s.holidays = old.holidays || DEFAULT_HOLIDAYS_2026;
  s.onboarded = true; // legacy users already used it
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const d = defaultState();
      return { ...d, ...p, profile: { ...d.profile, ...(p.profile || {}) } };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy));
  } catch { /* fall through */ }
  return defaultState();
}

let storageBroken = false;
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // iOS Safari Private Mode or full storage: writes throw. Show a
    // persistent banner (not a toast) so the user is never misled into
    // thinking data is saved, and so we don't clobber a delete's undo toast.
    if (!storageBroken) {
      storageBroken = true;
      const el = document.getElementById("storage-warning");
      if (el) el.hidden = false;
    }
    return false;
  }
}

let state = loadState();

// تحديث تلقائي مع بداية كل سنة: يبدأ عدّاد السنة الجديدة وتُحمَّل عطلها
// الرسمية تلقائياً (السجلات القديمة تبقى محفوظة في السجل).
(function autoRollYear() {
  const nowYear = new Date().getFullYear();
  if (state.profile.year < nowYear) {
    state.profile.year = nowYear;
    state.holidays = kuwaitHolidays(nowYear);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* surfaced later by saveState */ }
  }
})();

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const todayISO = toISO(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const holidayDates = () => state.holidays.map((h) => h.date);

let calYear, calMonth; // calendar view state

/* ============================================================ helpers */

// Escape user-entered text before inserting into innerHTML templates.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Hoisted formatters — reused across the calendars' per-day labels instead of
// building a fresh locale formatter on every cell.
const FMT_DATE = new Intl.DateTimeFormat("ar-KW", { day: "numeric", month: "long" });
const FMT_DATE_FULL = new Intl.DateTimeFormat("ar-KW", { day: "numeric", month: "long", year: "numeric" });
function fmtDate(iso) { return FMT_DATE.format(toDate(iso)); }
function fmtDateFull(iso) { return FMT_DATE_FULL.format(toDate(iso)); }

function stats() {
  const p = state.profile;
  return computeStats({
    year: p.year,
    todayISO,
    targetDays: p.target_days,
    weekendDays: p.weekend_days,
    holidays: holidayDates(),
    leaves: state.leaves,
    permissions: state.permissions,
    monthlyPermHours: p.monthly_perm_hours,
    monthlyPermCount: p.monthly_perm_count,
    dailyWorkHours: p.daily_work_hours,
  });
}

/** How many workdays a single leave excludes (total, and how many are past). */
function leaveImpact(leave) {
  const set = calculateExcludedWorkdays([leave], state.profile.weekend_days, holidayDates());
  let past = 0;
  for (const iso of set) if (toDate(iso) <= toDate(todayISO)) past++;
  return { total: set.size, past };
}

/* ============================================================ toast */

let toastTimer = null;
function toast(msg, undoFn) {
  clearTimeout(toastTimer);
  $("#toast-msg").textContent = msg;
  const undoBtn = $("#toast-undo");
  undoBtn.hidden = !undoFn;
  undoBtn.onclick = () => { if (undoFn) undoFn(); $("#toast").hidden = true; };
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 5000);
}

/* ============================================================ sheets */

function openSheet(id) { $(id).classList.add("open"); }
function closeSheets() { $$(".sheet:not(.cover)").forEach((s) => s.classList.remove("open")); }
$$("[data-close]").forEach((b) => (b.onclick = closeSheets));
$$(".sheet").forEach((s) => s.addEventListener("click", (e) => { if (e.target === s && !s.classList.contains("cover")) closeSheets(); }));

function showInfo(title, html) {
  let sheet = $("#sheet-info");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.className = "sheet"; sheet.id = "sheet-info";
    sheet.innerHTML = `<div class="sheet-panel"><h3 id="info-title"></h3><div id="info-body"></div><button class="btn btn-ghost" type="button" data-close>إغلاق</button></div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheets(); });
    sheet.querySelector("[data-close]").onclick = closeSheets;
  }
  sheet.querySelector("#info-title").textContent = title;
  sheet.querySelector("#info-body").innerHTML = html;
  openSheet("#sheet-info");
}

/* ============================================================ navigation */

function switchView(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  $$(".tab").forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (view === "calendar") renderCalendar();
  if (view === "log") renderLog();
  if (view === "sim") resetSim();
}
$$(".tab").forEach((t) => (t.onclick = () => switchView(t.dataset.view)));

/* ============================================================ HOME render */

function render() {
  const s = stats();
  const p = state.profile;
  document.body.dataset.status = s.status;

  // ring
  const pct = Math.min(1, s.completedDays / s.targetDays);
  const ring = $("#ring-progress");
  const C = 2 * Math.PI * 84;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - pct);
  $("#ring-count").textContent = s.completedDays;
  $("#ring-target").textContent = `من ${s.targetDays} يوم`;
  $("#ring-pct").textContent = `${s.percent}% من الهدف`;

  // greeting
  $("#greeting").textContent = p.full_name ? `مرحباً، ${p.full_name} 👋` : "مرحباً بك 👋";
  $("#year-label").textContent = p.year;
  $("#worktype-label").textContent = worktypeLabel(p.work_type);

  // banner
  const titleEl = $("#zone-title"), hintEl = $("#zone-hint");
  if (s.achieved) {
    titleEl.textContent = "مبروك! حققت الهدف 🎉";
    hintEl.textContent = "أكملت أيام العمل المطلوبة لاستحقاق مكافأة الأعمال الممتازة.";
  } else if (s.status === "safe") {
    titleEl.textContent = "وضعك آمن ✅";
    hintEl.textContent = `لديك هامش أمان تقديري قدره ${s.safetyBuffer} يوم عمل قبل النزول تحت هدف ${s.targetDays}، حسب بياناتك الحالية.`;
  } else if (s.status === "warning") {
    titleEl.textContent = "انتبه ⚠️";
    hintEl.textContent = `هامش الأمان تقديرياً ${s.safetyBuffer} يوم عمل فقط — راجع إجازاتك القادمة.`;
  } else {
    titleEl.textContent = "خطر خسارة المكافأة 🔴";
    hintEl.textContent = s.reachable
      ? `هامش الأمان منخفض جداً (${s.safetyBuffer} يوم عمل). أي إجازة إضافية قد تؤثر على الهدف.`
      : "بالوتيرة الحالية قد لا تصل إلى الهدف — راجع إجازاتك القادمة.";
  }

  // stat cards
  $("#s-available").textContent = s.availableWorkDays;
  $("#s-remaining").textContent = s.remainingToTarget;
  $("#s-buffer").textContent = s.safetyBuffer;
  $("#s-perm").textContent = `${trim(s.permMonthHours)} / ${trim(s.monthlyPermHours)} ساعة`;
  $("#s-perm-count").textContent = `${s.permMonthCount} / ${s.monthlyPermCount} مرات`;

  renderAlerts(s);
}

function trim(n) { return Number.isInteger(n) ? n : Number(n.toFixed(1)); }

function worktypeLabel(w) {
  return ({ admin_morning: "إداري صباحي", admin_evening: "إداري مسائي", shifts: "نوبات", teaching: "تعليمي", custom: "مخصص" })[w] || "—";
}

function renderAlerts(s) {
  const box = $("#alerts");
  const items = [];
  if (!s.reachable) {
    items.push({ level: "danger", ico: "⛔", text: `تنبيه: وضعك الحالي قد لا يحقق هدف ${s.targetDays} يوم.` });
  } else if (s.safetyBuffer < s.thresholds.warning) {
    items.push({ level: "danger", ico: "🔴", text: "هامش الأمان منخفض. أي إجازة إضافية قد تؤثر على تحقيق الهدف." });
  } else if (s.safetyBuffer < s.thresholds.safe) {
    items.push({ level: "warning", ico: "⚠️", text: "اقتربت من المنطقة الصفراء. راجع إجازاتك القادمة." });
  }
  if (s.permMonthHours > s.monthlyPermHours || s.permMonthCount > s.monthlyPermCount) {
    items.push({ level: "warning", ico: "⏱️", text: "تم تجاوز حد الاستئذان الشهري. قد يتم احتساب جزء منه ضمن أيام الخصم." });
  }
  if (!s.achieved && s.remainingToTarget > 0) {
    items.push({ level: "info", ico: "🎯", text: `بقي لك ${s.remainingToTarget} يوم عمل للوصول إلى الهدف.` });
  }
  box.innerHTML = items.map((a) =>
    `<div class="alert ${a.level}"><span class="a-ico">${a.ico}</span><span>${a.text}</span></div>`).join("");
}

/* ============================================================ how calculated */

function openHow() {
  const s = stats();
  $("#how-equation").innerHTML =
    `${s.availableWorkDays} يوم عمل متاح − ${s.remainingToTarget} يوم مطلوب = <span style="font-size:18px">${s.safetyBuffer}</span> يوم هامش أمان`;
  openSheet("#sheet-how");
}
$("#btn-how").onclick = openHow;
$("#m-how").onclick = openHow;

/* ============================================================ quick add / leave sheet */

function fillLeaveTypeSelect(sel) {
  sel.innerHTML = Object.entries(LEAVE_TYPES)
    .map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join("");
}
fillLeaveTypeSelect($("#leave-type"));
fillLeaveTypeSelect($("#sim-type"));

function openLeaveSheet({ type = "annual", title = null, edit = null } = {}) {
  $("#leave-id").value = edit ? edit.id : "";
  $("#leave-type").value = edit ? edit.entry_type : type;
  $("#leave-start").value = edit ? edit.start_date : todayISO;
  $("#leave-end").value = edit ? (edit.end_date || edit.start_date) : todayISO;
  $("#leave-note").value = edit ? (edit.note || "") : "";
  $("#leave-sheet-title").textContent = title || (edit ? "تعديل السجل" : `إضافة إجازة`);
  updateLeavePreview();
  openSheet("#sheet-leave");
}

$$("[data-leave]").forEach((btn) => {
  btn.onclick = () => openLeaveSheet({ type: btn.dataset.leave, title: `إجازة ${LEAVE_TYPES[btn.dataset.leave].label}` });
});
$("#btn-custom").onclick = () => openLeaveSheet({ type: "other", title: "تسجيل مخصص" });

function updateLeavePreview() {
  const start = $("#leave-start").value;
  let end = $("#leave-end").value || start;
  if (!start) { $("#leave-preview").textContent = ""; return; }
  if (toDate(end) < toDate(start)) end = start;
  const days = workdaysBetween(start, end, state.profile.weekend_days, holidayDates());
  $("#leave-preview").textContent = `سيتم خصم ${days} يوم عمل من الرصيد.`;
}
$("#leave-start").oninput = updateLeavePreview;
$("#leave-end").oninput = updateLeavePreview;

$("#form-leave").onsubmit = (e) => {
  e.preventDefault();
  const start = $("#leave-start").value;
  let end = $("#leave-end").value || start;
  if (toDate(end) < toDate(start)) end = start;
  const id = $("#leave-id").value;
  const type = $("#leave-type").value;
  const note = $("#leave-note").value.trim();
  if (id) {
    const it = state.leaves.find((l) => l.id === id);
    if (it) Object.assign(it, { entry_type: type, start_date: start, end_date: end, note });
    saveState(); closeSheets(); render(); toast(`تم تعديل سجل ${LEAVE_TYPES[type].label}`);
  } else {
    const entry = { id: uid(), entry_type: type, start_date: start, end_date: end, note };
    state.leaves.push(entry);
    saveState(); closeSheets(); render();
    toast(`تم تسجيل ${LEAVE_TYPES[type].label} ${start === end ? "ليوم " + fmtDate(start) : "لفترة"}`,
      () => { state.leaves = state.leaves.filter((l) => l.id !== entry.id); saveState(); render(); renderLog(); });
  }
  renderLog();
};

/* ============================================================ permission sheet */

function openPermSheet(edit = null) {
  $("#perm-id").value = edit ? edit.id : "";
  $("#perm-date").value = edit ? edit.date : todayISO;
  $("#perm-hours").value = edit ? edit.hours : 1;
  updatePermPreview();
  openSheet("#sheet-perm");
}
$("#btn-perm").onclick = () => openPermSheet();

function updatePermPreview() {
  const p = state.profile;
  const ym = ($("#perm-date").value || todayISO).slice(0, 7);
  const use = monthlyPermissionUsage(state.permissions, ym);
  const newHours = use.hours + (Number($("#perm-hours").value) || 0);
  $("#perm-preview").textContent = `استئذان هذا الشهر بعد الحفظ: ${trim(newHours)} / ${trim(p.monthly_perm_hours)} ساعة · ${use.count + 1} / ${p.monthly_perm_count} مرات`;
}
$("#perm-date").oninput = updatePermPreview;
$("#perm-hours").oninput = updatePermPreview;

$("#form-perm").onsubmit = (e) => {
  e.preventDefault();
  const id = $("#perm-id").value;
  const date = $("#perm-date").value;
  const hours = Number($("#perm-hours").value);
  if (id) {
    const it = state.permissions.find((x) => x.id === id);
    if (it) Object.assign(it, { date, hours });
    saveState(); closeSheets(); render(); toast("تم تعديل الاستئذان");
  } else {
    const entry = { id: uid(), date, hours };
    state.permissions.push(entry);
    saveState(); closeSheets(); render();
    toast(`تم تسجيل استئذان ${trim(hours)} ساعة ليوم ${fmtDate(date)}`,
      () => { state.permissions = state.permissions.filter((x) => x.id !== entry.id); saveState(); render(); renderLog(); });
  }
  renderLog();
};

/* ============================================================ LOG */

function renderLog() {
  const list = $("#log-list");
  const items = [
    ...state.leaves.map((l) => ({ ...l, kind: "leave", sort: l.start_date })),
    ...state.permissions.map((pm) => ({ ...pm, kind: "perm", sort: pm.date })),
  ].sort((a, b) => b.sort.localeCompare(a.sort));

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="e-ico">🗒️</div>
        <h3>لا توجد سجلات بعد</h3>
        <p>سجّل أول إجازة أو استئذان لبدء المتابعة.</p>
        <button class="btn btn-primary" id="empty-add" style="max-width:220px;margin:0 auto">+ أضف أول سجل</button>
      </div>`;
    $("#empty-add").onclick = () => openLeaveSheet({ type: "annual", title: "إضافة إجازة" });
    return;
  }

  list.innerHTML = "";
  for (const item of items) {
    const el = document.createElement("div");
    el.className = "log-item";
    if (item.kind === "leave") {
      const t = LEAVE_TYPES[item.entry_type] || { label: item.entry_type, emoji: "📅" };
      const imp = leaveImpact(item);
      const range = item.start_date === (item.end_date || item.start_date)
        ? fmtDateFull(item.start_date)
        : `${fmtDate(item.start_date)} ← ${fmtDate(item.end_date)}`;
      const impactLine = imp.past > 0 ? `<span class="impact">الأثر: خصم ${imp.past} من الأيام المنجزة</span>` : "";
      el.innerHTML = `
        <span class="log-emoji">${t.emoji}</span>
        <span class="log-body">
          <strong>${esc(t.label)}${item.note ? " · " + esc(item.note) : ""}</strong>
          <small>${range} · خصم ${imp.total} يوم عمل</small>
          ${impactLine}
        </span>`;
    } else {
      el.innerHTML = `
        <span class="log-emoji">⏱️</span>
        <span class="log-body">
          <strong>استئذان ${trim(item.hours)} ساعة</strong>
          <small>${fmtDateFull(item.date)}</small>
        </span>`;
    }
    const actions = document.createElement("span");
    actions.className = "log-actions";
    const editBtn = document.createElement("button"); editBtn.textContent = "✏️"; editBtn.setAttribute("aria-label", "تعديل");
    const delBtn = document.createElement("button"); delBtn.textContent = "🗑️"; delBtn.setAttribute("aria-label", "حذف");
    editBtn.onclick = () => item.kind === "leave" ? openLeaveSheet({ edit: item }) : openPermSheet(item);
    delBtn.onclick = () => deleteEntry(item);
    actions.append(editBtn, delBtn);
    el.appendChild(actions);
    list.appendChild(el);
  }
}

function deleteEntry(item) {
  if (!confirm("هل تريد حذف هذا السجل؟")) return;
  if (item.kind === "leave") {
    state.leaves = state.leaves.filter((l) => l.id !== item.id);
    saveState(); render(); renderLog();
    toast("تم حذف السجل", () => { state.leaves.push(item); saveState(); render(); renderLog(); });
  } else {
    state.permissions = state.permissions.filter((x) => x.id !== item.id);
    saveState(); render(); renderLog();
    toast("تم حذف الاستئذان", () => { state.permissions.push(item); saveState(); render(); renderLog(); });
  }
}

/* ============================================================ CALENDAR */

function renderCalendar() {
  if (calYear == null) { calYear = toDate(todayISO).getFullYear(); calMonth = toDate(todayISO).getMonth(); }
  const p = state.profile;
  const ws = new Set(p.weekend_days);
  const holidayMap = new Map(state.holidays.map((h) => [h.date, h.name]));
  const leaveSet = calculateExcludedWorkdays(state.leaves, p.weekend_days, holidayDates());
  const permDates = new Set(state.permissions.map((x) => x.date));

  $("#cal-title").textContent = new Date(calYear, calMonth, 1)
    .toLocaleDateString("ar-KW", { month: "long", year: "numeric" });

  const first = new Date(calYear, calMonth, 1);
  const startDow = first.getDay(); // 0 Sun ... 6 Sat
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const grid = $("#cal-grid");
  grid.innerHTML = "";
  for (let i = 0; i < startDow; i++) {
    const c = document.createElement("div"); c.className = "cal-cell empty"; grid.appendChild(c);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(calYear, calMonth, d).getDay();
    const isWknd = WEEKDAYS[dow] && wsHas(ws, dow);
    const isHol = holidayMap.has(iso);
    const isLeave = leaveSet.has(iso);
    const isPerm = permDates.has(iso);

    const cls = classifyDay({ isWknd, isHol, isLeave, isPerm });

    const cell = document.createElement("button");
    cell.className = `cal-cell ${cls}${iso === todayISO ? " today" : ""}`;
    cell.innerHTML = `${d}${isPerm && isLeave ? '<i class="cdot" style="background:var(--yellow)"></i>' : ""}`;
    const dayKind = isLeave ? "إجازة" : isHol ? "عطلة رسمية" : isWknd ? "راحة" : "يوم عمل";
    cell.setAttribute("aria-label", `${fmtDateFull(iso)} — ${dayKind}${isPerm ? "، استئذان" : ""}`);
    cell.onclick = () => showDayDetail(iso, { isWknd, isHol, isLeave, isPerm, holName: holidayMap.get(iso) });
    grid.appendChild(cell);
  }
}
function wsHas(wsSet, dow) {
  const name = WEEKDAYS[dow].key; return wsSet.has(name);
}
// Single source of truth for day coloring — used by the on-screen calendar
// and the printable year calendar so they never disagree. Precedence:
// leave > holiday > weekend rest > workday; a permission overrides everything
// except a leave.
function classifyDay({ isWknd, isHol, isLeave, isPerm }) {
  let cls = "work";
  if (isLeave) cls = "leave";
  else if (isHol) cls = "holiday";
  else if (isWknd) cls = "rest";
  if (isPerm && !isLeave) cls = "perm";
  return cls;
}
$("#cal-prev").onclick = () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); };
$("#cal-next").onclick = () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); };

function showDayDetail(iso, info) {
  const counted = !info.isWknd && !info.isHol && !info.isLeave;
  const rows = [];
  rows.push(`<div class="rrow"><b>التاريخ</b><span>${fmtDateFull(iso)}</span></div>`);
  rows.push(`<div class="rrow"><b>يوم عمل؟</b><span>${(!info.isWknd && !info.isHol) ? "نعم" : "لا"}</span></div>`);
  rows.push(`<div class="rrow"><b>يدخل في الحسبة؟</b><span>${counted ? "نعم ✅" : "لا ❌"}</span></div>`);
  if (info.isWknd) rows.push(`<div class="rrow"><b>السبب</b><span>راحة أسبوعية</span></div>`);
  if (info.isHol) rows.push(`<div class="rrow"><b>عطلة رسمية</b><span>${esc(info.holName || "—")}</span></div>`);
  if (info.isLeave) rows.push(`<div class="rrow"><b>إجازة مسجلة</b><span>نعم — مستبعد من الحسبة</span></div>`);
  if (info.isPerm) rows.push(`<div class="rrow"><b>استئذان</b><span>يوجد استئذان مسجل</span></div>`);
  showInfo("تفاصيل اليوم", `<div class="report">${rows.join("")}</div>`);
}

/* ============================================================ SIMULATOR */

function resetSim() {
  $("#sim-type").value = "annual";
  $("#sim-start").value = todayISO;
  $("#sim-end").value = addDaysISO(todayISO, 6);
  $("#sim-result").hidden = true;
}
$("#sim-run").onclick = () => {
  const p = state.profile;
  const start = $("#sim-start").value;
  let end = $("#sim-end").value || start;
  if (!start) return;
  if (toDate(end) < toDate(start)) end = start;
  const leave = { entry_type: $("#sim-type").value, start_date: start, end_date: end };
  const base = {
    year: p.year, todayISO, targetDays: p.target_days, weekendDays: p.weekend_days,
    holidays: holidayDates(), leaves: state.leaves, permissions: state.permissions,
    monthlyPermHours: p.monthly_perm_hours, monthlyPermCount: p.monthly_perm_count,
    dailyWorkHours: p.daily_work_hours,
  };
  const sim = simulateLeave(base, leave);
  const statusWord = { safe: "آمن ✅", warning: "انتبه ⚠️", danger: "خطر 🔴" }[sim.statusAfter];
  const box = $("#sim-result");
  box.className = `sim-box ${sim.statusAfter}`;
  box.hidden = false;
  box.innerHTML = `
    <p class="big">إذا أخذت هذه الإجازة، سيتم خصم ${sim.workdaysDeducted} أيام عمل.</p>
    <p>هامش الأمان قبل الإجازة: <b>${sim.bufferBefore}</b> يوم عمل.</p>
    <p>هامش الأمان بعد الإجازة: <b>${sim.bufferAfter}</b> يوم عمل.</p>
    <p>الحالة الجديدة: <b>${statusWord}</b>${sim.reachableAfter ? "" : " — قد لا تحقق الهدف"}.</p>
    <button class="btn btn-primary" id="sim-commit">اعتماد وتسجيل هذه الإجازة</button>`;
  $("#sim-commit").onclick = () => {
    const entry = { id: uid(), ...leave };
    state.leaves.push(entry);
    saveState(); render(); renderLog();
    toast("تم تسجيل الإجازة من المحاكي",
      () => { state.leaves = state.leaves.filter((l) => l.id !== entry.id); saveState(); render(); renderLog(); });
    switchView("home");
  };
};

/* ============================================================ REPORT */

function buildReport() {
  const s = stats(); const p = state.profile;
  const rows = [
    ["الاسم", p.full_name || "—"],
    ["السنة", p.year],
    ["نوع الدوام", worktypeLabel(p.work_type)],
    ["الهدف السنوي", `${p.target_days} يوم`],
    ["الأيام المنجزة", `${s.completedDays} يوم (${s.percent}%)`],
    ["المطلوب للهدف", `${s.remainingToTarget} يوم`],
    ["رصيد الأمان", `${s.safetyBuffer} يوم عمل`],
    ["مجموع أيام الإجازات", `${s.totalLeaveWorkdays} يوم عمل`],
    ["عدد الاستئذانات", `${state.permissions.length} استئذان`],
    ["الحالة", { safe: "آمن", warning: "انتبه", danger: "خطر" }[s.status]],
    ["تاريخ التقرير", fmtDateFull(todayISO)],
  ];
  return { s, p, rows };
}
function openReport() {
  const { rows } = buildReport();
  $("#report-body").innerHTML =
    `<h4>تقرير متابعة الأعمال الممتازة</h4>` +
    rows.map(([k, v]) => `<div class="rrow"><b>${k}</b><span>${esc(v)}</span></div>`).join("");
  openSheet("#sheet-report");
}
$("#m-report").onclick = openReport;
$("#rep-print").onclick = () => window.print();
$("#rep-share").onclick = async () => {
  const { rows } = buildReport();
  const text = "📊 تقرير متابعة «١٨٠ يوم»\n" +
    rows.map(([k, v]) => `• ${k}: ${v}`).join("\n") +
    "\n\nتقرير إرشادي وليس مستنداً رسمياً.\nتطوير X Star Software — xstarkw.com";
  try {
    if (navigator.share) await navigator.share({ title: "تقرير ١٨٠ يوم", text });
    else { await navigator.clipboard.writeText(text); toast("تم نسخ الملخص النصي 📋"); }
  } catch { /* user cancelled */ }
};

/* ============================================================ PRIVACY / LOCK */

$("#m-privacy").onclick = () => { $("#pin-input").value = state.pin || ""; openSheet("#sheet-privacy"); };
$("#pin-save").onclick = () => {
  const v = $("#pin-input").value.trim();
  state.pin = v ? v : null;
  saveState(); closeSheets();
  toast(v ? "تم تفعيل قفل التطبيق 🔒" : "تم إلغاء القفل");
};
$("#btn-reset").onclick = () => {
  if (!confirm("سيتم حذف جميع البيانات على هذا الجهاز نهائياً. متأكد؟")) return;
  localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY);
  state = defaultState(); saveState(); closeSheets();
  calYear = null; render(); renderLog(); startIntroThenOnboarding();
};

function applyLock() {
  if (!state.pin) { $("#lock-screen").hidden = true; return; }
  $("#lock-screen").hidden = false;
  $("#lock-input").value = ""; $("#lock-error").hidden = true;
  $("#lock-input").focus();
}
$("#lock-unlock").onclick = tryUnlock;
$("#lock-input").addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
function tryUnlock() {
  if ($("#lock-input").value === state.pin) $("#lock-screen").hidden = true;
  else { $("#lock-error").hidden = false; $("#lock-input").value = ""; }
}

/* ============================================================ HOLIDAYS */

$("#m-holidays").onclick = () => { renderHolidays(); openSheet("#sheet-holidays"); };
function renderHolidays() {
  const list = $("#holiday-list");
  list.innerHTML = "";
  for (const h of [...state.holidays].sort((a, b) => a.date.localeCompare(b.date))) {
    const el = document.createElement("div");
    el.className = "log-item";
    el.innerHTML = `<span class="log-emoji">🗓️</span><span class="log-body"><strong>${esc(h.name)}</strong><small>${fmtDateFull(h.date)}</small></span>`;
    const del = document.createElement("button");
    del.className = "log-actions"; del.style.border = "none"; del.style.background = "var(--bg)";
    del.style.width = "34px"; del.style.height = "34px"; del.style.borderRadius = "9px"; del.style.cursor = "pointer";
    del.textContent = "✕";
    del.onclick = () => { state.holidays = state.holidays.filter((x) => !(x.date === h.date && x.name === h.name)); saveState(); renderHolidays(); render(); if (!$("#view-calendar").hidden) renderCalendar(); };
    el.appendChild(del);
    list.appendChild(el);
  }
}
$("#form-holiday").onsubmit = (e) => {
  e.preventDefault();
  const date = $("#holiday-date").value;
  const name = $("#holiday-name").value.trim() || "عطلة رسمية";
  if (!date) return;
  if (state.holidays.some((h) => h.date === date)) {
    toast("يوجد عطلة مسجلة بهذا التاريخ مسبقاً");
    return;
  }
  state.holidays.push({ date, name });
  saveState(); $("#holiday-date").value = ""; $("#holiday-name").value = "";
  renderHolidays(); render();
};

/* ============================================================ SETTINGS + weekend chips */

function renderWeekendChips(containerId, selected) {
  const box = $(containerId);
  box.innerHTML = "";
  WEEKDAYS.forEach((d) => {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "chip" + (selected.includes(d.key) ? " on" : "");
    chip.textContent = d.label; chip.dataset.key = d.key;
    chip.onclick = () => { chip.classList.toggle("on"); };
    box.appendChild(chip);
  });
}
function readWeekendChips(containerId) {
  return [...$(containerId).querySelectorAll(".chip.on")].map((c) => c.dataset.key);
}

$("#btn-settings").onclick = openSettings;
$("#m-settings").onclick = openSettings;
function openSettings() {
  const p = state.profile;
  $("#set-name").value = p.full_name;
  $("#set-worktype").value = p.work_type;
  $("#set-ministry").value = p.ministry_type;
  $("#set-target").value = p.target_days;
  $("#set-year").value = p.year;
  $("#set-hours").value = p.daily_work_hours;
  $("#set-perm-hours").value = p.monthly_perm_hours;
  $("#set-perm-count").value = p.monthly_perm_count;
  renderWeekendChips("#set-weekend", p.weekend_days);
  openSheet("#sheet-settings");
}
$("#set-worktype").onchange = () => {
  const t = WORKTYPE_TARGET[$("#set-worktype").value];
  if (t) $("#set-target").value = t;
};
$("#form-settings").onsubmit = (e) => {
  e.preventDefault();
  const wk = readWeekendChips("#set-weekend");
  const prevYear = state.profile.year;
  Object.assign(state.profile, {
    full_name: $("#set-name").value.trim(),
    work_type: $("#set-worktype").value,
    ministry_type: $("#set-ministry").value,
    target_days: Number($("#set-target").value) || 180,
    year: Number($("#set-year").value) || state.profile.year,
    weekend_days: wk.length ? wk : ["friday", "saturday"],
    daily_work_hours: Number($("#set-hours").value) || 7,
    monthly_perm_hours: Number($("#set-perm-hours").value) || 0,
    monthly_perm_count: Number($("#set-perm-count").value) || 0,
  });
  if (state.profile.year !== prevYear) {
    state.holidays = kuwaitHolidays(state.profile.year);
    toast(`تم تحديث العطل الرسمية لسنة ${state.profile.year} — التقديرية قابلة للتعديل`);
  } else {
    toast("تم حفظ الإعدادات ✅");
  }
  saveState(); closeSheets(); calYear = null; render(); renderLog();
};

/* ============================================================ ONBOARDING */

// Onboarding is two steps: (1) name + this year's past leaves, with the
// live counter; (2) add-to-home-screen. The target (180) and weekend
// (Fri/Sat) are fixed defaults — changeable later from settings, so no
// profile step is shown.
function startOnboardingIfNeeded() {
  if (state.onboarded) { $("#sheet-onboarding").classList.remove("open"); return; }
  $("#onb-name").value = state.profile.full_name;
  fillLeaveTypeSelect($("#onb-leave-type"));
  rangeCal.init("#onb-rcal", { year: state.profile.year, onChange: onbRangeChanged });
  setRcalOpen(false);
  onbShowStep(1);
  onbRangeChanged();
  $("#sheet-onboarding").classList.add("open");
}

const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isAndroid = /Android/i.test(navigator.userAgent);

function onbShowStep(n) {
  $("#onb-s2").hidden = n !== 1;
  $("#onb-s3").hidden = n !== 2;
  $("#onb-dot1").classList.toggle("on", n === 1);
  $("#onb-dot2").classList.toggle("on", n === 2);
  if (n === 1) {
    $("#onb-title").textContent = "مرحباً بك في «١٨٠ يوم»";
    $("#onb-sub").textContent = "أدخل اسمك وإجازاتك السابقة ليكون عدّادك دقيقاً من البداية.";
    onbRefreshStep2();
  } else {
    $("#onb-title").textContent = "أضِف التطبيق لجوالك";
    $("#onb-sub").textContent = "خطوة أخيرة (اختيارية) للوصول السريع.";
  }
}

// segment toggle (iOS / Android)
function setInstallOS(os) {
  $("#install-ios").hidden = os !== "ios";
  $("#install-android").hidden = os !== "android";
  document.querySelectorAll("#install-seg .seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.os === os));
}
document.querySelectorAll("#install-seg .seg-btn").forEach((b) => (b.onclick = () => setInstallOS(b.dataset.os)));

// The name field lives in step 1; Enter must not reload the page.
$("#form-onboarding").onsubmit = (e) => e.preventDefault();

function onbSaveName() {
  state.profile.full_name = $("#onb-name").value.trim();
  saveState();
  render();
}

/* ---- Booking-style range calendar (from–to in one scrollable calendar) ---- */
const RCAL_WEEK = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
const rangeCal = {
  container: null, year: null, lastMonth: 11, start: null, end: null, onChange: null,
  init(sel, { year, onChange }) {
    this.container = $(sel); this.year = year; this.onChange = onChange;
    this.start = null; this.end = null;
    const now = toDate(todayISO);
    this.lastMonth = (year === now.getFullYear()) ? now.getMonth() : 11;
    this.render();
  },
  // Scroll to the latest month (which is the current month — months run
  // Jan..current). Scrolling to the bottom is offset-parent-independent and
  // must run while the container is visible (called from setRcalOpen(true)).
  scrollToCurrent() {
    const c = this.container; if (!c) return;
    c.scrollTop = c.scrollHeight;
  },
  pick(iso) {
    if (this.start && !this.end) {
      if (toDate(iso) < toDate(this.start)) this.start = iso;
      else this.end = iso;
    } else {
      this.start = iso; this.end = null;
    }
    this.render();
    if (this.onChange) this.onChange();
  },
  clear() { this.start = null; this.end = null; this.render(); if (this.onChange) this.onChange(); },
  getRange() { return { start: this.start, end: this.end || this.start }; },
  render() {
    const c = this.container; if (!c) return;
    c.innerHTML = "";
    for (let m = 0; m <= this.lastMonth; m++) {
      const mDiv = document.createElement("div"); mDiv.className = "rcal-month";
      const head = document.createElement("div"); head.className = "rcal-mhead";
      head.textContent = new Date(this.year, m, 1).toLocaleDateString("ar-KW", { month: "long", year: "numeric" });
      mDiv.appendChild(head);
      const wk = document.createElement("div"); wk.className = "rcal-week";
      RCAL_WEEK.forEach((w) => { const s = document.createElement("span"); s.textContent = w; wk.appendChild(s); });
      mDiv.appendChild(wk);
      const grid = document.createElement("div"); grid.className = "rcal-grid";
      const startDow = new Date(this.year, m, 1).getDay();
      const dim = new Date(this.year, m + 1, 0).getDate();
      for (let i = 0; i < startDow; i++) { const e = document.createElement("div"); e.className = "rcal-day empty"; grid.appendChild(e); }
      for (let d = 1; d <= dim; d++) {
        const iso = `${this.year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "rcal-day"; btn.textContent = d;
        const future = toDate(iso) > toDate(todayISO);
        if (future) { btn.classList.add("disabled"); btn.disabled = true; }
        if (iso === todayISO) btn.classList.add("today");
        btn.setAttribute("aria-label", fmtDateFull(iso));
        const s = this.start, e = this.end;
        const selected = iso === s || (!!e && iso === e);
        if (s && e) {
          if (selected) btn.classList.add(iso === s ? "start" : "end");
          else if (toDate(iso) > toDate(s) && toDate(iso) < toDate(e)) btn.classList.add("inrange");
        } else if (selected) btn.classList.add("start");
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        if (!future) btn.onclick = () => this.pick(iso);
        grid.appendChild(btn);
      }
      mDiv.appendChild(grid);
      c.appendChild(mDiv);
    }
  },
};

// Collapsible calendar: closed by default, opens on tap for a tidy sheet.
function setRcalOpen(open) {
  $("#onb-rcal").hidden = !open;
  // Summary shows only while the calendar is open (the collapsed toggle
  // already displays the selected range, so it isn't repeated below).
  $("#onb-rcal-summary").hidden = !open;
  $("#onb-rcal-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  if (open) requestAnimationFrame(() => rangeCal.scrollToCurrent());
}
$("#onb-rcal-toggle").onclick = () => setRcalOpen($("#onb-rcal").hidden);

function onbRangeChanged() {
  const { start, end } = rangeCal.getRange();
  if (!start) {
    $("#onb-rcal-label").textContent = "اضغط لاختيار الفترة";
    $("#onb-rcal-summary").textContent = "اختر يوم البداية ثم يوم النهاية (أو يوماً واحداً ثم «أضف»).";
    $("#onb-leave-preview").textContent = "";
    return;
  }
  const days = workdaysBetween(start, end, state.profile.weekend_days, holidayDates());
  const range = start === end ? fmtDateFull(start) : `${fmtDate(start)} ← ${fmtDate(end)}`;
  $("#onb-rcal-label").textContent = range;
  $("#onb-rcal-summary").textContent = `الفترة المختارة: ${range}`;
  $("#onb-leave-preview").textContent = `سيتم خصم ${days} يوم عمل.`;
}

$("#onb-leave-add").onclick = () => {
  const { start, end } = rangeCal.getRange();
  if (!start) { setRcalOpen(true); return; }
  state.leaves.push({ id: uid(), entry_type: $("#onb-leave-type").value, start_date: start, end_date: end, note: "" });
  saveState();
  rangeCal.clear();
  setRcalOpen(false);
  onbRefreshStep2();
  render();
};

function onbRefreshStep2() {
  // live completed-days counter
  const s = stats();
  $("#onb-count").innerHTML = `<small>أيام عملك المنجزة حتى اليوم</small><b>${s.completedDays}</b><small>من ${s.targetDays} يوم</small>`;
  $("#onb-print").hidden = state.leaves.length === 0;
  // list of entered leaves
  const list = $("#onb-leave-list");
  const items = state.leaves.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
  if (!items.length) { list.innerHTML = ""; return; }
  list.innerHTML = "";
  for (const it of items) {
    const t = LEAVE_TYPES[it.entry_type] || { label: it.entry_type, emoji: "📅" };
    const days = workdaysBetween(it.start_date, it.end_date || it.start_date, state.profile.weekend_days, holidayDates());
    const range = it.start_date === (it.end_date || it.start_date) ? fmtDate(it.start_date) : `${fmtDate(it.start_date)} ← ${fmtDate(it.end_date)}`;
    const el = document.createElement("div");
    el.className = "log-item";
    el.innerHTML = `<span class="log-emoji">${t.emoji}</span><span class="log-body"><strong>${esc(t.label)}</strong><small>${range} · خصم ${days} يوم</small></span>`;
    const del = document.createElement("button");
    del.className = "log-actions"; del.style.cssText = "border:none;background:var(--bg);width:34px;height:34px;border-radius:9px;cursor:pointer";
    del.textContent = "✕";
    del.onclick = () => { state.leaves = state.leaves.filter((l) => l.id !== it.id); saveState(); onbRefreshStep2(); render(); };
    el.appendChild(del);
    list.appendChild(el);
  }
}

// Step 2 -> step 3 (install), or finish directly if already installed
$("#onb-next2").onclick = () => {
  onbSaveName();
  if (isStandalone) { finishOnboarding(); return; }
  setInstallOS(isAndroid ? "android" : "ios");
  onbShowStep(2);
};
$("#onb-back2").onclick = () => onbShowStep(1);
$("#onb-done").onclick = finishOnboarding;

function finishOnboarding() {
  onbSaveName();
  state.onboarded = true;
  saveState();
  $("#sheet-onboarding").classList.remove("open");
  calYear = null; render(); renderLog();
  toast("تم الإعداد — عدّادك جاهز ✨");
}

/* ============================================================ intro splash */

function startIntroThenOnboarding() {
  if (!state.introSeen) $("#intro-screen").hidden = false;
  else startOnboardingIfNeeded();
}
$("#intro-start").onclick = () => {
  state.introSeen = true; saveState();
  $("#intro-screen").hidden = true;
  startOnboardingIfNeeded();
};

/* ============================================================ printable calendar */

const PCAL_WD = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // أحد..سبت (compact)

// monthIdx: null = full year, 0-11 = a single month (larger grid + a detail
// list of that month's holidays, leaves, and permissions).
function printCalendar(monthIdx = null) {
  const p = state.profile;
  const hols = holidayDates();
  const s = stats();
  const ws = new Set(p.weekend_days);
  const holidaySet = new Set(hols);
  const leaveSet = calculateExcludedWorkdays(state.leaves, p.weekend_days, hols);
  const permDates = new Set(state.permissions.map((x) => x.date));
  const single = monthIdx !== null;
  const monthList = single ? [monthIdx] : Array.from({ length: 12 }, (_, i) => i);

  let months = "";
  for (const m of monthList) {
    const name = new Date(p.year, m, 1).toLocaleDateString("ar-KW", { month: "long" });
    let cells = PCAL_WD.map((w) => `<span class="wd">${w}</span>`).join("");
    const startDow = new Date(p.year, m, 1).getDay();
    for (let i = 0; i < startDow; i++) cells += "<span></span>";
    const dim = new Date(p.year, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const iso = `${p.year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(p.year, m, d).getDay();
      // Same precedence as the on-screen calendar (classifyDay) so the
      // printed sheet never disagrees with the app; "work" prints plain.
      let cls = classifyDay({ isWknd: ws.has(WEEKDAYS[dow].key), isHol: holidaySet.has(iso), isLeave: leaveSet.has(iso), isPerm: permDates.has(iso) });
      if (cls === "work") cls = "";
      cells += `<span class="${cls}">${d}</span>`;
    }
    months += `<div class="pcal-month"><div class="pcal-mname">${name}</div><div class="pcal-grid">${cells}</div></div>`;
  }

  // Single-month extras: a dated list of that month's holidays/leaves/permissions.
  let details = "";
  if (single) {
    const ym = `${p.year}-${String(monthIdx + 1).padStart(2, "0")}`;
    const rows = [];
    for (const h of state.holidays) if (h.date.startsWith(ym)) rows.push([h.date, `🗓️ ${esc(h.name)}`]);
    for (const l of state.leaves) {
      const end = l.end_date || l.start_date;
      if (l.start_date.slice(0, 7) <= ym && end.slice(0, 7) >= ym) {
        const t = LEAVE_TYPES[l.entry_type] || { label: l.entry_type };
        const range = l.start_date === end ? fmtDate(l.start_date) : `${fmtDate(l.start_date)} ← ${fmtDate(end)}`;
        rows.push([l.start_date, `${esc(t.label)} · ${range}`]);
      }
    }
    for (const pm of state.permissions) if (pm.date.startsWith(ym)) rows.push([pm.date, `⏱️ استئذان ${pm.hours} ساعة · ${fmtDate(pm.date)}`]);
    rows.sort((a, b) => a[0].localeCompare(b[0]));
    if (rows.length) {
      details = `<div class="pcal-details"><h2>تفاصيل الشهر</h2>${rows.map(([, txt]) => `<div>${txt}</div>`).join("")}</div>`;
    }
  }
  const title = single
    ? `رزنامة ${new Date(p.year, monthIdx, 1).toLocaleDateString("ar-KW", { month: "long" })} ${p.year}`
    : `رزنامة «١٨٠ يوم» — ${p.year}`;

  $("#print-area").innerHTML = `
    <div class="pcal">
      <div class="pcal-head">
        <div class="t">
          <h1>${title}</h1>
          <p>${esc(p.full_name || "")}${p.full_name ? " · " : ""}${worktypeLabel(p.work_type)} · الهدف: ${p.target_days} يوم عمل</p>
        </div>
        <img class="appicon" src="assets/brand/app-180-192.png" alt="" />
      </div>
      <div class="pcal-summary">
        <div><b>${s.completedDays}</b><small>يوم منجز</small></div>
        <div><b>${s.remainingToTarget}</b><small>متبقٍ للهدف</small></div>
        <div><b>${s.safetyBuffer}</b><small>رصيد الأمان</small></div>
        <div><b>${s.totalLeaveWorkdays}</b><small>أيام الإجازات</small></div>
      </div>
      <div class="pcal-legend">
        <span><i style="background:#fee2e2"></i>إجازة/غياب</span>
        <span><i style="background:#dbeafe"></i>عطلة رسمية</span>
        <span><i style="background:#eef1f6"></i>راحة أسبوعية</span>
        <span><i style="background:#fef3c7"></i>استئذان</span>
      </div>
      <div class="pcal-months${single ? " single" : ""}">${months}</div>
      ${details}
      <div class="pcal-foot">
        <div class="d">
          رزنامة إرشادية وليست مستنداً رسمياً — طُبعت في ${fmtDateFull(todayISO)}.<br>
          تطوير X Star Software · xstarkw.com
        </div>
        <img src="assets/brand/logo-horizontal.png" alt="X Star Software" />
      </div>
    </div>`;

  document.body.classList.add("print-cal");
  const mql = window.matchMedia("print");
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.body.classList.remove("print-cal");
    $("#print-area").innerHTML = ""; // drop the ~550-node year grid after printing
    window.removeEventListener("afterprint", cleanup);
    if (mql.removeEventListener) mql.removeEventListener("change", onMedia);
  };
  // Clean up only when the print media session actually ends (leaving print
  // mode), not on a fixed timer that could strip the layout mid-preview on iOS.
  const onMedia = (e) => { if (!e.matches) cleanup(); };
  window.addEventListener("afterprint", cleanup);
  if (mql.addEventListener) mql.addEventListener("change", onMedia);
  window.print();
}

// Print options: full year or a specific month.
function openPrintSheet(defaultMonth) {
  const sel = $("#print-month-sel");
  sel.innerHTML = Array.from({ length: 12 }, (_, m) =>
    `<option value="${m}">${new Date(state.profile.year, m, 1).toLocaleDateString("ar-KW", { month: "long" })} ${state.profile.year}</option>`
  ).join("");
  sel.value = String(defaultMonth);
  openSheet("#sheet-print");
}
$("#onb-print").onclick = () => openPrintSheet(toDate(todayISO).getMonth());
$("#cal-print").onclick = () => openPrintSheet(calMonth ?? toDate(todayISO).getMonth());
$("#print-year-btn").onclick = () => { closeSheets(); printCalendar(null); };
$("#print-month-btn").onclick = () => { const m = Number($("#print-month-sel").value); closeSheets(); printCalendar(m); };

/* ============================================================ boot */

applyLock();
render();
renderLog();
startIntroThenOnboarding();

// Offline support for the installed app.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* offline mode unavailable */ });
}
