# Mission Control

Personal life management dashboard PWA — built for daily use on a phone. Tracks body symptoms, POTS/MCAS/hEDS flare risk, money, kid behavior, work schedule, menstrual cycle, and AI-assisted task planning. Dark fantasy theme.

**Live site:** https://beatbop420.github.io/mission-control/

---

## Start here (for code review)

Read **[MISSION-CONTROL-REQUIREMENTS.md](MISSION-CONTROL-REQUIREMENTS.md)** first — it's a complete formal spec of everything the app does (97 functional requirements, 11 non-functional notes, 5 out-of-scope items). Everything else is implementation of that spec.

---

## Key files

| File | What it is |
|---|---|
| `index.html` | The entire app (~7,600 lines). All 5 tabs, UI, and inline JS logic live here. |
| `assistant.js` | AI task planning tab. Brain dump → priority plan via OpenAI edge function. |
| `money-engine.js` | Pure math engine for the Waterfall budget algorithm. No DOM, no side effects. |
| `security-pod.js` | RLS probing, error capture, sync tracking, event logging. |
| `WATERFALL-SCHEMA.md` | Complete spec for the Waterfall budget algorithm — read this alongside `money-engine.js`. |
| `WATERFALL-PRODUCT-BRIEF.md` | Product brief — what the Waterfall is, who it's for, and what it explicitly doesn't do. |
| `sw.js` | Service worker (v22) for offline/PWA support. |
| `login.html` | Magic link OTP login page. |
| `supabase-config.js` | Supabase client init + config. |

---

## Tech stack

- Vanilla JS, single HTML file, no build step, no framework
- Supabase (PostgreSQL + Auth) for cloud sync and login
- GitHub Pages for hosting
- PWA installable (manifest + service worker)

---

## Run locally

```bash
cd ~/projects/mission-control
python3 -m http.server 8199
```

Open `http://localhost:8199`

---

## What's complete vs WIP

| Area | Status |
|---|---|
| Tabs 1–4 (Right Now, Body, Life, Assistant) | Complete, in daily use |
| `money-engine.js` | Complete — pure function, all math done |
| Money tab UI pod | **Not built yet for main app** — exists only in the demo. See `mission-control-demo` repo. |
| Security pod | Steps 1–2 done (RLS, probing). Steps 3–7 still open (input validation, sync journal, CSP, etc.) |

---

## Known issues

- RLS probe can false-pass on empty tables (treats "0 rows returned" as pass)
- `esc()` XSS helper is text-between-tags only — attribute contexts (`class=`, `data-=`) need separate handling
- Money tab is an empty mount point (`#tab-money`) waiting for the pod to be wired in
