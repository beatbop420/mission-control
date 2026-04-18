# Assistant Planner Function

This function keeps the AI key off the frontend.

## What it does

- accepts a brain-dump payload from `assistant.js`
- optionally includes body and money context from Mission Control
- calls the OpenAI Responses API server-side
- returns a structured planning result:
  - summary
  - recommended focus
  - quick win
  - open questions
  - suggested tasks with optional due date, effort, and steps

## Required secrets

Set these in Supabase before deploying the function:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)

## Expected request body

```json
{
  "dump": "Raw brain dump text",
  "context": {
    "bodyStatus": "optional string",
    "safeToSpend": "optional value"
  }
}
```

## Notes

- The static frontend should never hold the OpenAI key.
- The Assistant tab is built to fail closed: if this function is missing or misconfigured, the planner UI should show an error instead of exposing a secret or crashing the rest of the dashboard.
