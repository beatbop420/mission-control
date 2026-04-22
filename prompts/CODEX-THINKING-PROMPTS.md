# Build Task: Replace Auto-Steps with Thinking Prompts

## Context

The Assistant tab in Mission Control (`~/projects/mission-control/`) has a step builder in the Add/Edit Task modal. When you check "Break this into steps?", it currently auto-generates 4 template steps based on keyword matching the task title (e.g., "call" triggers communication steps, "organize" triggers sorting steps).

**The problem:** The generated steps are useless. They're Mad Libs — generic sentence templates with the task title jammed in. "Put everything for organize evidence folder in one place" reads like a robot. "Call Laura about RFAs" becomes a step, which is just restating the task. Nobody needs a step that says "do the thing you already said you need to do."

**The fix:** Replace auto-generated steps with **thinking prompts** — short questions that help the user figure out what the REAL steps are, then let them write their own.

## What to Change

### Files to modify:
- `assistant.js` — replace `makeGeneratedSteps()` with `getThinkingPrompts()`, update the step builder rendering and toggle behavior
- `assistant.css` — add styles for the prompt display area

### Files NOT to modify:
- `index.html` — no changes needed
- `sw.js` — no changes needed

## How It Should Work

### UX Flow:

1. User checks "Break this into steps?"
2. **Instead of auto-generating steps**, show 2-3 thinking prompt questions above the step input area
3. Below the questions: empty step input fields (start with 1 empty field, user adds more with "+ Add step")
4. The questions are based on the same keyword categories that already exist (call, schedule, pay, write, organize, review, default)
5. Questions are read-only, displayed as styled text — NOT input fields
6. A small "×" or "dismiss" link lets the user hide the prompts once they've thought through them
7. Prompts should reappear if the user hits "Regenerate" (rename to something like "Show prompts again" or "Help me think")

### The Thinking Prompts (by category):

**Communication** (call, phone, email, text, message, contact, reply, respond, reach out, follow up):
- What specifically do you need from this conversation?
- Do you have everything they might ask for?
- When's the best time to reach them?

**Scheduling** (schedule, book, arrange, plan, set up):
- What dates or times could work?
- What info do you need to have ready?
- Who else needs to know about this?

**Payment** (pay, purchase, buy, order):
- What's the exact amount and where does it come from?
- Do you have the account/payment info handy?
- Is there a deadline or a confirmation you need to save?

**Writing/Filing** (write, draft, fill out, complete, submit, send, file):
- What documents or info do you need before you start?
- What's the most important thing this needs to say?
- Who's going to read/receive this and what do they need from it?

**Organizing** (organize, clean, tidy, sort, declutter):
- What's the mess right now — too much, wrong place, or missing stuff?
- How do you want to find things later?
- Is anything in here time-sensitive or high priority?

**Research/Review** (review, read, check, audit, research, look over):
- What's the main question you're trying to answer?
- What's the most important part to look at first?
- What decision does this feed into?

**Default** (anything that doesn't match above):
- What does "done" look like for this?
- What do you need before you can start?
- What's the very first physical action?

### What to Remove:

- Delete the `makeGeneratedSteps()` function (lines 284-355)
- Delete the helper functions ONLY used by `makeGeneratedSteps`: `compactText`, `stripTrailingPunctuation`, `sentenceCase`, `shortenDetail`, `leadObject` (lines 255-282). **Check that nothing else uses these before deleting.**
- Delete `regenerateModalSteps()` (lines 357-367) — replace with a function that shows/re-shows the prompts
- Remove the "Regenerate" button from `renderModalStepBuilder` (line 1029) — replace with "Help me think" or similar

### What to Keep:

- The keyword regex patterns — reuse the same `/(^|\b)(call|phone|email|...)(\b|$)/i` patterns, just return questions instead of steps
- `moveModalStep()` — keep step reordering
- `renumberSteps()` — keep
- All the step editor UI (input fields, move up/down, delete) — keep exactly as-is
- The `pendingFocusTarget` system — keep, use it to focus the first empty step input after showing prompts
- `captureModalDraft()` — keep

### New State:

Add a `promptsDismissed` boolean to the modal draft object (in `taskToDraft()`). Default `false`. Set to `true` when the user dismisses prompts. Set back to `false` when user taps "Help me think."

## CSS for Prompts

Add a new class `ast-thinking-prompts` for the prompt display area. Style it like:
- Muted background (slightly different from the card — maybe `rgba(61, 47, 53, 0.3)` or similar subtle tint)
- Border-left: `3px solid var(--ast-accent)` (thinner than card border, same color)
- Border-radius: `8px`
- Padding: `12px 14px`
- Margin-bottom: `8px`

Each question should be:
- `ast-thinking-prompt` class
- Color: `var(--ast-text)` (not muted — these should be readable)
- Font-size: `14px`
- Line-height: `1.5`
- Preceded by a bullet or dash character
- Small gap between questions (`8px`)

The dismiss link:
- `ast-prompts-dismiss` class
- Small text, muted color, right-aligned or at the bottom of the prompt box
- Something like "Got it, hide these" or just "×"

The "Help me think" button:
- Same style as the current "Regenerate" button (`ast-cancel-btn` class)
- Only shows when prompts are dismissed AND steps section is visible

## Behavior Details

- If the user has already written steps (editing an existing task), do NOT show prompts. Only show prompts when there are zero steps.
- If the user dismisses prompts and then deletes all their steps, prompts should NOT auto-reappear. They can tap "Help me think" to bring them back.
- Prompts do NOT get saved to the task data. They're ephemeral UI only — part of the modal draft state, not the task object.
- The keyword matching should use the title field's CURRENT value (live from the modal), not the saved task title.

## Testing

After building, verify:
- [ ] Check "Break into steps?" on a new task with title "Call Laura" → shows communication prompts + 1 empty step field
- [ ] Check "Break into steps?" on a new task with title "Organize files" → shows organizing prompts
- [ ] Check "Break into steps?" on a new task with title "Do the thing" → shows default prompts
- [ ] Dismiss prompts → they disappear, "Help me think" button appears
- [ ] Tap "Help me think" → prompts reappear
- [ ] Edit an existing task that already has steps → no prompts shown, just the step editor
- [ ] Prompts do NOT appear anywhere in saved task data (check localStorage)
- [ ] Enter key in step input still saves the task (existing keyboard behavior)
- [ ] Focus management still works (existing `pendingFocusTarget` behavior)
