# Finance Tab Rebuild — Progress Tracker

**Your dashboard. Update as we go.**
Last updated: 2026-04-22 (Phase 0 scorched earth ~5/6 done)
Current position: **Phase 0, Step 0.5 — Google OAuth setup in progress**

---

## Overall Progress

```
Phase 0 — Scorched Earth      [######              ]   6 / 6 steps ✓ DONE
Phase 1 — Lock the Database   [                    ]   0 / 3 steps
Phase 2 — Build Sync Tool     [                    ]   0 / 5 steps
Phase 3 — Dashboard Wiring    [                    ]   0 / 4 steps
Phase 4 — First Real Sync     [                    ]   0 / 4 steps
Phase 5 — Full RLS Audit      [                    ]   0 / 4 steps
Phase 6 — Ops Hardening       [                    ]   0 / 5 steps
Phase 7 — Service Worker      [                    ]   0 / 1 step
```

**Total: 6 / 32 steps complete.**

Full plan: `FINANCE-TAB-MASTER-PLAN-GLM.md`
Your UUID (fill in): `___________________________________`

---

## Critical Share Blocker

Do **not** share the real Mission Control URL with outside people until the auth/RLS path is hardened and re-tested.

Fix before external sharing:
- lock down `bank_cache` / replacement finance table so authenticated strangers cannot read it
- fix the Security Pod probe so "0 rows" does **not** count as a successful security check
- verify Supabase auth/signup settings are restricted the way you intend
- run a broader RLS audit on user-facing tables before treating the live app as safe to show outsiders

---

## What this whole thing does (caveman summary)

Right now your bank data rides through GitHub (bad) → Supabase cloud (also bad). Anybody who grabs your GitHub secrets could read your balances.

**New setup:**
- Your LAPTOP reads the bank (SimpleFIN)
- Your LAPTOP does the math (what's safe to spend, bills due, etc.)
- Your LAPTOP pushes ONLY those numbers (no bank name, no account #) to Supabase
- Your PHONE reads those numbers from Supabase and shows them

Cloud never sees bank data again. If GitHub gets hacked, the attacker gets nothing useful.

---

## Open flags (read before starting)

1. **Service key vs user-auth** — GLM picked "service key in keyring" for simplicity. I had us leaning toward user-auth in the 4/20 session. GLM explains the trade-off honestly: simpler code, worse blast radius if your laptop is compromised. Phase 8 has an upgrade path. → **Confirm you're OK with this before Phase 2.**
2. **Dropped `manual_pending`** from schema — if you track manual ACH payments separately, we may need to add this back. → **Think about during Phase 1.**
3. **Schedule A/B/C never picked** — GLM defaults to manual (option C) for first 2 weeks. → **Confirm or override during Phase 2.**
4. **Also delete `scripts/sync_bank_data.py`** — GLM's plan only says delete workflow, but the Python script should go too. → **Do during Phase 0.3.**

---

# PHASE 0 — Scorched Earth (~45 min)

**What it does:** Kills the cloud bank sync completely. Nothing bad can happen from old secrets after this.

**Who does what:**
- You: click around Supabase + GitHub dashboards
- Me: watch, confirm, give exact text for buttons/links

### Steps

- [x] **0.0 Get your Supabase UUID** — DONE 2026-04-21 via Supabase Dashboard (written on paper)
- [x] **0.1 Rotate Supabase service key** — DONE 2026-04-22 (new Secret key, written on paper)
- [x] **0.2 Delete GitHub secrets** — DONE 2026-04-22 (SUPABASE_SERVICE_KEY + SUPABASE_URL deleted)
- [x] **0.3 Delete workflow file + sync_bank_data.py** — DONE 2026-04-22 (committed + pushed)
- [x] **0.4 Purge historical Actions logs** — DONE 2026-04-22 (86 runs deleted)
- [x] **0.5 Google OAuth set up + login page updated** — DONE 2026-04-22 (Google button live, tested working)
- [ ] **0.6 Stub the Bank tab** — replace with "Bank sync is local-only" message

**Exit check:** No bank creds in any cloud. Old service key dead. Old logs gone. UUID on paper. Can still log into Supabase.

---

# PHASE 1 — Lock the Database (~30 min)

**What it does:** Creates the new locked-down table. Only YOUR UUID can read or write it.

**Who does what:**
- Me: writes the SQL
- You: paste into Supabase SQL Editor, click Run

### Steps

- [ ] **1.1 Create `finance_planning` table** with RLS locked to your UUID
- [ ] **1.2 Drop old `bank_cache` table**
- [ ] **1.3 Verify RLS works** (3-step test — unauthenticated blocked, authorized works, optional wrong-user test)

**Exit check:** Unauthorized curl returns an error (not empty array). Your auth works.

---

# PHASE 2 — Build the Local Sync Tool (~1.5 hours)

**What it does:** Creates the laptop script that reads SimpleFIN and pushes planning numbers.

**Who does what:**
- You: type apt install commands, answer script prompts, paste your NEW SimpleFIN URL
- Me: writes all the Python code, tells you what commands to type

### Steps

- [ ] **2.1 Install dependencies** (`libsecret-1-dev` is critical — no silent plaintext keyring)
- [ ] **2.2 Create venv + pinned `requirements.txt`**
- [ ] **2.3 Run `setup_credentials.py` once** (stores SimpleFIN URL + new service key in OS keyring)
- [ ] **2.4 Write `local_sync.py`** (reads SimpleFIN → validates → pushes to Supabase)
- [ ] **2.5 Test run** — expect `Sync OK at [timestamp]`

**Exit check:** Script runs, row appears in Supabase. No secrets in terminal output.

---

# PHASE 3 — Dashboard Wiring (~1 hour)

**What it does:** Makes the phone read the new table.

**Who does what:**
- Me: writes JS changes in `index.html`
- You: test on phone after deploy

### Steps

- [ ] **3.1 Point Bank pod at `finance_planning`** (replace `bank_cache` calls)
- [ ] **3.2 Add freshness indicator** ("Last synced Xh ago" + stale warnings)
- [ ] **3.3 Use generic display labels** (Daily / Reserve / Bills / Spendable)
- [ ] **3.4 Deploy + verify on phone**

**Exit check:** Phone shows planning numbers with generic labels + "last synced" indicator. No bank name anywhere.

---

# PHASE 4 — First Real Sync (~15 min)

**What it does:** First time real numbers flow through the new system.

**Who does what:**
- You: re-link Wells Fargo in SimpleFIN, paste new URL into `setup_credentials.py`
- Me: standby in case anything breaks

### Steps

- [ ] **4.1 Re-link SimpleFIN** (fresh URL, never touched GitHub)
- [ ] **4.2 Run `setup_credentials.py`** again with new URL → clear clipboard immediately
- [ ] **4.3 First real `local_sync.py` run**
- [ ] **4.4 Verify on phone** — "Last synced 0h ago" with your real numbers

**Exit check:** Real planning numbers visible on phone. No bank identity anywhere.

---

# PHASE 5 — Full RLS Audit (~30 min)

**What it does:** Every OTHER table in Supabase gets the same lockdown treatment.

**Who does what:**
- Me: runs the policy inventory, writes fix SQL
- You: paste fixes into SQL Editor

### Steps

- [ ] **5.1 Export all RLS policies** to see the full picture
- [ ] **5.2 Fix every table with broad access** (same per-UUID template)
- [ ] **5.3 Re-probe each table** (unauthenticated should get error, not empty)
- [ ] **5.4 Fix Security Pod probe** — stop treating "0 rows" as PASS

**Exit check:** Every user-data table enforces per-user isolation. Security Pod is honest.

---

# PHASE 6 — Ops Hardening (~15 min)

**What it does:** The non-code security stuff — 2FA methods, disk encryption, recovery codes.

**Who does what:** You, mostly. Me walks you through each one.

### Steps

- [ ] **6.1 Gmail 2FA = TOTP** (not SMS — SIM swap attacks are real)
- [ ] **6.2 SimpleFIN MFA** if offered
- [ ] **6.3 Check LUKS disk encryption** (`lsblk -o NAME,TYPE,FSTYPE` → crypto_LUKS?)
- [ ] **6.4 GitHub recovery codes offline** (paper, not in home dir)
- [ ] **6.5 Supabase login works from new browser** (account recovery matters more now that signups are off)

---

# PHASE 7 — Service Worker Review (~15 min)

**What it does:** Make sure the phone's offline cache doesn't secretly hold finance data.

**Who does what:**
- You: open DevTools on phone or desktop
- Me: tells you what to look for, writes fix code if needed

### Steps

- [ ] **7.1 Confirm `sw.js` doesn't cache `/rest/v1/finance_planning`** — fix with network-only rule if it does

---

# AFTER BUILD — Final Verification Gate

Don't consider the rebuild done until all boxes are checked:

- [ ] Keyring verified secure (not plaintext)
- [ ] Unauthorized Supabase reads return ERROR (not empty array)
- [ ] Authorized reads work (your numbers show up)
- [ ] GitHub clean: no workflow, no secrets, no leaked Actions logs
- [ ] Service key rotated (old one dead)
- [ ] SimpleFIN URL lives ONLY in keyring (nowhere else)
- [ ] Clipboard history cleared after credential setup
- [ ] Freshness indicator works on phone
- [ ] No bank name/last4/accountnum anywhere in Supabase
- [ ] Data validation rejects bad numbers
- [ ] Service worker doesn't cache finance data
- [ ] Security Pod treats "empty" as inconclusive (not PASS)
- [ ] No cron setup (manual sync only for first 2 weeks)

---

# Session Log (newest at bottom)

## 2026-04-21
- **Session start.** Petra requested finance tab build. Read STORY.md + project_mission_control.md. Located GLM's plan. Did 11-point verify. Created this tracker + master plan archive. About to start Phase 0.0.
- **Flags raised during verify:** service-key-vs-user-auth walkback, schema changes (`bills_reserved`/`reserve_total`/`spendable_today` added, `manual_pending` dropped), vague "stub Bank tab," implicit manual-schedule default, `sync_bank_data.py` deletion missing from plan.
- **Phase 0.0 complete** — Petra retrieved UUID from Supabase Dashboard → Auth → Users, wrote it on paper. Not stored anywhere digital. Bangarang'd here.
- **Next:** Phase 0.1 — rotate Supabase service role key (destructive; new key needed for Phase 2 keyring storage).

## 2026-04-22 (SESSION 2)
- **Phase 0.1 DONE** — Created new Secret key in Supabase. Wrote it down on paper. Old service_role key now has a replacement waiting.
- **Phase 0.2 DONE** — Deleted SUPABASE_SERVICE_KEY + SUPABASE_URL from GitHub Secrets (Actions). SimpleFIN already gone (disabled weeks ago).
- **Phase 0.3 DONE** — Deleted `.github/workflows/sync-bank-data.yml` + `scripts/sync_bank_data.py` from repo. Committed + pushed.
- **Phase 0.4 DONE** — Purged 86 old sync-bank-data workflow runs from GitHub Actions (deleted via `gh run delete` + xargs). Old logs with leaked balances gone.
- **Phase 0.5 IN PROGRESS** — Originally planned to disable magic link. Changed direction: setting up Google OAuth (Sign in with Google) instead.
  - Found: Supabase Email provider was magic-link only. She wants Google OAuth (simpler, no password to manage).
  - In Google Cloud Console: created OAuth consent screen (App name: "Mission Control," support email: petdevo@gmail.com).
  - **Next:** Create OAuth 2.0 Client ID in Google Cloud, paste into Supabase.
- **Phase 0.6 (Stub Bank tab)** still pending after OAuth setup completes.
- **Context burn note:** Petra prefers multiple steps at once (not slow drip). Adjusted pacing mid-session.
