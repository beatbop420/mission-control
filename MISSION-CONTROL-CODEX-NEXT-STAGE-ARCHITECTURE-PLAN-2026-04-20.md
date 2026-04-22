# Codex Submission — Mission Control Next-Stage Architecture / Build Plan
Date: 2026-04-20
Basis: local repo review at commit `c95ef4e`, current code inspection, and current handoff/security context

## 1. Executive Verdict

The next stage should be split into two separate tracks:

1. **Track A: Bank/security architecture simplification**
2. **Track B: Assistant Phase 2 logic + workflow build**

These should not be treated as one blended project.

My core recommendation is:
- **Do not restore the old GitHub Actions cloud bank-sync architecture**
- **Move bank sync to the user's laptop only**
- **Store only sanitized planning numbers in Supabase**
- **Then continue the Assistant roadmap using deterministic logic, not mystery AI**

This is the simplest architecture that meaningfully reduces risk while preserving the app's usefulness.

---

## 2. What Appears True Right Now

### Proven from current local code
- Assistant v1 already exists in the app.
- The Assistant already has a default `briefing` view in `assistant.js`.
- Task normalization already includes `tags`, `priority`, and `spoonCost`.
- `bank_cache` RLS is still too broad in `sql/rls-policies.sql`: authenticated users can read it with `USING (true)`.
- The Security Pod still false-passes `bank_cache` on empty-table reads.
- The current `sync_bank_data.py` stores aggregate account-level balance data, not transaction descriptions or merchant names.
- `sync_bank_data.py` comments still describe the old GitHub Actions model, even though that should no longer be the desired target architecture.

### Plausible but not fully proven here
- Supabase signups may still be enabled.
- Historical GitHub Actions logs may still contain previously leaked financial data and/or tokens.
- Other tables may also need an RLS audit.
- Some current "security hardening complete" claims are overstated relative to what the repo actually shows.

---

## 3. Architectural Decision

### The app should become two systems:
1. **A low-risk finance display layer**
2. **A smarter local-first assistant layer**

These should share the same app shell, but they should not share the same risk tolerance.

### Finance principle
The finance side should be treated as:
- narrow
- boring
- hard to misuse
- low-data
- low-identity
- low-secrets-in-cloud

### Assistant principle
The assistant side should be treated as:
- local-first
- deterministic
- explainable
- progressively more helpful
- optional-AI, not AI-dependent

---

## 4. Track A — Bank / Security Architecture

## A1. Kill the old cloud bank-sync model
Do not re-enable the GitHub Actions workflow as the main sync path.

Why:
- the old architecture already proved it could leak sensitive information through logs
- this is a single-user app, so cloud CI/CD is solving a complexity problem the product does not actually have
- future maintenance mistakes are more likely than sophisticated attacks

Target state:
- no bank credential in GitHub Secrets
- no unattended cloud job pulling financial data
- no requirement that cloud infrastructure ever see the raw bank connector credential

## A2. Move sync to the laptop only
The bank sync should run only on the user's Ubuntu laptop.

Recommended execution model:
- manual run when needed, or
- a local timer / cron / systemd user timer while the laptop is on

Credential storage:
- store the SimpleFIN credential only on the laptop
- prefer OS keyring / secret store
- acceptable fallback: encrypted local secret file
- do not store the credential in plaintext on the SSD backup or in the public repo

## A3. Change what gets stored in Supabase
Supabase should hold only a sanitized planning layer, not recognizable bank identity data.

Recommended stored fields:
- `safe_to_spend`
- `bills_reserved`
- `reserve_total`
- `spendable_today`
- `updated_at`
- optional generic coded buckets like `cash_pool_a`, `cash_pool_b`

Strong recommendation:
- do not store bank name
- do not store last four
- do not store routing/account numbers
- do not store transaction lists
- do not store merchant names
- do not store connector URLs/tokens

If multiple accounts must still be represented, use neutral internal labels only.

## A4. Lock down database access
`bank_cache` should become true single-user data.

Recommended policy shape:
- authenticated read allowed only when `auth.uid()` equals the real owner UUID

Also recommended:
- disable public signups if they are still enabled
- treat signups toggle as defense in depth, not as the primary wall
- rotate the Supabase service key before any new sync architecture goes live

## A5. Clean up old contamination
Before any new bank sync returns:
- purge old GitHub Actions logs for bank-sync runs
- rotate the Supabase service key
- assume the old cloud environment is contaminated until proven otherwise

## A6. Fix misleading security signals
The Security Pod should not claim success unless it has actually proven something meaningful.

Current problem:
- `bank_cache` probe treats "0 rows" as success, which can false-pass on an empty table

Required change in principle:
- empty table must be treated as inconclusive, not PASS
- green health UI should mean "best known state," not "fully secure"
- do not oversell security posture in the UI or docs

---

## 5. Track B — Assistant Phase 2 Architecture

## B1. Keep the existing stack
Do not rewrite the app.
Do not switch frameworks.
Keep:
- vanilla JS
- current pod pattern
- local-first `ast_*` storage
- current Assistant shell

This is the correct foundation for the next phase.

## B2. Build the actual logic engine
The next Assistant milestone should be deterministic triage.

Add or finish:
- `waitingUntil`
- `deferredUntil`
- `projectId`

Use existing fields properly:
- `tags`
- `priority`
- `spoonCost`

Core scoring inputs:
- deadline proximity
- critical bucket/domain tags
- priority weight
- stale detection
- current energy fit
- waiting/deferred state suppression or surfacing rules

## B3. Make surfacing explainable
Every surfaced card should say why it is there.

Reason labels should come from real logic such as:
- due today
- legal-tagged
- carried forward
- waiting on reply
- low-energy fit
- stale for 3 days

The assistant becomes "smart" by being legible, not magical.

## B4. Build modes in the ratified order
After the logic engine:
1. `Now` mode
2. `Projects`
3. active signaling
4. dump/routines refinement

### `Now`
Purpose:
- one-task isolation
- bad-brain execution
- minimal interpretation

### `Projects`
Purpose:
- group long-running work
- show next-step-first
- avoid flattening everything into a giant task list

### Active signaling
Purpose:
- user should not have to remember to check the app
- title count, badge, and cross-tab sync are good
- notifications should remain best-effort, not overpromised

## B5. Keep AI optional
AI should not become the decision engine for the assistant.

Good AI use:
- Capture + Plan drafting
- turning brain-dump into proposed steps
- summarization assistance

Bad AI use:
- hidden scoring logic
- opaque prioritization
- making the user guess why something surfaced

The core planner should still work if AI is unavailable.

---

## 6. Recommended Build Order

### Phase A1 — Security Reset
- purge old bank-sync logs
- rotate Supabase service key
- fix `bank_cache` RLS
- disable open signups if still on
- fix false-pass RLS probe behavior
- update stale comments/docs that describe the old cloud-sync model

Exit condition:
- no active dependency on the old cloud-secret architecture

### Phase A2 — Finance Data Minimization
- redesign `bank_cache` payload around planning numbers only
- remove bank identity from stored/displayed shape
- keep dashboard useful for "what can I safely spend?"

Exit condition:
- finance cloud data is useful but not institution-identifying

### Phase A3 — Local-Only Sync
- run sync from laptop only
- store credentials locally only
- push sanitized numbers to Supabase

Exit condition:
- phone can see latest planning numbers without cloud-held bank secrets

### Phase B1 — Assistant Logic Engine
- add `waitingUntil`, `deferredUntil`, `projectId`
- implement real scoring and surfaced-state rules
- improve reason labels

Exit condition:
- Assistant reliably explains why the 1 main + 2 support cards appear

### Phase B2 — Now + Projects
- build focused execution mode
- build project grouping and next-step view

Exit condition:
- big multi-step work is manageable without clutter

### Phase B3 — Signals + Refinement
- improve badge/title signaling
- cross-tab sync polish
- refine Dump and Routines
- keep notification promises conservative

Exit condition:
- Assistant becomes proactive without becoming noisy

---

## 7. Non-Negotiables

- No bank connector credential in GitHub Secrets
- No return to GitHub Actions bank sync
- No storage of bank identity if generic planning numbers are enough
- No pretending current security work is "fully done" when it is not
- No opaque AI planner replacing deterministic logic
- No broad authenticated read on `bank_cache`

---

## 8. Biggest Remaining Risk

The biggest remaining risk is not exotic hacking.
It is **future operator error**.

Examples:
- a secret saved in plaintext during testing
- permissive RLS added later
- misleading "security complete" assumptions
- unsafe rendering added during future feature work

That means the architecture must be **mistake-resistant**:
- fewer secrets in cloud paths
- smaller finance schema
- explicit one-user database policy
- deterministic assistant logic
- fewer moving parts

---

## 9. Final Recommendation

Mission Control should move toward this model:

- **Banking:** local-only sync, cloud holds only sanitized planning numbers
- **Assistant:** local-first deterministic executive assistant, with optional AI help only around capture/planning
- **Order of work:** simplify bank/security first, then finish Assistant Phase 2 logic, then expand modes and signaling

If the user's standard is "as secure as realistically possible for a personal app," this is the best next-stage direction I see from the current codebase and constraints.
