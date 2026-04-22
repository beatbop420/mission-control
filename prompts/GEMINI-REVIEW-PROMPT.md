# Review Request: Assistant Tab for Mission Control

## What I Need From You

I need you to review code that Codex built for my Mission Control PWA. Codex was supposed to just review the spec — instead it went rogue and built the whole thing. Claude already did an objective review and found some issues. Now I want your independent take.

**Review the code against the spec. Tell me what's good, what's broken, what's missing, and what you'd change.** Be direct and specific. Don't sugarcoat it.

---

## Context

Mission Control is my life dashboard — a PWA (Progressive Web App) that runs in the browser. It's a single `index.html` file (~7900 lines) with all CSS in a `<style>` block and all JS in a `<script>` block. No frameworks, no build tools, pure vanilla HTML/CSS/JS. It has 4 tabs: Right Now, Body, Money, Life.

We're adding a 5th tab called **Assistant** — a task manager with energy tracking, focus tasks, and a task list. It's built as a **self-contained pod**: its own JS file, its own CSS file, its own localStorage keys. You could delete it and the rest of the dashboard works fine. This is the first test of a "pod" architecture we're planning for a bigger app later.

---

## The Spec (What It Should Do)

Here's the full spec that Codex was given:

---

### New Files

| File | Purpose |
|------|---------|
| `assistant.js` | ALL Assistant logic — data, CRUD, rendering, interactions |
| `assistant.css` | ALL Assistant styling — every class prefixed `ast-` |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Add: CSS link, tab button with badge, empty `<div id="tab-assistant">`, script tag, bridge object (~20 lines total) |
| `sw.js` | Add `assistant.js` + `assistant.css` to cache list, bump cache version |

### Data Isolation
- All localStorage keys prefixed `ast_` (dashboard uses `mc_`)
- Keys: `ast_tasks`, `ast_energy`, `ast_settings`, `ast_version`

### Dashboard Bridge
Dashboard provides `window.MissionControl`:
- `getBodyStatus()` — body forecast text
- `getSafeToSpend()` — safe-to-spend amount
- `saveData(key, value)` / `loadData(key)` — for future Supabase sync
- `setBadgeCount(tabId, count)` — show overdue count on tab button

Assistant provides `window.Assistant`:
- `getDueCount()` — overdue + due-today count
- `getTopThree()` — current focus tasks
- `getEnergyLevel()` — current energy
- `refresh()` — force re-render

**If either side is missing, the other still works. No crashes.**

### Data Model

Every task:
```
id, title, description, type ("non-routine"/"routine")
status ("not_started"/"in_progress"/"done")
createdAt, updatedAt, dueDate (ISO YYYY-MM-DD), isOngoing, isTopThree, topThreeOrder
steps: [{ id, text, done, order }]
completedAt, sortOrder
--- future fields (included now, not wired yet) ---
priority, tags, spoonCost, calendarSyncId, recurrence, notifyAt, notifyBefore, parentId, archivedAt
```

Energy state:
```
level (1-10), max (10), updatedAt, history: [{ date, level }] (last 30 days)
```

### UI Layout (top to bottom)

**A. Energy Bar** — Full-width gradient bar (green→yellow→red), tap anywhere to set level 1-10. Shows "6/10" and label:
- 1-3: "Running on fumes. Bare minimum only." (red)
- 4-6: "Some gas in the tank. Pace yourself." (yellow)
- 7-10: "Good energy. Get after it." (green)

**B. Top 3 Focus** — 3 slots stacked vertical. Filled = checkbox + title + due date + step progress + × to remove. Empty = dashed outline "+ Pick a focus task" (opens picker). Checking = completes task AND removes from Top 3. Sparkles on completion.

**C. Non-Routine Tasks** — Filter pills (All/Active/Done, default Active). Task rows: status dot (gray/rose/green) + title + due date + chevron. Overdue = warm glow border. Expanded: description, checkable steps, status buttons (Not Started/In Progress/Done), action buttons (Add to Focus/Edit/Delete). "+ Add Task" dashed button at bottom. Sort: overdue first → soonest due → no date last. Done tasks by most recent completion.

**D. Routine Tasks** — Placeholder only. "Coming soon" in dashed card.

**E. Add/Edit Modal** — Overlay with dark backdrop. Title (required), Description (optional), Due date + "No date" checkbox, "Ongoing project" toggle, "Break into steps?" toggle with step builder. Save/Cancel buttons. Title validation (red border if empty).

### Design Language (Must Match Dashboard)
- Background: `#1a1216`
- Card background: `#2a1f24`, border-left `4px solid #d4849a`, border-radius `12px`
- Card box-shadow: `0 1px 8px rgba(212, 132, 154, 0.06)` (very subtle)
- Primary accent: `#d4849a` (dusty rose)
- Text: `#d4ccc8` primary, `#9a8a92` muted, `#ffffff` headings
- Font: Lexend (already loaded)
- All tap targets minimum 44px
- Max-width 600px centered container
- Mobile breakpoint at 600px

### Other Requirements
- Sparkles on task completion (call existing `spawnSparkles(x, y, 12)` if available)
- 60-second interval checking overdue tasks and updating badge count
- No external dependencies
- No Supabase sync yet (localStorage only for assistant data)

---

## Claude's Review (What Was Already Found)

Claude read every line and found these issues:

**1. Energy bar tap math is off (assistant.js line 1094)**
Formula `Math.round(ratio * (ENERGY_MAX - 1)) + 1` creates uneven distribution — edges of the bar are less responsive than the middle. Suggested `Math.ceil(ratio * 10)` with `Math.max(1, ...)` guard.

**2. Modal re-renders nuke cursor position**
Toggling "No due date" or "Break into steps" calls `captureModalDraft()` then `render()`, which rebuilds the entire DOM. Text content is preserved but cursor position is lost.

**3. `showToast` doesn't exist**
Line 329 calls `window.showToast` but the dashboard has no such function. So "Focus is full" notification silently does nothing. Not a crash, but no user feedback.

**4. No keyboard support on modal**
Can't press Enter to save or Escape to close.

**5. Full DOM rebuild on every interaction**
`render()` replaces all children every time. Fine for small task lists, could get sluggish at 50+ tasks.

**6. Card shadow is heavier than dashboard**
Dashboard uses `0 1px 8px rgba(212, 132, 154, 0.06)`. Codex used `0 10px 24px rgba(0, 0, 0, 0.18)`. Assistant cards will look "floatier."

**7. Task row uses transparency where dashboard doesn't**
`rgba(42, 31, 36, 0.72)` instead of solid `#2a1f24`.

**8. No migration logic for `ast_version`**
Version is set to 1 but there's no migration code. Just a number sitting in localStorage.

---

## The Actual Code

### assistant.css (585 lines)

```css
.ast-root {
    --ast-bg: #1a1216;
    --ast-card: #2a1f24;
    --ast-border: #3d2f35;
    --ast-accent: #d4849a;
    --ast-text: #d4ccc8;
    --ast-text-muted: #9a8a92;
    --ast-text-heading: #ffffff;
    --ast-success: #4ade80;
    --ast-warning: #facc15;
    --ast-danger: #f87171;
    color: var(--ast-text);
    font-family: 'Lexend', sans-serif;
}

.ast-shell {
    max-width: 600px;
    margin: 0 auto;
    display: grid;
    gap: 16px;
}

.ast-card {
    background: var(--ast-card);
    border: 1px solid var(--ast-border);
    border-left: 4px solid var(--ast-accent);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.ast-card h2,
.ast-section-title {
    margin: 0 0 12px;
    color: var(--ast-text-muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.1px;
    text-transform: uppercase;
}

.ast-energy-hitbox {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
}

.ast-energy-bar {
    position: relative;
    width: 100%;
    height: 28px;
    border-radius: 14px;
    overflow: hidden;
    background: var(--ast-border);
}

.ast-energy-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 14px;
    background: linear-gradient(90deg, #4ade80, #facc15, #f87171);
    transition: width 0.2s ease;
}

.ast-energy-meta {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ast-energy-value {
    color: var(--ast-text-heading);
    font-size: 18px;
    font-weight: 700;
}

.ast-energy-label {
    font-size: 14px;
    line-height: 1.5;
}

.ast-top3-list,
.ast-task-list {
    display: grid;
    gap: 10px;
}

.ast-focus-slot,
.ast-task-row,
.ast-picker-option {
    min-height: 44px;
}

.ast-focus-task {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.ast-checkbox-btn,
.ast-icon-btn {
    border: 1px solid var(--ast-border);
    background: var(--ast-bg);
    color: var(--ast-text-muted);
    border-radius: 999px;
    min-width: 32px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font: inherit;
}

.ast-checkbox-btn:hover,
.ast-icon-btn:hover {
    border-color: var(--ast-accent);
    color: var(--ast-text-heading);
}

.ast-checkbox-btn.ast-done {
    background: rgba(74, 222, 128, 0.16);
    border-color: rgba(74, 222, 128, 0.4);
    color: var(--ast-success);
}

.ast-focus-main {
    flex: 1;
    min-width: 0;
}

.ast-focus-title {
    color: var(--ast-text-heading);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    word-break: break-word;
}

.ast-focus-detail {
    margin-top: 4px;
    color: var(--ast-text-muted);
    font-size: 13px;
}

.ast-empty-slot,
.ast-add-card,
.ast-placeholder-card {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    padding: 14px 16px;
    border: 2px dashed var(--ast-border);
    border-radius: 12px;
    background: transparent;
    color: var(--ast-text-muted);
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font: inherit;
}

.ast-empty-slot:hover,
.ast-add-card:hover {
    border-color: var(--ast-accent);
    color: var(--ast-text);
}

.ast-filter-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.ast-filter-pill,
.ast-status-btn,
.ast-action-btn,
.ast-save-btn,
.ast-cancel-btn {
    min-height: 44px;
    border-radius: 10px;
    font-family: 'Lexend', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.ast-filter-pill {
    padding: 6px 14px;
    border: 1px solid var(--ast-border);
    background: transparent;
    color: var(--ast-text-muted);
    flex: 1;
}

.ast-filter-pill:hover {
    border-color: var(--ast-accent);
    color: var(--ast-text);
}

.ast-filter-pill.ast-active {
    background: var(--ast-accent);
    border-color: var(--ast-accent);
    color: #fff;
    font-weight: 600;
}

.ast-task-row {
    border: 1px solid var(--ast-border);
    border-radius: 12px;
    background: rgba(42, 31, 36, 0.72);
    padding: 12px 14px;
    transition: all 0.2s ease;
}

.ast-task-row.ast-overdue {
    box-shadow: 0 0 8px rgba(248, 113, 113, 0.3);
    border-color: rgba(248, 113, 113, 0.4);
}

.ast-task-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: transparent;
    border: 0;
    padding: 0;
    color: inherit;
    cursor: pointer;
    text-align: left;
}

.ast-task-status {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 auto;
}

.ast-status-not_started {
    background: var(--ast-text-muted);
}

.ast-status-in_progress {
    background: var(--ast-accent);
}

.ast-status-done {
    background: var(--ast-success);
}

.ast-task-title-wrap {
    flex: 1;
    min-width: 0;
}

.ast-task-title {
    color: var(--ast-text-heading);
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ast-task-row.ast-expanded .ast-task-title {
    white-space: normal;
}

.ast-task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ast-text-muted);
    font-size: 13px;
}

.ast-task-chevron {
    color: var(--ast-text-muted);
    font-size: 18px;
    line-height: 1;
}

.ast-task-body {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(154, 138, 146, 0.14);
    display: grid;
    gap: 12px;
}

.ast-task-description {
    color: var(--ast-text-muted);
    font-size: 14px;
    line-height: 1.55;
    white-space: pre-wrap;
}

.ast-step-progress {
    color: var(--ast-text-muted);
    font-size: 13px;
}

.ast-step-list {
    display: grid;
    gap: 8px;
}

.ast-step-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ast-text);
    font-size: 14px;
}

.ast-step-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--ast-accent);
    flex: 0 0 auto;
}

.ast-step-text.ast-step-done {
    color: var(--ast-text-muted);
    text-decoration: line-through;
}

.ast-status-row,
.ast-action-row,
.ast-modal-actions,
.ast-inline-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.ast-status-btn,
.ast-action-btn,
.ast-save-btn,
.ast-cancel-btn,
.ast-picker-option {
    padding: 10px 14px;
    border: 1px solid var(--ast-border);
    background: transparent;
    color: var(--ast-text);
}

.ast-status-btn:hover,
.ast-action-btn:hover,
.ast-cancel-btn:hover,
.ast-picker-option:hover {
    border-color: var(--ast-accent);
}

.ast-status-btn.ast-active[data-status="not_started"] {
    background: rgba(154, 138, 146, 0.16);
    border-color: rgba(154, 138, 146, 0.4);
}

.ast-status-btn.ast-active[data-status="in_progress"] {
    background: rgba(212, 132, 154, 0.16);
    border-color: rgba(212, 132, 154, 0.5);
}

.ast-status-btn.ast-active[data-status="done"] {
    background: rgba(74, 222, 128, 0.16);
    border-color: rgba(74, 222, 128, 0.45);
}

.ast-action-btn.ast-primary,
.ast-save-btn {
    background: var(--ast-accent);
    border-color: var(--ast-accent);
    color: #fff;
    font-weight: 600;
}

.ast-add-card {
    margin-top: 4px;
}

.ast-placeholder-card {
    cursor: default;
    line-height: 1.5;
}

.ast-empty-state {
    color: var(--ast-text-muted);
    font-size: 14px;
    line-height: 1.55;
}

.ast-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.ast-modal,
.ast-picker {
    width: min(500px, 95vw);
    max-height: min(90vh, 720px);
    overflow-y: auto;
    background: var(--ast-card);
    border: 1px solid var(--ast-border);
    border-left: 4px solid var(--ast-accent);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.ast-modal-title {
    margin: 0 0 16px;
    color: var(--ast-text-heading);
    font-size: 20px;
    font-weight: 700;
}

.ast-field {
    display: grid;
    gap: 6px;
    margin-bottom: 14px;
}

.ast-label {
    color: var(--ast-text);
    font-size: 13px;
    font-weight: 500;
}

.ast-input,
.ast-textarea,
.ast-date-input {
    width: 100%;
    border: 1px solid var(--ast-border);
    border-radius: 8px;
    background: var(--ast-bg);
    color: var(--ast-text);
    padding: 10px 12px;
    font: inherit;
    font-size: 15px;
}

.ast-textarea {
    min-height: 80px;
    resize: vertical;
}

.ast-input:focus,
.ast-textarea:focus,
.ast-date-input:focus {
    outline: none;
    border-color: var(--ast-accent);
    box-shadow: 0 0 0 3px rgba(212, 132, 154, 0.14);
}

.ast-input.ast-error {
    border-color: var(--ast-danger);
    box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.14);
}

.ast-check-row {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ast-text);
    font-size: 14px;
    margin-bottom: 10px;
}

.ast-check-row input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--ast-accent);
    flex: 0 0 auto;
}

.ast-step-builder {
    display: grid;
    gap: 8px;
    margin-top: 8px;
}

.ast-step-editor-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.ast-step-editor-row .ast-input {
    flex: 1;
}

.ast-step-delete {
    min-width: 40px;
    min-height: 40px;
}

.ast-picker-title {
    margin: 0 0 12px;
    color: var(--ast-text-heading);
    font-size: 18px;
    font-weight: 700;
}

.ast-picker-list {
    display: grid;
    gap: 8px;
    margin-bottom: 12px;
}

.ast-picker-option {
    width: 100%;
    text-align: left;
    border-radius: 10px;
    background: rgba(26, 18, 22, 0.4);
}

.ast-picker-title-row {
    color: var(--ast-text-heading);
    font-size: 14px;
    font-weight: 600;
}

.ast-picker-detail-row {
    margin-top: 4px;
    color: var(--ast-text-muted);
    font-size: 12px;
}

.ast-modal-actions {
    margin-top: 18px;
    justify-content: flex-end;
}

@media (max-width: 600px) {
    .ast-root {
        font-size: 14px;
    }

    .ast-shell {
        gap: 14px;
    }

    .ast-card {
        padding: 14px;
    }

    .ast-filter-row {
        gap: 6px;
    }

    .ast-filter-pill {
        flex: 1;
    }

    .ast-modal,
    .ast-picker {
        width: 95%;
        padding: 18px;
    }

    .ast-action-row > *,
    .ast-status-row > * {
        flex: 1 1 calc(50% - 8px);
    }
}
```

### assistant.js (1158 lines)

```js
(function() {
    'use strict';

    const TASKS_KEY = 'ast_tasks';
    const ENERGY_KEY = 'ast_energy';
    const SETTINGS_KEY = 'ast_settings';
    const VERSION_KEY = 'ast_version';
    const CURRENT_VERSION = 1;
    const ENERGY_MAX = 10;
    const ENERGY_DEFAULT = 5;
    const FILTERS = ['all', 'active', 'done'];

    const state = {
        tasks: [],
        energy: null,
        settings: null,
        filter: 'active',
        expandedTaskId: null,
        pickerSlot: null,
        modal: null
    };

    let host = null;
    let badgeIntervalId = null;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function todayLocalStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function parseDateOnly(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatDate(dateStr) {
        const date = parseDateOnly(dateStr);
        if (!date) return 'No due date';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function isToday(dateStr) {
        return !!dateStr && dateStr === todayLocalStr();
    }

    function isOverdue(task) {
        if (!task || task.status === 'done' || task.isOngoing || !task.dueDate) return false;
        const due = parseDateOnly(task.dueDate);
        const today = parseDateOnly(todayLocalStr());
        return !!due && !!today && due < today;
    }

    function isDueSoon(task) {
        return !!task && task.status !== 'done' && !task.isOngoing && isToday(task.dueDate);
    }

    function getDueCount() {
        return state.tasks.filter(task => isOverdue(task) || isDueSoon(task)).length;
    }

    function getEnergyLabel(level) {
        if (level <= 3) {
            return {
                text: 'Running on fumes. Bare minimum only.',
                color: '#f87171'
            };
        }
        if (level <= 6) {
            return {
                text: 'Some gas in the tank. Pace yourself.',
                color: '#facc15'
            };
        }
        return {
            text: 'Good energy. Get after it.',
            color: '#4ade80'
        };
    }

    function defaultEnergy() {
        return {
            level: ENERGY_DEFAULT,
            max: ENERGY_MAX,
            updatedAt: nowIso(),
            history: []
        };
    }

    function defaultSettings() {
        return {
            showRoutine: false,
            defaultView: 'active'
        };
    }

    function makeTaskId() {
        return 'ast_' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    function makeStepId() {
        return 's_' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    function normalizeStep(step, index) {
        return {
            id: step && step.id ? step.id : makeStepId(),
            text: step && typeof step.text === 'string' ? step.text : '',
            done: !!(step && step.done),
            order: step && Number.isFinite(step.order) ? step.order : index + 1
        };
    }

    function normalizeTask(task, index) {
        const createdAt = task && task.createdAt ? task.createdAt : nowIso();
        const updatedAt = task && task.updatedAt ? task.updatedAt : createdAt;
        const status = task && ['not_started', 'in_progress', 'done'].includes(task.status) ? task.status : 'not_started';
        const steps = Array.isArray(task && task.steps) ? task.steps.map(normalizeStep) : [];
        return {
            id: task && task.id ? task.id : makeTaskId(),
            title: task && typeof task.title === 'string' ? task.title : '',
            description: task && typeof task.description === 'string' ? task.description : '',
            type: task && task.type === 'routine' ? 'routine' : 'non-routine',
            status: status,
            createdAt: createdAt,
            updatedAt: updatedAt,
            dueDate: task && task.dueDate ? task.dueDate : null,
            isOngoing: !!(task && task.isOngoing),
            isTopThree: !!(task && task.isTopThree),
            topThreeOrder: task && Number.isFinite(task.topThreeOrder) ? task.topThreeOrder : null,
            steps: steps,
            completedAt: status === 'done' ? (task && task.completedAt ? task.completedAt : updatedAt) : null,
            sortOrder: task && Number.isFinite(task.sortOrder) ? task.sortOrder : index,
            priority: task && task.priority ? task.priority : null,
            tags: Array.isArray(task && task.tags) ? task.tags : [],
            spoonCost: task && Number.isFinite(task.spoonCost) ? task.spoonCost : null,
            calendarSyncId: task && task.calendarSyncId ? task.calendarSyncId : null,
            recurrence: task && task.recurrence ? task.recurrence : null,
            notifyAt: task && task.notifyAt ? task.notifyAt : null,
            notifyBefore: task && Number.isFinite(task.notifyBefore) ? task.notifyBefore : null,
            parentId: task && task.parentId ? task.parentId : null,
            archivedAt: task && task.archivedAt ? task.archivedAt : null
        };
    }

    function normalizeEnergy(energy) {
        const base = defaultEnergy();
        const incoming = energy && typeof energy === 'object' ? energy : {};
        const level = Math.min(ENERGY_MAX, Math.max(1, parseInt(incoming.level, 10) || ENERGY_DEFAULT));
        const history = Array.isArray(incoming.history) ? incoming.history.filter(item => item && item.date && Number.isFinite(item.level)) : [];
        return {
            level: level,
            max: ENERGY_MAX,
            updatedAt: incoming.updatedAt || base.updatedAt,
            history: history.slice(-30)
        };
    }

    function loadState() {
        const rawTasks = readJson(TASKS_KEY, []);
        state.tasks = Array.isArray(rawTasks) ? rawTasks.map(normalizeTask) : [];
        state.energy = normalizeEnergy(readJson(ENERGY_KEY, defaultEnergy()));
        state.settings = Object.assign(defaultSettings(), readJson(SETTINGS_KEY, defaultSettings()));
        state.filter = FILTERS.includes(state.settings.defaultView) ? state.settings.defaultView : 'active';
        localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    }

    function saveTasks() {
        writeJson(TASKS_KEY, state.tasks);
        updateBadge();
    }

    function saveEnergy() {
        writeJson(ENERGY_KEY, state.energy);
    }

    function saveSettings() {
        state.settings.defaultView = state.filter;
        writeJson(SETTINGS_KEY, state.settings);
    }

    function getTaskById(taskId) {
        return state.tasks.find(task => task.id === taskId) || null;
    }

    function getTopThree() {
        return state.tasks
            .filter(task => task.isTopThree && task.topThreeOrder)
            .sort((a, b) => a.topThreeOrder - b.topThreeOrder)
            .slice(0, 3);
    }

    function topThreeSlots() {
        const slots = [null, null, null];
        getTopThree().forEach(task => {
            if (task.topThreeOrder >= 1 && task.topThreeOrder <= 3) {
                slots[task.topThreeOrder - 1] = task;
            }
        });
        return slots;
    }

    function getEmptyTopThreeSlot() {
        const slots = topThreeSlots();
        for (let i = 0; i < slots.length; i += 1) {
            if (!slots[i]) return i + 1;
        }
        return null;
    }

    function availableFocusTasks() {
        return state.tasks
            .filter(task => task.type === 'non-routine' && task.status !== 'done' && !task.isTopThree)
            .sort(compareActiveTasks);
    }

    function compareActiveTasks(a, b) {
        const aOverdue = isOverdue(a) ? 1 : 0;
        const bOverdue = isOverdue(b) ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        if (a.dueDate && b.dueDate) {
            const aDate = parseDateOnly(a.dueDate);
            const bDate = parseDateOnly(b.dueDate);
            if (aDate && bDate && aDate.getTime() !== bDate.getTime()) {
                return aDate - bDate;
            }
        }

        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    }

    function compareDoneTasks(a, b) {
        return new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt);
    }

    function filteredTasks() {
        const tasks = state.tasks.filter(task => task.type === 'non-routine');
        if (state.filter === 'active') {
            return tasks.filter(task => task.status !== 'done').sort(compareActiveTasks);
        }
        if (state.filter === 'done') {
            return tasks.filter(task => task.status === 'done').sort(compareDoneTasks);
        }

        const active = tasks.filter(task => task.status !== 'done').sort(compareActiveTasks);
        const done = tasks.filter(task => task.status === 'done').sort(compareDoneTasks);
        return active.concat(done);
    }

    function taskStepProgress(task) {
        const total = task.steps.length;
        const done = task.steps.filter(step => step.done).length;
        return {
            total: total,
            done: done
        };
    }

    function taskMetaLine(task) {
        const pieces = [];
        if (task.dueDate) pieces.push('Due: ' + formatDate(task.dueDate));
        if (task.steps.length > 0) {
            const progress = taskStepProgress(task);
            pieces.push(progress.done + '/' + progress.total + ' steps');
        }
        if (pieces.length === 0) pieces.push('No due date');
        return pieces.join(' · ');
    }

    function taskListMeta(task) {
        if (!task.dueDate) return '';
        return formatDate(task.dueDate);
    }

    function triggerSparkles(event) {
        if (typeof window.spawnSparkles !== 'function') return;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            x = event.clientX;
            y = event.clientY;
        } else if (event && event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            const rect = event.currentTarget.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }

        window.spawnSparkles(x, y, 12);
    }

    function notify(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        }
    }

    function clearTopThree(task) {
        task.isTopThree = false;
        task.topThreeOrder = null;
    }

    function assignTopThree(task, slot) {
        if (!task || !slot) return;
        state.tasks.forEach(other => {
            if (other.id !== task.id && other.topThreeOrder === slot) {
                clearTopThree(other);
            }
        });
        task.isTopThree = true;
        task.topThreeOrder = slot;
    }

    function addTaskToFocus(taskId, slot) {
        const task = getTaskById(taskId);
        if (!task) return;
        const targetSlot = slot || getEmptyTopThreeSlot();
        if (!targetSlot) {
            notify('Focus is full');
            return;
        }
        assignTopThree(task, targetSlot);
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function removeTaskFromFocus(taskId) {
        const task = getTaskById(taskId);
        if (!task) return;
        clearTopThree(task);
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function setTaskStatus(taskId, status, event) {
        const task = getTaskById(taskId);
        if (!task || task.status === status) return;

        task.status = status;
        task.updatedAt = nowIso();

        if (status === 'done') {
            task.completedAt = task.updatedAt;
            clearTopThree(task);
            triggerSparkles(event);
        } else {
            task.completedAt = null;
        }

        saveTasks();
        render();
    }

    function toggleTaskStep(taskId, stepId, done) {
        const task = getTaskById(taskId);
        if (!task) return;
        const step = task.steps.find(item => item.id === stepId);
        if (!step) return;
        step.done = done;
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function deleteTask(taskId) {
        const before = state.tasks.length;
        state.tasks = state.tasks.filter(task => task.id !== taskId);
        if (state.tasks.length === before) return;
        if (state.expandedTaskId === taskId) state.expandedTaskId = null;
        saveTasks();
        render();
    }

    function setEnergyLevel(level) {
        const clamped = Math.min(ENERGY_MAX, Math.max(1, level));
        state.energy.level = clamped;
        state.energy.max = ENERGY_MAX;
        state.energy.updatedAt = nowIso();

        const today = todayLocalStr();
        const history = Array.isArray(state.energy.history) ? state.energy.history.slice() : [];
        const existing = history.find(entry => entry.date === today);
        if (existing) {
            existing.level = clamped;
        } else {
            history.push({ date: today, level: clamped });
        }
        state.energy.history = history.slice(-30);
        saveEnergy();
        render();
    }

    function setFilter(filter) {
        if (!FILTERS.includes(filter)) return;
        state.filter = filter;
        saveSettings();
        render();
    }

    function openPicker(slot) {
        state.pickerSlot = slot;
        render();
    }

    function closePicker() {
        state.pickerSlot = null;
        render();
    }

    function taskToDraft(task) {
        const source = task || null;
        return {
            mode: source ? 'edit' : 'add',
            taskId: source ? source.id : null,
            title: source ? source.title : '',
            description: source ? source.description : '',
            dueDate: source && source.dueDate ? source.dueDate : '',
            noDueDate: !(source && source.dueDate),
            isOngoing: !!(source && source.isOngoing),
            stepsEnabled: !!(source && source.steps && source.steps.length > 0),
            steps: source && source.steps ? source.steps.map(step => ({
                id: step.id,
                text: step.text,
                done: !!step.done,
                order: step.order
            })) : [],
            titleError: false
        };
    }

    function openTaskModal(taskId) {
        const task = taskId ? getTaskById(taskId) : null;
        state.modal = taskToDraft(task);
        render();
    }

    function closeTaskModal() {
        state.modal = null;
        render();
    }

    function captureModalDraft() {
        if (!state.modal || !host) return state.modal;
        const modal = host.querySelector('.ast-modal');
        if (!modal) return state.modal;

        const titleInput = modal.querySelector('[name="ast-title"]');
        const descriptionInput = modal.querySelector('[name="ast-description"]');
        const dueDateInput = modal.querySelector('[name="ast-due-date"]');
        const noDueDateInput = modal.querySelector('[name="ast-no-due-date"]');
        const isOngoingInput = modal.querySelector('[name="ast-is-ongoing"]');
        const stepsEnabledInput = modal.querySelector('[name="ast-steps-enabled"]');
        const stepInputs = modal.querySelectorAll('.ast-step-editor-input');
        const stepMap = new Map((state.modal.steps || []).map(step => [step.id, step]));

        state.modal.title = titleInput ? titleInput.value : state.modal.title;
        state.modal.description = descriptionInput ? descriptionInput.value : state.modal.description;
        state.modal.noDueDate = !!(noDueDateInput && noDueDateInput.checked);
        state.modal.dueDate = state.modal.noDueDate ? '' : (dueDateInput ? dueDateInput.value : state.modal.dueDate);
        state.modal.isOngoing = !!(isOngoingInput && isOngoingInput.checked);
        state.modal.stepsEnabled = !!(stepsEnabledInput && stepsEnabledInput.checked);
        state.modal.steps = Array.from(stepInputs).map((input, index) => {
            const existing = stepMap.get(input.dataset.stepId);
            return {
                id: input.dataset.stepId || makeStepId(),
                text: input.value,
                done: existing ? !!existing.done : false,
                order: index + 1
            };
        });

        return state.modal;
    }

    function saveModalTask() {
        const draft = captureModalDraft();
        const title = draft.title.trim();
        if (!title) {
            draft.titleError = true;
            render();
            const titleInput = host && host.querySelector('[name="ast-title"]');
            if (titleInput) titleInput.focus();
            return;
        }

        const dueDate = draft.noDueDate ? null : (draft.dueDate || null);
        const steps = draft.stepsEnabled
            ? draft.steps
                .map((step, index) => ({
                    id: step.id || makeStepId(),
                    text: (step.text || '').trim(),
                    done: !!step.done,
                    order: index + 1
                }))
                .filter(step => step.text)
            : [];

        if (draft.mode === 'edit' && draft.taskId) {
            const task = getTaskById(draft.taskId);
            if (!task) return;
            task.title = title;
            task.description = draft.description.trim();
            task.dueDate = dueDate;
            task.isOngoing = !!draft.isOngoing;
            task.steps = steps;
            task.updatedAt = nowIso();
        } else {
            state.tasks.push(normalizeTask({
                id: makeTaskId(),
                title: title,
                description: draft.description.trim(),
                type: 'non-routine',
                status: 'not_started',
                createdAt: nowIso(),
                updatedAt: nowIso(),
                dueDate: dueDate,
                isOngoing: !!draft.isOngoing,
                isTopThree: false,
                topThreeOrder: null,
                steps: steps,
                completedAt: null,
                sortOrder: state.tasks.length,
                priority: null,
                tags: [],
                spoonCost: null,
                calendarSyncId: null,
                recurrence: null,
                notifyAt: null,
                notifyBefore: null,
                parentId: null,
                archivedAt: null
            }, state.tasks.length));
        }

        state.modal = null;
        saveTasks();
        render();
    }

    function renderEnergyCard(shell) {
        const card = el('section', 'ast-card ast-energy-card');
        const title = el('div', 'ast-section-title', 'Energy');
        const hitbox = el('button', 'ast-energy-hitbox');
        const bar = el('div', 'ast-energy-bar');
        const fill = el('div', 'ast-energy-fill');
        const meta = el('div', 'ast-energy-meta');
        const value = el('div', 'ast-energy-value', state.energy.level + '/' + state.energy.max);
        const labelInfo = getEnergyLabel(state.energy.level);
        const label = el('div', 'ast-energy-label', labelInfo.text);

        hitbox.type = 'button';
        hitbox.dataset.astEnergyBar = 'true';
        fill.style.width = ((state.energy.level / state.energy.max) * 100) + '%';
        label.style.color = labelInfo.color;

        bar.appendChild(fill);
        hitbox.appendChild(bar);
        meta.appendChild(value);
        meta.appendChild(label);
        card.appendChild(title);
        card.appendChild(hitbox);
        card.appendChild(meta);
        shell.appendChild(card);
    }

    function renderTopThree(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'TOP 3 FOCUS'));

        const list = el('div', 'ast-top3-list');
        topThreeSlots().forEach((task, index) => {
            const slot = index + 1;
            if (!task) {
                const empty = el('button', 'ast-empty-slot', '+ Pick a focus task');
                empty.type = 'button';
                empty.dataset.astAction = 'open-picker';
                empty.dataset.slot = String(slot);
                list.appendChild(empty);
                return;
            }

            const wrap = el('div', 'ast-card ast-focus-slot');
            const row = el('div', 'ast-focus-task');
            const doneButton = el('button', 'ast-checkbox-btn', '○');
            const main = el('div', 'ast-focus-main');
            const title = el('div', 'ast-focus-title', task.title);
            const detail = el('div', 'ast-focus-detail', taskMetaLine(task));
            const remove = el('button', 'ast-icon-btn', '×');

            doneButton.type = 'button';
            doneButton.dataset.astAction = 'complete-focus-task';
            doneButton.dataset.taskId = task.id;

            remove.type = 'button';
            remove.dataset.astAction = 'remove-focus';
            remove.dataset.taskId = task.id;

            main.appendChild(title);
            main.appendChild(detail);
            row.appendChild(doneButton);
            row.appendChild(main);
            row.appendChild(remove);
            wrap.appendChild(row);
            list.appendChild(wrap);
        });

        card.appendChild(list);
        shell.appendChild(card);
    }

    function renderTaskRow(task) {
        const expanded = state.expandedTaskId === task.id;
        const row = el('div', 'ast-task-row' + (expanded ? ' ast-expanded' : '') + (isOverdue(task) ? ' ast-overdue' : ''));
        const header = el('button', 'ast-task-header');
        const dot = el('span', 'ast-task-status ast-status-' + task.status);
        const titleWrap = el('div', 'ast-task-title-wrap');
        const title = el('div', 'ast-task-title', task.title);
        const meta = el('div', 'ast-task-meta');
        const due = el('span', '', taskListMeta(task));
        const chevron = el('span', 'ast-task-chevron', expanded ? '⌄' : '›');

        header.type = 'button';
        header.dataset.astAction = 'toggle-task';
        header.dataset.taskId = task.id;

        titleWrap.appendChild(title);
        if (expanded && task.dueDate) {
            const expandedMeta = el('div', 'ast-focus-detail', formatDate(task.dueDate));
            titleWrap.appendChild(expandedMeta);
        }

        meta.appendChild(due);
        meta.appendChild(chevron);
        header.appendChild(dot);
        header.appendChild(titleWrap);
        header.appendChild(meta);
        row.appendChild(header);

        if (!expanded) return row;

        const body = el('div', 'ast-task-body');

        if (task.description) {
            body.appendChild(el('div', 'ast-task-description', task.description));
        }

        if (task.steps.length > 0) {
            const progress = taskStepProgress(task);
            body.appendChild(el('div', 'ast-step-progress', progress.done + '/' + progress.total + ' steps done'));
            const stepList = el('div', 'ast-step-list');
            task.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .forEach(step => {
                    const item = el('label', 'ast-step-item');
                    const input = document.createElement('input');
                    const text = el('span', 'ast-step-text' + (step.done ? ' ast-step-done' : ''), step.text);

                    input.type = 'checkbox';
                    input.checked = step.done;
                    input.dataset.astAction = 'toggle-step';
                    input.dataset.taskId = task.id;
                    input.dataset.stepId = step.id;

                    item.appendChild(input);
                    item.appendChild(text);
                    stepList.appendChild(item);
                });
            body.appendChild(stepList);
        }

        const statusRow = el('div', 'ast-status-row');
        [
            ['not_started', 'Not Started'],
            ['in_progress', 'In Progress'],
            ['done', 'Done']
        ].forEach(pair => {
            const button = el('button', 'ast-status-btn' + (task.status === pair[0] ? ' ast-active' : ''), pair[1]);
            button.type = 'button';
            button.dataset.astAction = 'set-status';
            button.dataset.taskId = task.id;
            button.dataset.status = pair[0];
            statusRow.appendChild(button);
        });
        body.appendChild(statusRow);

        const actions = el('div', 'ast-action-row');
        const focusButton = el(
            'button',
            'ast-action-btn',
            task.isTopThree ? 'Remove from Focus' : '★ Add to Focus'
        );
        const editButton = el('button', 'ast-action-btn', '✏ Edit');
        const deleteButton = el('button', 'ast-action-btn', '🗑 Del');

        focusButton.type = 'button';
        focusButton.dataset.astAction = task.isTopThree ? 'remove-focus' : 'toggle-focus';
        focusButton.dataset.taskId = task.id;

        editButton.type = 'button';
        editButton.dataset.astAction = 'open-edit-task';
        editButton.dataset.taskId = task.id;

        deleteButton.type = 'button';
        deleteButton.dataset.astAction = 'delete-task';
        deleteButton.dataset.taskId = task.id;

        actions.appendChild(focusButton);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        body.appendChild(actions);

        row.appendChild(body);
        return row;
    }

    function renderTasks(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'NON-ROUTINE TASKS'));

        const filterRow = el('div', 'ast-filter-row');
        [
            ['all', 'All'],
            ['active', 'Active'],
            ['done', 'Done']
        ].forEach(pair => {
            const button = el('button', 'ast-filter-pill' + (state.filter === pair[0] ? ' ast-active' : ''), pair[1]);
            button.type = 'button';
            button.dataset.astAction = 'set-filter';
            button.dataset.filter = pair[0];
            filterRow.appendChild(button);
        });
        card.appendChild(filterRow);

        const list = el('div', 'ast-task-list');
        const tasks = filteredTasks();
        if (tasks.length === 0) {
            list.appendChild(el('div', 'ast-empty-state', state.filter === 'done' ? 'No completed tasks yet.' : 'No tasks here yet. Add one below.'));
        } else {
            tasks.forEach(task => list.appendChild(renderTaskRow(task)));
        }
        card.appendChild(list);

        const addCard = el('button', 'ast-add-card', '+ Add Task');
        addCard.type = 'button';
        addCard.dataset.astAction = 'open-add-task';
        card.appendChild(addCard);

        shell.appendChild(card);
    }

    function renderRoutine(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'ROUTINE TASKS'));
        card.appendChild(el('div', 'ast-placeholder-card', 'Coming soon — daily and weekly routines will live here.'));
        shell.appendChild(card);
    }

    function renderPicker() {
        if (!state.pickerSlot) return null;

        const overlay = el('div', 'ast-overlay');
        overlay.dataset.astAction = 'close-picker';

        const picker = el('div', 'ast-picker');
        picker.addEventListener('click', function(event) {
            event.stopPropagation();
        });

        picker.appendChild(el('div', 'ast-picker-title', 'Pick a focus task'));
        const list = el('div', 'ast-picker-list');
        const tasks = availableFocusTasks();

        if (tasks.length === 0) {
            list.appendChild(el('div', 'ast-empty-state', 'No active tasks available for focus right now.'));
        } else {
            tasks.forEach(task => {
                const button = el('button', 'ast-picker-option');
                const title = el('div', 'ast-picker-title-row', task.title);
                const detail = el('div', 'ast-picker-detail-row', taskMetaLine(task));

                button.type = 'button';
                button.dataset.astAction = 'pick-focus-task';
                button.dataset.taskId = task.id;
                button.dataset.slot = String(state.pickerSlot);

                button.appendChild(title);
                button.appendChild(detail);
                list.appendChild(button);
            });
        }

        const cancel = el('button', 'ast-cancel-btn', 'Cancel');
        cancel.type = 'button';
        cancel.dataset.astAction = 'close-picker';

        picker.appendChild(list);
        picker.appendChild(cancel);
        overlay.appendChild(picker);
        return overlay;
    }

    function renderModalStepBuilder(draft) {
        const wrap = el('div', 'ast-step-builder');
        draft.steps.forEach(step => {
            const row = el('div', 'ast-step-editor-row');
            const input = document.createElement('input');
            const del = el('button', 'ast-icon-btn ast-step-delete', '×');

            input.className = 'ast-input ast-step-editor-input';
            input.placeholder = 'Step ' + step.order;
            input.value = step.text;
            input.dataset.stepId = step.id;

            del.type = 'button';
            del.dataset.astAction = 'delete-modal-step';
            del.dataset.stepId = step.id;

            row.appendChild(input);
            row.appendChild(del);
            wrap.appendChild(row);
        });

        const add = el('button', 'ast-action-btn', '+ Add step');
        add.type = 'button';
        add.dataset.astAction = 'add-modal-step';
        wrap.appendChild(add);
        return wrap;
    }

    function renderModal() {
        if (!state.modal) return null;

        const draft = state.modal;
        const overlay = el('div', 'ast-overlay');
        overlay.dataset.astAction = 'close-modal';

        const modal = el('div', 'ast-modal');
        modal.addEventListener('click', function(event) {
            event.stopPropagation();
        });

        modal.appendChild(el('h3', 'ast-modal-title', draft.mode === 'edit' ? 'Edit Task' : 'Add Task'));

        const titleField = el('div', 'ast-field');
        const titleLabel = el('label', 'ast-label', 'Title');
        const titleInput = document.createElement('input');
        titleInput.name = 'ast-title';
        titleInput.className = 'ast-input' + (draft.titleError ? ' ast-error' : '');
        titleInput.placeholder = 'What needs to get done?';
        titleInput.value = draft.title;
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);
        modal.appendChild(titleField);

        const descField = el('div', 'ast-field');
        const descLabel = el('label', 'ast-label', 'Description');
        const descInput = document.createElement('textarea');
        descInput.name = 'ast-description';
        descInput.className = 'ast-textarea';
        descInput.placeholder = 'Any details or notes? (optional)';
        descInput.value = draft.description;
        descField.appendChild(descLabel);
        descField.appendChild(descInput);
        modal.appendChild(descField);

        const dueField = el('div', 'ast-field');
        dueField.appendChild(el('label', 'ast-label', 'Due date'));
        const dueRow = el('div', 'ast-inline-row');
        const dueInput = document.createElement('input');
        dueInput.type = 'date';
        dueInput.name = 'ast-due-date';
        dueInput.className = 'ast-date-input';
        dueInput.value = draft.dueDate;
        dueInput.disabled = draft.noDueDate;
        const noDueWrap = el('label', 'ast-check-row');
        const noDueInput = document.createElement('input');
        noDueInput.type = 'checkbox';
        noDueInput.name = 'ast-no-due-date';
        noDueInput.checked = draft.noDueDate;
        noDueInput.dataset.astAction = 'toggle-no-due-date';
        noDueWrap.appendChild(noDueInput);
        noDueWrap.appendChild(document.createTextNode('No due date'));
        dueRow.appendChild(dueInput);
        dueField.appendChild(dueRow);
        dueField.appendChild(noDueWrap);
        modal.appendChild(dueField);

        const ongoingWrap = el('label', 'ast-check-row');
        const ongoingInput = document.createElement('input');
        ongoingInput.type = 'checkbox';
        ongoingInput.name = 'ast-is-ongoing';
        ongoingInput.checked = draft.isOngoing;
        ongoingWrap.appendChild(ongoingInput);
        ongoingWrap.appendChild(document.createTextNode('This is an ongoing project'));
        modal.appendChild(ongoingWrap);

        const stepsWrap = el('label', 'ast-check-row');
        const stepsInput = document.createElement('input');
        stepsInput.type = 'checkbox';
        stepsInput.name = 'ast-steps-enabled';
        stepsInput.checked = draft.stepsEnabled;
        stepsInput.dataset.astAction = 'toggle-steps';
        stepsWrap.appendChild(stepsInput);
        stepsWrap.appendChild(document.createTextNode('Break this into steps?'));
        modal.appendChild(stepsWrap);

        if (draft.stepsEnabled) {
            modal.appendChild(renderModalStepBuilder(draft));
        }

        const actions = el('div', 'ast-modal-actions');
        const cancel = el('button', 'ast-cancel-btn', 'Cancel');
        const save = el('button', 'ast-save-btn', 'Save');

        cancel.type = 'button';
        cancel.dataset.astAction = 'close-modal';

        save.type = 'button';
        save.dataset.astAction = 'save-modal-task';

        actions.appendChild(cancel);
        actions.appendChild(save);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        return overlay;
    }

    function updateBadge() {
        if (window.MissionControl && typeof window.MissionControl.setBadgeCount === 'function') {
            window.MissionControl.setBadgeCount('ast', getDueCount());
        }
    }

    function render() {
        if (!host) return;

        const shell = el('div', 'ast-shell');
        renderEnergyCard(shell);
        renderTopThree(shell);
        renderTasks(shell);
        renderRoutine(shell);

        const children = [shell];
        const picker = renderPicker();
        const modal = renderModal();
        if (picker) children.push(picker);
        if (modal) children.push(modal);

        host.replaceChildren(...children);
        updateBadge();
    }

    function ensureHost() {
        if (host) return host;
        const container = document.getElementById('tab-assistant');
        if (!container) return null;
        host = el('div', 'ast-root');
        container.appendChild(host);
        return host;
    }

    function refresh() {
        ensureHost();
        render();
    }

    function handleAction(action, button, event) {
        switch (action) {
            case 'toggle-task':
                state.expandedTaskId = state.expandedTaskId === button.dataset.taskId ? null : button.dataset.taskId;
                render();
                return true;
            case 'set-filter':
                setFilter(button.dataset.filter);
                return true;
            case 'open-add-task':
                openTaskModal(null);
                return true;
            case 'open-edit-task':
                openTaskModal(button.dataset.taskId);
                return true;
            case 'delete-task':
                if (window.confirm('Delete this task?')) deleteTask(button.dataset.taskId);
                return true;
            case 'toggle-focus':
                addTaskToFocus(button.dataset.taskId);
                return true;
            case 'remove-focus':
                removeTaskFromFocus(button.dataset.taskId);
                return true;
            case 'complete-focus-task':
                setTaskStatus(button.dataset.taskId, 'done', event);
                return true;
            case 'set-status':
                setTaskStatus(button.dataset.taskId, button.dataset.status, event);
                return true;
            case 'open-picker':
                openPicker(parseInt(button.dataset.slot, 10));
                return true;
            case 'close-picker':
                closePicker();
                return true;
            case 'pick-focus-task':
                addTaskToFocus(button.dataset.taskId, parseInt(button.dataset.slot, 10));
                state.pickerSlot = null;
                render();
                return true;
            case 'close-modal':
                closeTaskModal();
                return true;
            case 'toggle-no-due-date':
                captureModalDraft();
                state.modal.noDueDate = !!button.checked;
                if (state.modal.noDueDate) state.modal.dueDate = '';
                render();
                return true;
            case 'toggle-steps':
                captureModalDraft();
                state.modal.stepsEnabled = !!button.checked;
                if (state.modal.stepsEnabled && state.modal.steps.length === 0) {
                    state.modal.steps.push({ id: makeStepId(), text: '', done: false, order: 1 });
                }
                render();
                return true;
            case 'add-modal-step':
                captureModalDraft();
                state.modal.stepsEnabled = true;
                state.modal.steps.push({
                    id: makeStepId(),
                    text: '',
                    done: false,
                    order: state.modal.steps.length + 1
                });
                render();
                return true;
            case 'delete-modal-step':
                captureModalDraft();
                state.modal.steps = state.modal.steps.filter(step => step.id !== button.dataset.stepId);
                render();
                return true;
            case 'save-modal-task':
                saveModalTask();
                return true;
            default:
                return false;
        }
    }

    function onClick(event) {
        const energyBar = event.target.closest('[data-ast-energy-bar]');
        if (energyBar) {
            const rect = energyBar.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const level = Math.min(ENERGY_MAX, Math.max(1, Math.round(ratio * (ENERGY_MAX - 1)) + 1));
            setEnergyLevel(level);
            return;
        }

        const actionEl = event.target.closest('[data-ast-action]');
        if (!actionEl) return;
        handleAction(actionEl.dataset.astAction, actionEl, event);
    }

    function onChange(event) {
        const actionEl = event.target.closest('[data-ast-action]');
        if (actionEl && actionEl.dataset.astAction === 'toggle-step') {
            toggleTaskStep(actionEl.dataset.taskId, actionEl.dataset.stepId, event.target.checked);
        }
    }

    function attachEvents() {
        if (!host || host.dataset.astBound === 'true') return;
        host.dataset.astBound = 'true';
        host.addEventListener('click', onClick);
        host.addEventListener('change', onChange);
    }

    function exposeApi() {
        window.Assistant = {
            getDueCount: function() {
                return getDueCount();
            },
            getTopThree: function() {
                return clone(getTopThree());
            },
            getEnergyLevel: function() {
                const label = getEnergyLabel(state.energy.level);
                return {
                    level: state.energy.level,
                    max: state.energy.max,
                    label: label.text
                };
            },
            refresh: function() {
                refresh();
            }
        };
    }

    function init() {
        loadState();
        exposeApi();
        ensureHost();
        attachEvents();
        render();
        updateBadge();

        if (!badgeIntervalId) {
            badgeIntervalId = window.setInterval(updateBadge, 60000);
        }
    }

    try {
        init();
    } catch (err) {
        console.error('Assistant pod failed to initialize:', err);
    }
})();
```

### index.html changes (only the new/modified lines)

**CSS link added in `<head>` (after the `</style>` tag):**
```html
<!-- Assistant tab — self-contained pod -->
<link rel="stylesheet" href="assistant.css">
```

**Tab button added (after Life button):**
```html
<button class="main-tab" onclick="showMainTab('assistant', this)" id="ast-tab-btn">
    Assistant
    <span id="ast-badge" style="display:none; background:#e85d75; color:#fff; font-size:10px; padding:1px 6px; border-radius:8px; margin-left:4px; font-weight:700;"></span>
</button>
```

**Tab container added (after tab-life-2):**
```html
<!-- ====== TAB: ASSISTANT ====== -->
<div class="tab-page" id="tab-assistant"></div>
```

**Refresh hook added to showMainTab function:**
```js
if (tab === 'assistant' && window.Assistant) window.Assistant.refresh();
```

**Bridge object added after loadData function:**
```js
window.MissionControl = {
    getBodyStatus: function() {
        const el = document.getElementById('rn-body-text');
        return el ? el.textContent : null;
    },
    getSafeToSpend: function() {
        return loadData('safe_to_spend');
    },
    saveData: saveData,
    loadData: loadData,
    setBadgeCount: function(tabId, count) {
        const badge = document.getElementById(tabId + '-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
};
```

**Script tag added (before service worker script):**
```html
<!-- Assistant pod — all task management logic -->
<script src="assistant.js"></script>
```

### sw.js changes

```js
const CACHE_NAME = 'mission-control-v20';  // was v19

const FILES_TO_CACHE = [
    BASE + 'supabase-config.js',
    BASE + 'manifest.json',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png',
    BASE + 'assistant.js',      // new
    BASE + 'assistant.css'       // new
];
```

---

## What I Want From You

1. **Does the code match the spec?** Call out anything that deviates.
2. **Do you agree with Claude's 8 issues?** Disagree with any? Find more?
3. **Is the architecture sound?** Pod isolation, bridge pattern, data model — any concerns?
4. **Anything that would break in a browser?** Runtime issues, edge cases, mobile problems?
5. **What would you change before shipping this?**

Be specific. Line numbers or function names when possible. Don't tell me what's fine — tell me what's wrong.
