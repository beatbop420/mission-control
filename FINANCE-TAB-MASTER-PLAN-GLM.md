# MISSION CONTROL — FINANCE TAB MASTER BUILD PLAN v2
**Source:** GLM (OpenRouter) synthesis of 3 submissions + 2 red-team reports
**Date delivered:** 2026-04-20
**Status:** READY TO BE BUILT

This file is the FROZEN master reference. Do not edit.
Working progress lives in `FINANCE-TAB-PROGRESS.md`.

---

## Architecture Decision (Unanimous)

**Cloud bank sync is dead. Local-first from here on.**

```
SimpleFIN  ◄── access URL (keyring) ──  Your Laptop (Ubuntu)
                                             │
                                             │ supabase-py
                                             ▼ sanitized planning numbers
                                       Supabase finance_planning
                                             │
                                             │ anon key
                                             ▼
                                       GitHub Pages PWA (phone)
```

The PWA never calls localhost. Laptop pushes, phone pulls.

---

## Credential Decision: Service Key (v2)

| | Service Key (chosen) | User-Auth (future) |
|---|---|---|
| Blast radius if laptop compromised | Full DB admin | User-level only |
| Code complexity | Simple | Complex (refresh tokens) |
| Maintenance burden | Low | High |
| v2 pick | YES | Phase 8 upgrade path |

Trade-off documented: service key is worse on blast radius but simpler and less likely to break silently.

---

## PHASE 0 — Capture UUID + Scorched Earth (~45 min)

### 0.0 Get Your UUID (FIRST — before any destructive change)

**Method A — Browser console:**
1. Open PWA, log in
2. F12 → Console
3. Paste: `console.log("YOUR UUID:", (await supabase.auth.getUser()).data.user.id)`
4. Write UUID on paper

**Method B — Supabase Dashboard:**
Dashboard → Authentication → Users → copy `id` column value

Warning: UUID must match `auth.uid()`. If logged in via GitHub OAuth, the Supabase Auth dashboard UUID is still the correct one. Use that.

### 0.1 Rotate Supabase Service Key
Dashboard → Project Settings → API → Rotate service role key.
Write new key temporarily; stored in keyring in Phase 2.

### 0.2 Delete GitHub Secrets
- Settings → Secrets and variables → Actions → delete `SIMPLEFIN_ACCESS_URL`, `SUPABASE_SERVICE_KEY`
- Also check: Settings → Deploy Keys, Settings → Environments → Environment secrets

### 0.3 Delete Workflow File
Delete `.github/workflows/bank-sync.yml` (or `sync_bank_data.yml`). Commit, push.

### 0.4 Purge Historical Actions Logs
Actions → old bank-sync workflow → ⋮ → Delete all logs.
Or: `gh run list --workflow=bank-sync.yml --json databaseId -q '.[].databaseId'` then `gh run delete <RUN_ID>`.

### 0.5 Disable Supabase Signups
Dashboard → Authentication → Providers → Email → Disable Signups.
IMPORTANT: verify you can still log in with existing credentials before leaving the page. Save Supabase login somewhere safe off-laptop.

### 0.6 Stub the Bank Tab
Replace Bank pod content with: "Bank sync is now local-only. Run sync on your laptop to see data." Deploy and push.

**Exit criteria:** No bank credentials in any cloud system. Old service key dead. Old logs gone. UUID on paper. Bank tab stubbed. Can still log into Supabase.

---

## PHASE 1 — Lock the Database (~30 min)

### 1.1 Create `finance_planning` Table

Run in Supabase SQL Editor. Replace `HER-UUID` with your UUID:

```sql
CREATE TABLE finance_planning (
  user_id UUID PRIMARY KEY,
  safe_to_spend NUMERIC NOT NULL DEFAULT 0,
  bills_reserved NUMERIC NOT NULL DEFAULT 0,
  reserve_total NUMERIC NOT NULL DEFAULT 0,
  spendable_today NUMERIC NOT NULL DEFAULT 0,
  life_bucket NUMERIC NOT NULL DEFAULT 0,
  dopamine_bucket NUMERIC NOT NULL DEFAULT 0,
  safety_bucket NUMERIC NOT NULL DEFAULT 0,
  bills_due_before_payday NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE POLICY "finance_planning_select" ON finance_planning
  FOR SELECT TO authenticated USING (auth.uid() = 'HER-UUID');
CREATE POLICY "finance_planning_insert" ON finance_planning
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = 'HER-UUID');
CREATE POLICY "finance_planning_update" ON finance_planning
  FOR UPDATE TO authenticated USING (auth.uid() = 'HER-UUID');
CREATE POLICY "finance_planning_delete" ON finance_planning
  FOR DELETE TO authenticated USING (auth.uid() = 'HER-UUID');

ALTER TABLE finance_planning ENABLE ROW LEVEL SECURITY;
```

### 1.2 Drop `bank_cache`
```sql
DROP TABLE IF EXISTS bank_cache CASCADE;
```

### 1.3 Verify RLS (Correct Threat Model)

**Step A — Unauthenticated query must be DENIED:**
```bash
curl -s "https://YOUR-PROJECT.supabase.co/rest/v1/finance_planning" \
  -H "apikey: YOUR-ANON-KEY" \
  -H "Authorization: Bearer YOUR-ANON-KEY"
```
Expected: error like `{"message":"JWT subject is not authorized..."}`. NOT empty array `[]`.

**Step B — Your auth works:** Log in, Bank tab queries `finance_planning`, gets zero rows (empty table is correct), NOT an error.

**Step C — Wrong-user isolation (optional, requires temp signup enable):**
1. Re-enable signups in Supabase
2. Create throwaway account (different email)
3. Log in as throwaway → query `finance_planning` → MUST get permission denied, NOT zero rows
4. Delete throwaway
5. Re-disable signups

If Step C returns zero rows instead of an error, RLS policy is wrong. Do not proceed.

**Exit criteria:** `finance_planning` exists with per-UUID RLS. `bank_cache` gone. Unauthorized reads return errors, not empty results.

---

## PHASE 2 — Build the Local Sync Tool (~1.5 hours)

### 2.1 Install Dependencies
```bash
sudo apt update
sudo apt install python3-pip python3-venv libsecret-1-0 libsecret-1-dev
```

`libsecret-1-dev` is REQUIRED. Without it, Python keyring silently falls back to plaintext.

Verify libsecret works:
```bash
secret-tool store --label="test" mission-control test-key <<< "test-value"
secret-tool lookup mission-control test-key
# Should print: test-value
secret-tool clear mission-control test-key
```

If `secret-tool` fails, STOP. Keyring backend is not working.

### 2.2 Create Virtual Environment with Pinned Deps
```bash
cd ~/projects/mission-control
python3 -m venv .venv
source .venv/bin/activate
```

`requirements.txt`:
```
httpx==0.28.1
supabase==2.13.0
keyring==25.6.0
```

```bash
pip install -r requirements.txt
```

Add to `.gitignore`:
```
.venv/
__pycache__/
*.pyc
```

### 2.3 One-Time Credential Storage

Create `scripts/setup_credentials.py` (full code in GLM plan §2.3).

Key features:
- Detects plaintext keyring fallback and aborts with fix instructions
- Prompts for SimpleFIN URL + new Supabase service key (hidden input)
- Stores in keyring, verifies retrieval, then tells you to clear clipboard + close terminal

Run once: `python3 scripts/setup_credentials.py`

### 2.4 The Local Sync Script

Create `scripts/local_sync.py` (full code in GLM plan §2.4).

Key features:
- Verifies keyring backend on every run
- 3x retry with 5s delay on network errors
- `validate_payload()` rejects None, non-numeric, negative, implausibly large values
- Sets `updated_at` AFTER validation, right before upsert
- Uses service key to upsert to `finance_planning` keyed on `user_id`

Critical rules:
- No `print(SIMPLEFIN_URL)`
- No `print(SERVICE_KEY)`
- No `print(fin_data)` dumps
- If debugging, use `tempfile.NamedTemporaryFile` with `os.chmod(0o600)`. Add `*.debug` to `.gitignore`.

### 2.5 Test
```bash
source .venv/bin/activate
python3 scripts/local_sync.py
```
Expected: `Sync OK at 2026-04-20T...`
Verify row appears in Supabase Table Editor.

**Exit criteria:** Script runs, upserts, prints Sync OK. No creds in output. Validation passes. Keyring verified secure.

---

## PHASE 3 — Dashboard Wiring (~1 hour)

### 3.1 Point Frontend at `finance_planning`
Update Bank pod JS from `bank_cache` → `finance_planning`.

### 3.2 Add Freshness Indicator (code in GLM plan §3.2)
- No data → warn "Run sync on your laptop"
- Invalid timestamp → warn re-run
- >48h old → warn stale
- Otherwise → "Last synced Xh ago"

### 3.3 Generic Display Labels

| Field | Display As |
|---|---|
| `spendable_today` | Daily |
| `reserve_total` | Reserve |
| `bills_reserved` | Bills |
| `safe_to_spend` | Spendable |

No bank name. No last four. No institution identifiers.

### 3.4 Deploy and Verify on Phone
Push to GitHub → open PWA on phone → confirm planning numbers + freshness indicator.

**Exit criteria:** Dashboard shows planning numbers with generic labels + freshness indicator. No bank identity visible. Staleness warnings work.

---

## PHASE 4 — Re-Link and First Real Sync (~15 min)

### 4.1 Re-Link SimpleFIN
Log in to SimpleFIN, delete old connections, re-link bank from scratch.

### 4.2 Store New URL
Run `scripts/setup_credentials.py` with new URL.
Immediately: clear clipboard history, close terminal, clear clipboard manager.

### 4.3 First Real Sync
```bash
source .venv/bin/activate
python3 scripts/local_sync.py
```

### 4.4 Verify on Phone
Open PWA, numbers update, freshness = "Last synced 0h ago."

**Exit criteria:** Real numbers appear. Planning-derived only. Staleness indicator live.

---

## PHASE 5 — Full RLS Audit (~30 min)

### 5.1 Export All Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 5.2 Fix Every Table with Broad Access
For any user-data table with `USING (true)` or broad `TO authenticated`, apply per-UUID policy template (code in GLM plan §5.2).

### 5.3 Re-Probe Each Table
Unauthenticated curl → permission denied, NOT zero rows.

### 5.4 Fix Security Pod Probe
- Empty result = INCONCLUSIVE, not PASS
- PASS requires: unauthorized returns ERROR + authorized returns DATA

**Exit criteria:** Every user-data table enforces per-user isolation. Security Pod no longer false-passes on empty tables.

---

## PHASE 6 — Ops Hardening (~15 min)

1. Gmail 2FA = TOTP (not SMS)
2. SimpleFIN MFA if offered
3. LUKS disk encryption check: `lsblk -o NAME,TYPE,FSTYPE` → look for `crypto_LUKS`
4. GitHub recovery codes moved offline (paper, not in home dir)
5. Supabase login verified working from new browser

---

## PHASE 7 — Service Worker Review (~15 min)

DevTools → Application → Service Workers. Confirm `sw.js` does not cache `/rest/v1/finance_planning`.

If it does, add:
```javascript
if (event.request.url.includes('/rest/v1/')) {
  event.respondWith(fetch(event.request));
  return;
}
```

---

## OPERATIONAL RUNBOOK

### Daily/Weekly Use
```bash
cd ~/projects/mission-control && source .venv/bin/activate
python3 scripts/local_sync.py
```
Phone refreshes automatically.

### Automation — WAIT 2 WEEKS

Do NOT set up cron or systemd timers until manual sync has been reliable for 2 weeks.

**Cron will FAIL** (no D-Bus → keyring fails). Use **systemd user timer** (full config in GLM plan §Runbook).

### Disaster Recovery
Reinstall Ubuntu → install libsecret + python3-venv → clone repo → re-link bank → run setup_credentials.py → run local_sync.py → back online.

### What NEVER to Do Again
- Paste SimpleFIN URL into GitHub Secrets
- Run bank sync in GitHub Actions
- Save URL in a text file on SSD "just in case"
- Print secrets to console, even locally
- Add broad `USING (true)` RLS policies
- Treat empty query results as "security verified"
- Run `pip install` without version pinning
- Set up cron for sync (use systemd user timer)

---

## TRACK B — ASSISTANT PHASE 2 (After bank work complete)

Deferred. Keep existing stack. Deterministic logic engine with explainable surfacing. AI optional. Details in GLM plan §Track B.

---

## TRACK C — FUTURE SECURITY UPGRADES (Separate session)

- innerHTML audit (54 sites, DOMPurify)
- Migrate service key → user-scoped auth (after 2 weeks of reliable manual sync)
- SimpleFIN IP restrictions awareness
- Timestamp integrity checks

---

## VERIFICATION CHECKLIST (Final Gate)

- [ ] Keyring backend verified (setup_credentials.py confirmed secure)
- [ ] Unauthorized read blocked (error, not empty array)
- [ ] Authorized read works (your planning numbers visible)
- [ ] Wrong-user isolation tested (if Phase 1.3 Step C done)
- [ ] GitHub clean: no workflow, no secrets, no Actions logs
- [ ] Service key rotated (old key dead)
- [ ] SimpleFIN URL only in keyring (no .env, no password manager note, no SSD copy)
- [ ] Clipboard history cleared
- [ ] Freshness indicator working
- [ ] No bank identity in Supabase
- [ ] Data validation passes
- [ ] Service worker does not cache finance data
- [ ] Security Pod treats empty reads as inconclusive
- [ ] No cron yet (manual only first 2 weeks)

---

## FLAGS I (CLAUDE) IDENTIFIED DURING VERIFY — review with Petra

1. **Service key vs user-auth:** GLM picked service key, my 4/20 memory had us leaning user-auth. Legitimate walkback by GLM but confirm you're on board.
2. **Schema additions:** `bills_reserved`, `reserve_total`, `spendable_today` added. `manual_pending` dropped. If you track manual ACH separately, we may need to add it back.
3. **"Stub the Bank tab"** is vague — Money has 13 sub-tabs. We'll inventory which read `bank_cache` during Phase 0.6 / Phase 3.
4. **Schedule (A/B/C)** never explicitly picked. GLM defaults to C (manual). You need to consciously accept this or override.
5. **`scripts/sync_bank_data.py`** should also be deleted in Phase 0.3 — plan doesn't mention it explicitly.

---

## CHANGES FROM V1 (red-team corrections applied)

20 fixes applied, 6 deferred as over-engineering. Full table in the original GLM plan.
