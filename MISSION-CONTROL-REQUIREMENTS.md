# Mission Control — Requirements Lock Document
_Version 1.0 | 2026-05-24_

---

## 1. WHAT IS MISSION CONTROL?

Mission Control is a Progressive Web App (PWA) — a website that installs on your phone or laptop like a real app — that functions as a personal life dashboard for a neurodivergent adult managing chronic illness, a custody case, finances, and daily life with minimal cognitive overhead.

It is a **single HTML file** (`index.html`) backed by two external files (`assistant.js`, `money-engine.js`) plus a security/monitoring pod (`security-pod.js`). All user data is stored locally (localStorage) and synced to Supabase (cloud database) so it follows you across devices.

**Five main tabs.** Each tab is its own world with its own purpose.

---

## 2. USER

- Single user: Petra Norman, Lincoln NE, tissue recovery specialist
- Devices: Lenovo Legion laptop (Ubuntu) + iPhone (PWA installed)
- Conditions: POTS, MCAS, hEDS, Autistic/ADHD — app must never add cognitive load
- Auth: Supabase email/password login (`login.html` redirect if not logged in)

---

## 3. TOP-LEVEL NAVIGATION

**F1** — The app displays five navigation tabs at all times: **Right Now**, **Body**, **Money**, **Life**, **Assistant**.

**F2** — Only one tab is visible at a time. Switching tabs hides all others and shows the selected one.

**F3** — The **Life** tab simultaneously activates two hidden divs (`tab-life` and `tab-life-2`) that together make up the Life section.

**F4** — The Assistant tab displays a notification badge when tasks are overdue or due soon. The badge shows a count.

**F5** — Switching to Right Now tab re-runs the Right Now rendering function. Switching to Assistant tab calls `Assistant.refresh()`.

---

## 4. PERSISTENT HEADER

**F6** — The header displays the app name ("MISSION CONTROL") with a crown emoji, the current full date (long format), and a live clock (HH:MM:SS, updates every second).

**F7** — A Body Check banner is always visible below the header with three static prompts: "Unclench your jaw", "Drop your shoulders", "Take a breath", "You're doing fine."

**F8** — A dismissible status bar (`#app-status-bar`) appears when the app has something to report: offline state, sync error, security alert, or informational message. It is hidden by default.

**N1** — The status bar has four visual states: offline (gold), error (pink/red), ok (green), info (purple). Only one state is shown at a time.

**F9** — A corner dog emoji (`🐶`) is fixed in the top-right corner at all times. It bounces gently in a loop and wiggles on hover.

**F10** — A magic wand button (`🪄`) is fixed on screen. Clicking it spawns an animation of emoji falling across the screen ("magic wand rain").

**F11** — A back-to-top button is fixed in the bottom-right corner. It appears only when the user has scrolled more than 300px and smoothly scrolls to the top on click.

---

## 5. TAB: RIGHT NOW

**Purpose:** One-glance status. The answer to "how am I doing right now?" across body, money, and tasks.

**F12** — The Right Now tab renders a body status card that shows a single emoji (🟢/🟡/🔴) and one plain-language sentence summarizing the body forecast overall score (sourced from the Body tab's forecast data). Below the emoji, it shows key details from the pressure and POTS sub-scores.

**F13** — If body forecast data is not yet loaded (weather API still pending), the card shows a loading state and retries automatically every 3 seconds.

**F14** — An alerts area renders contextual warnings: bills past due, bills due within 2 days, disconnect notices, low Life bucket balance, empty Dopamine bucket, and bills underfunded by the Fixed bucket. Each alert is a single line with an emoji prefix.

**F15** — An action items list renders up to 6 items. Sources: unchecked medication todos, unchecked animal care todos, and bills due within 2 days. Items are clickable — clicking an item checks the associated checkbox on the Life tab.

**F16** — If no action items exist, the list shows: "Nothing urgent right now. You're good."

**F17** — A money snapshot shows three values: "Safe to Spend" (checking balance − bills due before next payday − manual ACH pending), "Dopamine" bucket balance, and a payday countdown (days until next payday, or "Today!", or "Tomorrow").

**F18** — A vibe line rotates through 8 plain-language affirmations, chosen randomly on each render.

---

## 6. TAB: BODY

**Purpose:** Environmental health intelligence for a body affected by POTS, MCAS, hEDS, and chronic pain. Converts raw weather data into plain-language condition assessments.

### 6.1 Weather + Pressure Card

**F19** — The app fetches live weather for Lincoln, NE (lat 40.8059, lon -96.6718) from the Open-Meteo free API on page load and on manual refresh.

**F20** — Weather data displayed: temperature (°F), weather icon/description, barometric pressure (inHg and hPa), 6-hour pressure change, pressure trend direction, humidity, dew point, wind speed, and a 24-hour pressure lookahead.

**F21** — The pressure change uses a color-coded status: normal (white), crossing 2 mbar (warning/yellow), crossing 4 mbar (urgent/red).

**F22** — The 24-hour lookahead identifies the largest expected pressure drop in the next 24 hours and labels it: stable, small drop, moderate drop, or major drop — with plain-language consequence text.

**F23** — A visual pressure bar shows current pressure on a gradient from LOW (rough day) to HIGH (stable) with a needle indicator positioned proportionally.

**F24** — A "Refresh Weather" button manually re-fetches both weather and pollen data.

**F25** — A timestamp shows when weather was last loaded.

### 6.2 Air Quality + Pollen Card

**F26** — The app fetches live air quality for Lincoln, NE from the Open-Meteo Air Quality API on page load.

**F27** — Pollen data displayed: Grass, Birch, Ragweed, Mugwort (each in grains/m³ with Low/Moderate/High/Very High label), PM2.5, PM10, and an overall MCAS Pollen Alert.

**F28** — Each pollen type has specific MCAS-relevant thresholds for yellow and red coloring (not general population thresholds — lower because MCAS patients react earlier).

### 6.3 Body Forecast Card

**F29** — The Body Forecast is a full-width card that renders after both weather and pollen data are loaded. It shows six alert rows, one per body system:

| Row | System | Icon |
|-----|--------|------|
| 1 | Barometric pressure / neuro | 🧠 |
| 2 | POTS / autonomic | 💓 |
| 3 | MCAS / mast cell | 🫁 |
| 4 | hEDS / pain / hypermobility | 🦴 |
| 5 | Pollen body impact | 🌿 |
| 6 | Overall composite | 📋 |

**F30** — Each row has three visual states: green (level-green), yellow (level-yellow), red (level-red). Colors are applied via CSS class on the alert row.

**F31** — Each row displays: a headline status, a static reference range (e.g., "Change <4 mbar in 6hrs = WNL"), a dynamic detail sentence with current values, and a quirky one-liner vibe note.

**F32** — MCAS and Pain rows use a trigger-stacking scoring system. Each active environmental trigger adds points. Total score determines green/yellow/red.

**F33** — The Overall row combines MCAS score + Pain score + cycle bonus (1 point for period, 2 for heavy flow) + pressure contribution + temperature contribution + pollen contribution.

**F34** — The overall score thresholds: 0–4 = green ("Good day"), 5–9 = yellow ("Moderate day"), 10+ = red ("Rough day"). Each state has a specific plain-language consequence message.

### 6.4 Cycle Tracker

**F35** — The Cycle Tracker card shows at-a-glance: current cycle day, next period date, and today's logged flow level.

**F36** — The card is expandable (collapsible). Expanded view shows: flow level buttons (None/Spotting/Light/Medium/Heavy), symptom toggle buttons (Cramps, Headache, Bloating, Fatigue, Mood swings, Nausea, Back pain), a notes text area, a "Save Today's Entry" button, and a history list of recent entries.

**F37** — Cycle entries are saved per-date to `localStorage` under key `cycle_entries`. Each entry stores: date, flow level, symptoms array, notes.

**F38** — The cycle tracker reads the most recent period start from the log to calculate cycle day and predict next period. Period prediction assumes a 28-day average cycle.

**F39** — The current flow level is fed into the Body Forecast overall score calculation.

**N2** — The cycle tracker does not use any external period tracking API. All data stays local/cloud via the existing saveData system.

### 6.5 Symptom Tracker

**F40** — A full-width card with an interactive SVG body diagram. Body regions: head, neck, chest, stomach, left arm, right arm, left hand, right hand, hips, left leg, right leg, left foot, right foot.

**F41** — Tapping a body region highlights it and opens a symptom selection panel on the right side of the card.

**F42** — After selecting a region, the user can pick symptoms specific to that region, add intensity, and log the entry. Entries are stored in `localStorage` under `symptom_log`.

**F43** — A "Today's Log" section shows all symptoms logged for the current day. A "Clear today's log" button removes all entries for today.

---

## 7. TAB: MONEY

**F44** — The Money tab currently shows a placeholder screen with "Under construction" messaging. It is reserved for the Waterfall money pod (see `WATERFALL-PRODUCT-BRIEF.md` and `WATERFALL-SCHEMA.md`).

**N3** — The old finance system (accounts, bills, income, transactions, debts, spending) still exists in the JavaScript and in localStorage. It is not removed — it will be the data layer the Waterfall pod reads from. The old UI panels are archived in `finance-archive/`.

**N4** — All finance data remains in localStorage and Supabase under the existing keys (`fin_accounts`, `fin_bills`, etc.) even while the Money tab shows the placeholder. The Right Now tab reads this data for its money snapshot.

---

## 8. TAB: LIFE

**Purpose:** Logistics and daily operations — work schedule, kid tracking, calendar, meds, daily care, and a brain dump.

### 8.1 Work — On Call

**F45** — A static card showing on-call status, cases today, and next day off. These are manually updated static values (not connected to an external scheduling system).

### 8.2 Kid Behavior Tracker

**F46** — A collapsible card showing at-a-glance: today's entry count and the most recent entry label.

**F47** — Expanded view shows: filter buttons (All, Self-harm, School, Transitions, Mood, Medical, Positive), the filtered log list, a "+ Log Behavior" button, and a "Copy Log to Clipboard" button.

**F48** — Logging a behavior opens a modal overlay form with fields: description (textarea), category (select), severity 1–5, and location (Mom's house, Dad's house, School, Other).

**F49** — Entries are stored in `localStorage` under `kid_logs`. Each entry includes: id, description, category, severity, location, timestamp.

**F50** — The "Copy Log to Clipboard" button formats all (or filtered) log entries into a court-ready text format and copies it to the system clipboard.

**F51** — The Kid tab collapsible state, filter selection, and today's entry count all persist visually across tab switches within the same session.

### 8.3 Google Calendar

**F52** — A full-width card embeds the user's Google Calendar (`petdevo@gmail.com`) via an iframe in week view, dark-themed via CSS filter. The calendar is read-only within the app; edits happen in Google Calendar directly.

### 8.4 Meds and Daily Care Checklists

**F53** — Two editable checklist cards: "Meds" and "Daily Care". Each list supports: check/uncheck items, inline item text editing, delete individual items, and an "+ Add item" button.

**F54** — Checklist item state (checked/unchecked) resets daily — every new day, all checkboxes revert to unchecked.

**F55** — Checklist item content (the list itself) persists permanently in `localStorage`. Checkboxes also trigger sparkle animations on check.

### 8.5 Brain Dump

**F56** — A full-width resizable textarea. Content auto-saves on input. No character limit, no structure — freeform dump only.

---

## 9. TAB: ASSISTANT

**Purpose:** Task management and daily briefing, neurodivergent-first.

**F57** — The Assistant tab is rendered by `assistant.js` as a self-contained pod. It mounts into `#tab-assistant` on first load and re-renders on `Assistant.refresh()`.

**F58** — The Assistant has two primary views: a **Briefing** view (default) and a **Task List** view.

### 9.1 Briefing

**F59** — The Briefing view shows: a greeting with a date-seeded emoji, a "Top Focus" task card (most urgent task based on priority algorithm), up to 2 additional secondary task cards, and an energy level selector.

**F60** — Task urgency is determined by: overdue status, due-soon status (within 48 hours), priority rating, and energy cost vs. current energy level.

**F61** — The briefing pulls body context (from the Right Now body status) and money context (from Safe to Spend) to surface relevant context alongside tasks.

### 9.2 Top Three

**F62** — A "Top Three" section shows three pinnable focus slots. The user can assign any task to a slot. Slots can be filled from a picker overlay.

**F63** — Top Three slots persist in the session state. Assigned tasks are visually distinct from the general task list.

### 9.3 Task Management

**F64** — Tasks have the following fields: title, steps (ordered sub-tasks), due date, priority (1–5), energy cost (low/medium/high), project/category tag, and notes.

**F65** — Tasks can be created, edited, marked done, and deleted. A modal form handles create/edit with a step-builder UI that allows reordering steps.

**F66** — The task list supports filters: All, Active, Done, and by tag/project. Done tasks are visually separated and dimmed.

**F67** — Tasks show a progress indicator for step completion (e.g., "2/5 steps").

**F68** — Completing a step or a task triggers the shared sparkle animation.

### 9.4 Energy Tracker

**F69** — An energy card allows the user to set their current energy level: Crashed, Low, Medium, High. The selected level affects which tasks appear in the briefing (low-energy tasks bubble up when energy is low).

### 9.5 Capture

**F70** — A capture panel lets the user quickly record a thought, link, or task idea without opening the full task modal. Captured items can be promoted to full tasks.

### 9.6 Routine

**F71** — A routine section displays a static daily routine list (configurable in settings). Not connected to the checklist system on the Life tab.

### 9.7 Storage

**F72** — All Assistant data (tasks, energy, settings, capture) is stored via the shared `saveData`/`loadData` functions, which write to localStorage and sync to Supabase.

---

## 10. FLOATING UTILITIES (ALL TABS)

### 10.1 Timestamp Button

**F73** — A floating timestamp button is visible on all tabs. Clicking it logs a timestamped entry with an optional text label. Entries are displayed in a collapsible panel above the button.

**F74** — Timestamps are stored in `localStorage` under `timestamps`. Each entry includes: ISO timestamp and label text.

**F75** — The panel shows up to 10 recent timestamps with relative time labels.

### 10.2 Toast Notifications

**F76** — A toast notification system shows brief pop-up messages in the bottom-center of the screen. Toasts auto-dismiss after ~2 seconds. Used for confirmation of actions (saved, logged, copied).

---

## 11. DATA & SYNC SYSTEM

**F77** — All user data is stored in `localStorage` with the prefix `mc_` (e.g., `mc_fin_bills`). This makes the app usable offline immediately — no network dependency for reads.

**F78** — On every save, data is written to `localStorage` first (instant), then synced to Supabase after a 2-second debounce. Rapid saves do not spam the database — only the last value within a 2-second window is pushed.

**F79** — On page load, the app pulls all user data from Supabase. For each key, if the local version has a newer timestamp than the cloud version, the local version wins and queues a sync-up. If the cloud version is newer, it overwrites local.

**F80** — If cloud is empty on first login and localStorage has data, the app runs a one-time migration that pushes all local keys to Supabase.

**F81** — All localStorage keys that are synced: `fin_accounts`, `fin_bills`, `fin_income`, `fin_transactions`, `fin_debts`, `fin_emergency`, `fin_spending`, `buckets`, `bucket_settings`, `paycheck_log`, `manual_pending`, `sinking_funds`, `cycle_entries`, `kid_logs`, `timestamps`, `symptom_log`, `checkboxes`, `textareas`, `last_auto_run`, `last_bill_reset_month`, `last_checkbox_reset`, `finance_preloaded_v2`.

---

## 12. AUTOMATIONS (RUN DAILY ON PAGE LOAD)

**F82** — Automations run once per calendar day. A flag (`last_auto_run`) tracks the last run date. If already run today, skip entirely.

**F83** — **Monthly bill reset:** On the first day of each new calendar month, all recurring bills are reset from "processed" or "pending" back to "unpaid", and their due dates are advanced to the current month.

**F84** — **Auto-advance payday:** If today's date is past the stored next payday, the payday date is bumped forward by the configured pay frequency (default 14 days) until it's in the future again.

**F85** — **Daily checkbox reset:** Every new day, all `.todo-item` checkboxes are unchecked and the saved checkbox state is cleared.

**F86** — **Auto-mark autopay bills:** Bills flagged as auto-pay whose due date has passed are automatically set to "pending" status. No balance deductions — the bank balance (via SimpleFIN) is the source of truth for what actually cleared.

---

## 13. SECURITY

**F87** — The app requires authentication. If no Supabase user session is found on load, the user is redirected to `login.html`.

**F88** — All user data written to `innerHTML` is escaped through an `esc()` helper that creates a text node and reads `.innerHTML` — preventing XSS injection from user-entered content.

**F89** — The `security-pod.js` provides: input validation on saves, RLS (Row-Level Security) probing against Supabase, a sync journal for tracking in-flight writes, and error capture across all JavaScript errors.

**F90** — A security health badge in the page header reflects the current security status: unknown, ok, warning, or error — sourced from the Security Pod's health check.

**F91** — The Content Security Policy header restricts scripts to `self` and one CDN (jsdelivr.net for Supabase), styles to `self` and Google Fonts, connections to `self` and the specific Supabase project URL and Open-Meteo APIs, and images to `self` and `data:` URIs.

---

## 14. PWA / INSTALLABILITY

**F92** — The app ships with a `manifest.json` and service worker (`sw.js`) making it installable as a PWA on both iPhone (via Safari "Add to Home Screen") and Android/desktop.

**F93** — The app has apple-mobile-web-app meta tags for full-screen mode on iOS and a theme color matching the app's dark background (`#1a1216`).

**N5** — Offline functionality is limited. The service worker handles asset caching but real-time weather and Supabase sync require an internet connection. Locally cached data is always readable offline; saves queue and sync when reconnected.

---

## 15. STYLING & DESIGN

**N6** — The app uses a single dark color palette throughout:
- Background: `#1a1216` (near-black with warm undertone)
- Card surface: `#2a1f24`
- Primary accent: `#d4849a` (dusty rose/pink)
- Secondary accent: `#b48db5` (muted purple)
- Warning: `#e8b84b` (amber gold)
- Success: `#6bbf7b` (soft green)
- Text primary: `#f0eae8`
- Text secondary: `#9a8a92`

**N7** — Font: Lexend (Google Fonts). Chosen specifically for reduced visual stress and improved reading speed for neurodivergent readers.

**N8** — All interactive elements use `accent-color: #d4849a` for consistent checkbox and form styling.

**N9** — Cards use a left border in the primary accent color as a visual anchor. Severity is communicated via border color changes (rose → amber → green).

**N10** — The layout uses CSS Grid (`auto-fit, minmax(340px, 1fr)`) so cards reflow naturally from 1 to 2 to 3+ columns based on viewport width — no breakpoint logic required.

---

## 16. DELIGHT / PERSONALITY

**F94** — Sparkle particles (`✨⭐💫🌟✦✧⋆`) burst from the click point whenever the user checks a checkbox, marks a bill paid, logs a cycle entry, or completes any positive action.

**F95** — The magic wand button triggers a "bippity boppity boo" rain of falling emoji across the full screen.

**F96** — Financial feedback uses a named AI persona ("Miss Claudette") with warm, shame-free, casual language. The greeting adapts to financial state: payday celebration, honest shortage acknowledgment, "you're covered" reassurance, or action-needed heads-up.

**F97** — The Body Forecast includes a short "vibe note" per condition row — a one-liner that names the experience (e.g., "Mast cells woke up and chose violence." / "Skeleton filed a formal complaint.").

**N11** — Tone across the entire app: casual, direct, plain English, never clinical, never condescending. The app talks to the user like a trusted friend who did the math for them.

---

## 17. OUT OF SCOPE (current version)

**X1** — The Waterfall money engine UI is not yet built into the Money tab. The engine (`money-engine.js`) and spec (`WATERFALL-SCHEMA.md`, `WATERFALL-PRODUCT-BRIEF.md`) are complete; the pod is under active development.

**X2** — SimpleFIN bank sync (automatic balance fetching from the actual bank) is referenced in comments but not active in the current version. Balance is entered manually by the user.

**X3** — The "Smart Advisor" and "Budget Overview" panels from the old finance system are archived. They will not be brought forward — the Waterfall replaces them.

**X4** — Multi-user support is not planned. The app is single-user by design.

**X5** — Push notifications are not implemented. The app runs in the foreground only.

---

_Document generated from full read of `index.html` (7,600 lines), `assistant.js`, `money-engine.js`, `WATERFALL-PRODUCT-BRIEF.md`, and `WATERFALL-SCHEMA.md`._
