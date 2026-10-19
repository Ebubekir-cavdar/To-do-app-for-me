# To-Do App — Design Prototype Spec (shared by all 5 designs)

Personal to-do app for one Android user. These HTML prototypes are for **comparing visual designs**; every design must implement exactly the same functionality and data model below. Only the look & feel differs. The chosen design will later be ported to React Native (Expo) — so stick to layouts that are realistic on a phone (no hover-only interactions).

## Deliverable
- ONE self-contained file: `designs/design-N-<slug>.html` (inline CSS + JS, no build step).
- External resources allowed: Google Fonts only. No JS libraries / CDNs. Icons/ornaments as inline SVG or CSS.
- Opened on a PC via `file://` and viewed with Chrome DevTools device emulation (~360–430px wide, e.g. 390×844). Must look right at phone width; on a wide desktop window center the app in a phone-width column (max-width ~430px).
- UI language: **Turkish**. Functional labels must stay clear Turkish (themed flavor in headings/decor is fine).

## Screen: Week view (the home screen)
- Header: week range, e.g. `13 – 19 Ekim 2026`, with ‹ › buttons for previous/next week, and a "Bugün" button that jumps back to the current week.
- Horizontal swipe (touch / pointer drag) on the list also goes to previous/next week.
- Below: the 7 days **stacked vertically**, Monday first: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar — each with its date (e.g. `Pazartesi · 13 Ekim`). The whole page scrolls vertically.
- **Today** is visually highlighted, and on load (current week) the view scrolls so today is in view.
- Under each day: that day's tasks. Empty day shows a subtle empty state.
- Each day has its own **add (+)** button → adds a task **to that day only**.

## Task
- Fields shown: title, optional time (`HH:MM`).
- Order within a day: tasks with a time first, ascending by time; then untimed tasks in creation order.
- Tap the checkbox/marker → toggles **done**. Done tasks get a **strikethrough and stay in place** (no reordering). Tap again to undo. There is NO "in progress" state.
- **Overdue**: a task on a day before today that is not done is marked **red** (a theme-appropriate red, but clearly red/alarm). It stays on its own day — never moved.
- On today's section (only when viewing the current week), show a small summary like `2 geciken görev` if any overdue tasks exist in the past (any week); tapping it is optional.
- Delete: tapping the task text (not the checkbox) opens a small action sheet/dialog with **Sil** and **İptal** (custom in-page UI — never `alert/confirm/prompt`).

## Add-task UI
- Custom in-page bottom sheet or modal (never `prompt()`): title input (required, autofocus), optional time input (`<input type="time">` is fine), **Ekle** / **İptal**. Enter submits. Shows which day it adds to.

## Data model & storage (MUST be identical across designs)
- localStorage key: `todoapp.tasks.v1` — a JSON array of:
  ```json
  { "id": "string (unique)", "title": "string", "date": "YYYY-MM-DD", "time": "HH:MM" | null,
    "done": false, "createdAt": 1729000000000, "categoryId": null, "recurrenceId": null }
  ```
  (`categoryId` / `recurrenceId` are reserved for later features — always write `null`, preserve if present.)
- Dates are **local** calendar dates (no UTC conversion — build `YYYY-MM-DD` from `getFullYear/getMonth/getDate`). Weeks start **Monday**.
- Wrap every localStorage read/write in try/catch; if storage is unavailable the app still works in memory.
- Re-read storage on `window` `storage` events / page focus is NOT required.
- **Seed data**: only if the key is absent, seed ~10 tasks relative to the *current* week so every state is visible: a couple of done tasks earlier this week, 2 overdue (undone, past days — one of them in last week), several on today (timed + untimed, one done), a few on upcoming days, one empty day. Sample titles in Turkish (e.g. "Fatura öde", "Spor 18:00", "Market alışverişi", "Kitap oku 30 dk", "Annemi ara").

## Quality bar
- Touch targets ≥ 44px; readable contrast; no horizontal page scroll at 360px.
- No console errors. Smooth, tasteful motion is welcome (respect `prefers-reduced-motion`).
- The design philosophy should be unmistakable at a glance and distinct from the other designs.
