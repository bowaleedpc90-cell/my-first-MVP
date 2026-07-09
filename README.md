# ١٨٠ يوم — "180 Days" Platform (MVP)

المساعد الرقمي للموظف الحكومي الكويتي لتتبع أيام العمل الفعلية واستحقاق مكافأة **الأعمال الممتازة** (180 يوم عمل فعلي خلال السنة الميلادية).

A mobile-first web app that helps Kuwaiti government employees track their actual working days toward the Civil Service Commission's 180-day threshold for the "Excellent Performance" bonus.

## 🔗 جرّب التطبيق مباشرة / Live app

**https://bowaleedpc90-cell.github.io/my-first-MVP/**

📱 **ثبّته كتطبيق على جوالك:** افتح الرابط ثم:
- **آيفون (Safari):** زر المشاركة ⬆️ ← «أضف إلى الشاشة الرئيسية».
- **أندرويد (Chrome):** القائمة ⋮ ← «تثبيت التطبيق / إضافة إلى الشاشة الرئيسية».

بياناتك تُحفظ على جهازك فقط، ولا تحتاج تسجيل دخول.

📄 Full proposal: [`docs/project-proposal.md`](docs/project-proposal.md)

## ✨ What this MVP does

- **Dynamic dashboard** — circular counter with completed days, target, **percentage of goal**, and a color-coded status (green safe / yellow warning / red danger). A status card shows the **estimated safety buffer** and a "how we calculated it" explainer with the live equation (available − required = buffer).
- **Four stat cards** — available working days, days remaining to target, safety buffer, and this month's permission usage as `used / limit hours` and `used / limit times`.
- **First-run onboarding (2 steps)** — step 1 sets work type (admin morning/evening, shifts, teaching, custom), annual target (180 default for admin, not forced for shifts/teaching), weekend days, and ministry/category. Step 2 lets the user enter this year's past leaves and absences once (permissions not needed), with a live counter so the completed-days number is accurate from the very first open.
- **Quick add** — annual / sick / emergency / unpaid / permission / custom. Every action opens a small sheet (date defaults to today, single day or range), shows a live deduction preview, and confirms with a toast + **undo**. Every record can be **edited, deleted (with confirm), or undone**.
- **Monthly calendar** — color-coded days (workday, weekend rest, official holiday, leave, permission); tap any day for its detail (is it a workday? does it count? why excluded?).
- **Leave simulator** — try a future leave and see deducted days + safety buffer before/after + new status, without saving until you approve.
- **Smart alerts** — contextual cards when the buffer drops below 20 / 10 days, the target becomes unreachable, or the monthly permission limit is exceeded.
- **Report export** — PDF/print or shareable text summary; **privacy page** with app PIN lock and full data deletion.
- **Kuwait calendar** — Fridays/Saturdays excluded automatically; official 2026 Kuwait public holidays (per CSC announcements) pre-loaded and editable (Hijri dates subject to moon-sighting).
- **Installable (PWA)** — add to the phone home screen and it appears as an app named **"١٨٠ يوم"** with a clean green ١٨٠ icon (standard + maskable). A short intro splash ("كل يوم يقربك للامتياز") greets first-time users; X Star stays as a subtle signature in the header and footer.

The safety-buffer status thresholds are: **safe ≥ 20**, **warning 10–19**, **danger < 20 unreachable or < 10** (configurable).

The app starts empty — no sample data. Each employee enters only their own leaves and permissions, stored in the browser's `localStorage`. No account needed for the MVP.

## 🗄️ Backend (Phase 2)

[`docs/supabase-schema.sql`](docs/supabase-schema.sql) contains the target Supabase/PostgreSQL schema — `profiles`, `leave_entries`, `public_holidays`, `calculation_snapshots`, `settings` — with **Row Level Security** so each user sees only their own data. The calculation logic in `js/engine.js` is pure and DOM-free, ready to port to a Supabase Edge Function.

## 🚀 Run it

No build step. Serve the folder with any static server and open it on your phone or browser:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or deploy the folder as-is to GitHub Pages / Netlify / Vercel.

## 🧪 Tests

The calculation engine is pure JavaScript with unit tests:

```bash
node --test test/engine.test.mjs
```

## 📁 Structure

```
index.html            App shell (Arabic, RTL, mobile-first)
css/style.css         Styling
js/engine.js          Pure calculation engine (no DOM) — portable to Supabase later
js/app.js             UI logic + localStorage persistence
test/engine.test.mjs  Engine unit tests
docs/project-proposal.md  Original bilingual proposal
```

## 🗺️ Next steps (per the roadmap)

1. **Phase 1 — CSC rules verification:** confirm exact permission limits, sick-leave exclusion rules, and holiday dates against official CSC decisions (current defaults are configurable placeholders).
2. **Supabase backend:** move `engine.js` logic + the proposal's `profiles` / `leaves` schema to Supabase with auth, replacing `localStorage`.
3. **Closed beta:** 20–30 employees across ministries to validate calculations against official records.

## 🏢 Developed by

**X Star Software** — [xstarkw.com](https://xstarkw.com) · [@xstar.kw on Instagram](https://instagram.com/xstar.kw)

## ⚠️ Disclaimer

نسخة تجريبية — الأرقام استرشادية ولا تغني عن السجلات الرسمية لديوان الخدمة المدنية.
This is an MVP; figures are indicative and do not replace official CSC records.
