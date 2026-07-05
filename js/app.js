import { computeStats, toISO, countWorkingDays, isWorkingDay, toDate } from "./engine.js";

/* ---------------------------------------------------------------- state */

const STORAGE_KEY = "days180.v1";

// Official Kuwait holidays for 2026. Islamic dates are astronomical
// estimates — editable from the settings screen once confirmed.
const DEFAULT_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "رأس السنة الميلادية" },
  { date: "2026-01-16", name: "الإسراء والمعراج (تقديري)" },
  { date: "2026-02-25", name: "العيد الوطني" },
  { date: "2026-02-26", name: "عيد التحرير" },
  { date: "2026-03-20", name: "عيد الفطر (تقديري)" },
  { date: "2026-03-22", name: "عيد الفطر - ثالث أيام (تقديري)" },
  { date: "2026-03-23", name: "عيد الفطر - إجازة (تقديري)" },
  { date: "2026-05-26", name: "وقفة عرفات (تقديري)" },
  { date: "2026-05-27", name: "عيد الأضحى (تقديري)" },
  { date: "2026-05-28", name: "عيد الأضحى - ثاني أيام (تقديري)" },
  { date: "2026-06-16", name: "رأس السنة الهجرية (تقديري)" },
  { date: "2026-08-25", name: "المولد النبوي (تقديري)" },
];

const LEAVE_TYPES = {
  annual:    { label: "دورية",  emoji: "🌴" },
  sick:      { label: "مرضية",  emoji: "🤒" },
  emergency: { label: "طارئة",  emoji: "⚡" },
  unpaid:    { label: "بدون راتب", emoji: "📋" },
};

function defaultState() {
  return {
    profile: {
      full_name: "",
      ministry_type: "admin", // admin | teaching
      target_days: 180,
      daily_work_hours: 7,
      monthly_allowance_hours: 0,
      year: new Date().getFullYear(),
    },
    leaves: [],       // {id, entry_type, start_date, end_date}
    permissions: [],  // {id, date, hours}
    holidays: DEFAULT_HOLIDAYS_2026,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, profile: { ...defaultState().profile, ...parsed.profile } };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
const $ = (sel) => document.querySelector(sel);
const todayISO = toISO(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ------------------------------------------------------------ dashboard */

const ZONE_TEXT = {
  green:  { title: "وضعك آمن ✅", hint: (m) => m >= 0 ? `يمكنك التغيّب حتى ${m} يوم عمل وما زلت تحقق الهدف.` : "" },
  yellow: { title: "انتبه ⚠️", hint: (m) => `هامش الأمان ضيّق: ${m} يوم فقط قبل خسارة المكافأة.` },
  red:    { title: "خطر خسارة المكافأة 🔴", hint: () => "بالوتيرة الحالية لن تصل إلى الهدف — راجع إجازاتك القادمة." },
};

function render() {
  const p = state.profile;
  const stats = computeStats({
    year: p.year,
    todayISO,
    targetDays: p.target_days,
    holidays: state.holidays.map((h) => h.date),
    leaves: state.leaves,
    permissions: state.permissions,
    monthlyAllowanceHours: p.monthly_allowance_hours,
    dailyWorkHours: p.daily_work_hours,
  });

  // Progress ring
  const pct = Math.min(1, stats.completedDays / stats.targetDays);
  const ring = $("#ring-progress");
  const circumference = 2 * Math.PI * 84;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference * (1 - pct);
  document.body.dataset.zone = stats.zone;

  $("#ring-count").textContent = stats.completedDays;
  $("#ring-target").textContent = `من ${stats.targetDays} يوم`;
  $("#stat-remaining").textContent = stats.remainingNeeded;
  $("#stat-capacity").textContent = stats.futureWorking;
  $("#stat-margin").textContent = stats.margin;
  $("#stat-perm").textContent = stats.permissionExcessHours;

  const zone = ZONE_TEXT[stats.zone];
  $("#zone-title").textContent = stats.achieved ? "مبروك! حققت الهدف 🎉" : zone.title;
  $("#zone-hint").textContent = stats.achieved
    ? "أكملت أيام العمل المطلوبة لاستحقاق مكافأة الأعمال الممتازة."
    : zone.hint(stats.margin);

  $("#greeting").textContent = p.full_name ? `مرحباً، ${p.full_name} 👋` : "مرحباً بك 👋";
  $("#year-label").textContent = p.year;

  renderLog();
  renderHolidays();
}

function renderLog() {
  const list = $("#log-list");
  list.innerHTML = "";
  const holidaySet = new Set(state.holidays.map((h) => h.date));

  const items = [
    ...state.leaves.map((l) => ({ ...l, kind: "leave", sort: l.start_date })),
    ...state.permissions.map((pm) => ({ ...pm, kind: "perm", sort: pm.date })),
  ].sort((a, b) => b.sort.localeCompare(a.sort));

  if (!items.length) {
    list.innerHTML = `<li class="empty">لا توجد سجلات بعد — أضف إجازة أو استئذاناً من الأزرار أعلاه.</li>`;
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    if (item.kind === "leave") {
      const t = LEAVE_TYPES[item.entry_type] || { label: item.entry_type, emoji: "📅" };
      const days = countWorkingDays(item.start_date, item.end_date, holidaySet);
      const range = item.start_date === item.end_date
        ? fmtDate(item.start_date)
        : `${fmtDate(item.start_date)} ← ${fmtDate(item.end_date)}`;
      li.innerHTML = `
        <span class="log-emoji">${t.emoji}</span>
        <span class="log-body"><strong>إجازة ${t.label}</strong><small>${range} · خصم ${days} يوم عمل</small></span>`;
    } else {
      li.innerHTML = `
        <span class="log-emoji">⏱️</span>
        <span class="log-body"><strong>استئذان ${item.hours} ساعة</strong><small>${fmtDate(item.date)}</small></span>`;
    }
    const del = document.createElement("button");
    del.className = "log-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "حذف السجل");
    del.onclick = () => {
      if (item.kind === "leave") state.leaves = state.leaves.filter((l) => l.id !== item.id);
      else state.permissions = state.permissions.filter((pm) => pm.id !== item.id);
      saveState();
      render();
    };
    li.appendChild(del);
    list.appendChild(li);
  }
}

function renderHolidays() {
  const list = $("#holiday-list");
  list.innerHTML = "";
  for (const h of [...state.holidays].sort((a, b) => a.date.localeCompare(b.date))) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="log-emoji">🗓️</span>
      <span class="log-body"><strong>${h.name}</strong><small>${fmtDate(h.date)}</small></span>`;
    const del = document.createElement("button");
    del.className = "log-del";
    del.textContent = "✕";
    del.onclick = () => {
      state.holidays = state.holidays.filter((x) => x.date !== h.date || x.name !== h.name);
      saveState();
      render();
    };
    li.appendChild(del);
    list.appendChild(li);
  }
}

function fmtDate(iso) {
  return toDate(iso).toLocaleDateString("ar-KW", { day: "numeric", month: "long" });
}

/* --------------------------------------------------------------- dialogs */

function openSheet(id) { $(id).classList.add("open"); }
function closeSheets() { document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("open")); }

document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeSheets));
document.querySelectorAll(".sheet").forEach((s) =>
  s.addEventListener("click", (e) => { if (e.target === s) closeSheets(); }));

// Quick-add leave: one tap picks the type, dates default to today.
document.querySelectorAll("[data-leave]").forEach((btn) => {
  btn.onclick = () => {
    $("#leave-type").value = btn.dataset.leave;
    $("#leave-start").value = todayISO;
    $("#leave-end").value = todayISO;
    $("#leave-sheet-title").textContent = `إجازة ${LEAVE_TYPES[btn.dataset.leave].label}`;
    openSheet("#sheet-leave");
  };
});

$("#btn-perm").onclick = () => {
  $("#perm-date").value = todayISO;
  $("#perm-hours").value = 1;
  openSheet("#sheet-perm");
};

$("#form-leave").onsubmit = (e) => {
  e.preventDefault();
  const start = $("#leave-start").value;
  let end = $("#leave-end").value || start;
  if (toDate(end) < toDate(start)) end = start;
  state.leaves.push({ id: uid(), entry_type: $("#leave-type").value, start_date: start, end_date: end });
  saveState();
  closeSheets();
  render();
};

$("#form-perm").onsubmit = (e) => {
  e.preventDefault();
  state.permissions.push({ id: uid(), date: $("#perm-date").value, hours: Number($("#perm-hours").value) });
  saveState();
  closeSheets();
  render();
};

/* -------------------------------------------------------------- settings */

$("#btn-settings").onclick = () => {
  const p = state.profile;
  $("#set-name").value = p.full_name;
  $("#set-type").value = p.ministry_type;
  $("#set-target").value = p.target_days;
  $("#set-hours").value = p.daily_work_hours;
  $("#set-allowance").value = p.monthly_allowance_hours;
  openSheet("#sheet-settings");
};

// Changing the sector suggests the matching target (still editable).
$("#set-type").onchange = () => {
  $("#set-target").value = $("#set-type").value === "teaching" ? 135 : 180;
};

$("#form-settings").onsubmit = (e) => {
  e.preventDefault();
  state.profile = {
    ...state.profile,
    full_name: $("#set-name").value.trim(),
    ministry_type: $("#set-type").value,
    target_days: Number($("#set-target").value) || 180,
    daily_work_hours: Number($("#set-hours").value) || 7,
    monthly_allowance_hours: Number($("#set-allowance").value) || 0,
  };
  saveState();
  closeSheets();
  render();
};

$("#btn-holidays").onclick = () => openSheet("#sheet-holidays");

$("#form-holiday").onsubmit = (e) => {
  e.preventDefault();
  const date = $("#holiday-date").value;
  const name = $("#holiday-name").value.trim() || "عطلة رسمية";
  if (date) {
    state.holidays.push({ date, name });
    saveState();
    $("#holiday-date").value = "";
    $("#holiday-name").value = "";
    render();
  }
};

$("#btn-reset").onclick = () => {
  if (confirm("سيتم حذف جميع البيانات المحفوظة على هذا الجهاز. هل أنت متأكد؟")) {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    closeSheets();
    render();
  }
};

render();
