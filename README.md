# ١٨٠ يوم — "180 Days" Platform (MVP)

المساعد الرقمي للموظف الحكومي الكويتي لتتبع أيام العمل الفعلية واستحقاق مكافأة **الأعمال الممتازة** (180 يوم عمل فعلي خلال السنة الميلادية).

A mobile-first web app that helps Kuwaiti government employees track their actual working days toward the Civil Service Commission's 180-day threshold for the "Excellent Performance" bonus.

📄 Full proposal: [`docs/project-proposal.md`](docs/project-proposal.md)

## ✨ What this MVP does

- **Dynamic dashboard** — circular counter of completed working days vs. target, countdown of remaining days, and a color-coded safety zone (green / yellow / red) computed from how many working days are still achievable this year.
- **Leave engine** — one-tap quick-add for annual (دورية), sick (مرضية), emergency (طارئة), and unpaid leaves; deductions are calculated automatically and only count leave days that fall on actual working days.
- **Hourly permissions (استئذانات)** — hours accumulate per month; anything above the configurable monthly allowance converts automatically into deducted days.
- **Kuwait calendar** — Fridays/Saturdays excluded automatically; official 2026 holidays pre-loaded (Islamic dates are estimates and editable from settings).
- **Profiles** — admin (180 days) vs. teaching (135 days) presets, configurable target, daily hours, and permission allowance.

Data is stored in the browser's `localStorage` — no account needed for the MVP.

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

**X Star Software** — [xstarkw.com](https://xstarkw.com)

## ⚠️ Disclaimer

نسخة تجريبية — الأرقام استرشادية ولا تغني عن السجلات الرسمية لديوان الخدمة المدنية.
This is an MVP; figures are indicative and do not replace official CSC records.
