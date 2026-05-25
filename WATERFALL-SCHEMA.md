# The Waterfall — Canonical Foundation Schema
_Point Claude or Codex here at session start to get up to speed instantly._
_Last updated: 2026-05-04_

---

## What This File Is

This is the canonical foundation schema for the new Waterfall money system.

It is the source of truth for:
- the new money rules
- the pod architecture
- the privacy / lock layer
- what must be built new
- what old money-tab pieces are only a disabled parts bin

This is **not** the old schema anymore.
Where older documents conflict with this file, this file wins.

---

## Final Rules Source

Use this priority order when sources disagree:

1. This file
2. `~/Desktop/WATERFALL-LLM-HANDOFF.md`
3. Live conversation decisions made after the older schema
4. `~/Desktop/The Master Algorithm_ _The Waterfall_(1).txt`
5. `~/Desktop/Waterfall Schema.txt`

Important result:
- the old `Protection / P0` layer is no longer part of the foundation
- older insurance-first or tax-reserve logic is not active foundation behavior

---

## What The System Is

The Waterfall is a personal money engine.
It takes an income event and runs a fixed order of money decisions.

Its job is to answer:
- what must be paid now
- what should be set aside now
- whether the month is normal or tight
- what extra money should do next

The goal is a strong, simple foundation first.

---

## What Is Out Of Scope Right Now

- No `Protection` layer
- No insurance-first allocation
- No automatic `20%` side-income tax reserve
- No fixed front-end design yet
- No required bank-sync/cloud architecture in the foundation build
- No requirement yet for advanced forecasting, net worth, or victory-date screens as foundation behavior
- No `2FA` requirement in this schema

---

## Core Philosophy

- Required obligations come first
- Known future obligations should be prepared for before lifestyle spending
- Emergency savings should grow in steps based on how full it already is
- Living money should have a bare-minimum mode and a more comfortable mode
- Extra money should attack debt
- Tight months should be handled honestly instead of pretending everything works
- The money system should be private and locked, not just smart
- Output should be simple and action-based, not spreadsheet-heavy

---

## Engine Cadence

The engine should run on one cadence at a time.

Preferred current model:
- run once per paycheck or income event

Important rules:
- if stored numbers are monthly, they must be normalized to the active cadence before the waterfall runs
- money math should use exact currency handling like integer cents or decimal math
- do not use floating-point money math

---

## Final Waterfall Order

1. Must-Pay Bills
2. Future Bills
3. Cushion
4. Living Money
5. Debt Attack
6. Leftovers

---

## 1. Must-Pay Bills

This is the first real bucket.

It includes:
- rent
- utilities
- required bills
- debt minimum payments

Important rule:
- debt minimums are part of Must-Pay Bills, not a later bucket

If this bucket is not covered:
- the rest of the waterfall mostly stops
- the system should not act like the month is healthy

---

## 2. Future Bills

This is for known, predictable expenses that are not due today but are known ahead of time.

Examples:
- car registration
- renewals
- annual subscriptions
- holidays
- vet bills
- other planned irregular expenses

Important rule:
- save only what is still missing
- do not keep acting like the full goal is still unfunded

Correct formula:

```text
remaining_need = max(0, target_amount - current_balance)
per_period_contribution = remaining_need / periods_left
```

Example:
- target = 1200
- current balance = 600
- periods left = 12
- correct contribution = 50 per period

Wrong version:

```text
1200 / 12 = 100
```

That wrong version overfunds the category because it ignores the money already saved.

---

## 3. Cushion

This is the emergency fund / safety buffer.

It uses stair-step percentages based on how full it already is:
- under `50%` full: save `50%` of the available remainder
- under `90%` full: save `25%`
- under `100%` full: save `10%`
- at or above `100%` full: save `2%` maintenance

Important rules:
- the cushion has memory
- it must remember current balance between runs
- once full, it does not automatically drop to zero
- once full, it shifts to maintenance mode

---

## 4. Living Money

This is money for normal life.

Examples:
- groceries
- gas
- basic day-to-day spending

It has two user-defined target levels:
- `Survival / Sport`
- `Comfort / Luxury`

Meaning:
- Survival / Sport = bare minimum life amount
- Comfort / Luxury = more normal, less stressed amount

Rules:
- if money is tight, use the Survival amount
- if money is healthier, use the Comfort amount
- these are settings, not universal defaults

---

## 5. Debt Attack

This is where extra money goes after the earlier buckets are handled.

Rules:
- debt minimums were already handled in Must-Pay Bills
- this bucket is only for extra debt reduction
- default strategy should be Avalanche
- Avalanche means highest APR gets attacked first
- if one debt is paid off, extra money should spill over to the next debt in the same run

Important note:
- payoff forecasting, if added later, should be treated as an estimate
- it should not pretend to be magic exact truth in a variable-income multi-debt system

---

## 6. Leftovers

This is true extra money after everything else is handled.

Important rule:
- the exact split is not finalized yet

This bucket exists as a placeholder for money that is genuinely free after the real priorities are done.

---

## Survival Mode

Survival Mode is a special override for tight months.

General idea:
- normal cushion behavior pauses
- the system shifts into stricter rules

Agreed logic:
- if Must-Pay Bills are not covered, do not contribute to cushion
- if essentials are too underfunded, do not contribute to cushion
- if things are tight but not fully collapsing, the app may offer a tiny cushion deposit option

This means Survival Mode is not just "save less."
It is a different decision state.

---

## Tiny Cushion Option

This is a special user choice inside Survival Mode.

Agreed behavior:
- if conditions are too bad, no cushion deposit happens
- if Must-Pay Bills are covered and enough essentials are covered, the app should ask:

`Continue tiny cushion deposit?`

If the user says yes:
- deposit a very small amount

Current recommended version:
- `1%` of remaining money
- capped at a very small dollar amount

If there is no room:
- deposit `0`

Important note:
- the exact threshold for when this question appears is not fully locked yet
- the general rule is locked: do not ask this if the situation is too bad

---

## Withdrawal Gate

If income is too low, the system should be able to ask whether to pull from the cushion to cover the gap.

This must be explicit.
It must not silently drain the cushion.

Basic options:
- automatic exact shortfall
- manual amount
- zero / do not pull

Purpose:
- keep the user in control
- make cushion use visible and intentional

---

## Hard Stop / Impossible Month

The engine needs a formal honesty state.

Meaning:
- if Must-Pay Bills cannot be covered
- and the cushion cannot reasonably solve the gap
- the app should admit the waterfall cannot fix the month by itself

This prevents fake reassurance and fake “all set” outputs.

---

## Required Settings

At minimum, the engine should have explicit settings for:
- `active_cadence`
- `cushion_target`
- `survival_amount`
- `comfort_amount`
- `tiny_cushion_percent`
- `tiny_cushion_cap`
- `next_payday`
- `debt_strategy_default`

---

## Minimum Data Needed

At minimum the system needs:
- User settings
- Bills
- Future bill funds
- Cushion state
- Debt list
- Transaction history or ledger
- Income or paycheck history

---

## Record Shapes

### Bill records
- name
- amount
- due date
- recurring or not
- auto-pay or not
- category
- status like `unpaid`, `pending`, or `processed`

### Future bill fund records
- name
- target amount
- current balance
- due date or time remaining

### Debt records
- debt name
- current balance
- APR
- minimum payment
- due date
- original balance
- notes or type if needed

---

## Output Requirements

The engine output should answer:
- what must be paid now
- what should be set aside now
- what goes to Future Bills
- what goes to Cushion
- whether the month is normal or Survival Mode
- whether to ask the tiny cushion question
- what debt gets attacked next
- whether any real leftover money exists

It should feel like a short instruction list, not a complicated spreadsheet.

---

## Security / Lock Layer

This is foundation architecture, not an optional later extra.

The Waterfall is supposed to be:
- smart about money
- private about money

Foundation security requirements:
- local money data should be treated as locked/private
- use encryption for the money store
- use a user-defined PIN to unlock the protected money area
- include a hidden `Audit Vault` for the full scary details
- if cloud pieces are added later, use user-only access rules

Current foundation security baseline:
- SQLCipher for local encrypted storage
- PIN-derived key using PBKDF2
- hidden / locked audit access

Not in scope here:
- `2FA`
- full cloud sync design
- final biometric policy

---

## Pod Design

This is being built as a self-contained pod.

Target shape:
- `money-engine.js` — pure rules and math
- `money-pod.js` — renders into `#tab-money`, owns money UI state and actions
- `money-pod.css` — styles for the money pod only

Mount target in `index.html`:

```html
<div class="tab-page" id="tab-money"></div>
```

The new pod is the real system.
The old inline finance implementation is not the source of truth.

---

## Disabled Salvage Layer

The old money tab is a parts bin, not the brain.

Rules:
- nothing from the old build is active by default
- nothing from the old build is reused automatically
- old pieces may only be plugged in later with explicit approval
- the architecture should leave clean placeholders where future reuse could connect

Think of the old system as:
- available material
- not active logic

---

## Available Parts Bin

These old pieces are useful references and possible future plug-ins:
- bill tracking structure
- debt record structure
- starter data / storage categories
- sinking-fund record shape
- debt summary math
- transaction log ideas
- bill payment history ideas
- timeline / annual ledger ideas
- manual pending / reconciliation idea
- advisor-style plain-language output idea
- payday timing idea

---

## Do Not Reuse Unless Approved

Do not use these as the new core logic:
- old allocation math
- old bucket brain
- old sinking-fund contribution logic
- old waterfall split rules
- old finance UI flow as source of truth

---

## Build New

These pieces must be built new:
- stair-step cushion engine
- Survival Mode engine
- tiny cushion prompt logic
- Withdrawal Gate logic
- debt spillover engine
- new local storage boundary
- new plain-language waterfall output

---

## Placeholder Hooks

Leave clean empty plug-in points for later if needed:
- future bill import hook
- debt import hook
- ledger/history adapter hook
- reconciliation adapter hook
- payday adapter hook
- optional sync adapter hook

These are placeholders only.
They are not active features in the foundation build.

---

## Current State (as of 2026-05-04)

**Done:**
- old money tab HTML/JS/CSS archived in `finance-archive/`
- `#tab-money` is an empty mount point ready for the new pod
- active money tab rendering was removed from the live tab container
- the final simplified waterfall rules are now captured in the Desktop handoff and this schema
- `money-engine.js` now exists as the pure waterfall math layer for the demo / pod

**Not done yet:**
- `money-pod.js`
- `money-pod.css`
- exact front-end design
- any approved salvage adapters

**Important note on old code:**
The old finance CSS and JS still exist in `index.html` because some helper functions are used elsewhere in the dashboard.
Do not rip them out blindly before the new pod is stable.

---

## Key Files

| File | What It Is |
|---|---|
| `~/Desktop/The Master Algorithm_ _The Waterfall_(1).txt` | Original deep-dive algorithm and security reasoning |
| `~/Desktop/Waterfall Schema.txt` | Older 7-brick schema prompt set |
| `~/Desktop/WATERFALL-LLM-HANDOFF.md` | Current plain-language handoff of the agreed rules |
| `~/Desktop/get fucked/mission-control/finance-archive/` | Archived old money tab code |
| `~/Desktop/get fucked/mission-control/money-engine.js` | The pure waterfall math engine now loaded by the app shell |
| `~/Desktop/get fucked/mission-control/WATERFALL-SCHEMA.md` | This canonical foundation schema |
| `~/Desktop/get fucked/mission-control/index.html` | The app shell with the `#tab-money` mount point |
