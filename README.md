# Design Critique Agent

Evaluates a UI screenshot against four layers — Laws of UX, Nielsen's
heuristics, house rules, and WCAG — and returns two panels: severity-scored
design judgment and pass/fail accessibility compliance.

## Setup
```
npm install
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY preview
```

## Architecture
- `api/analyze.js` — orchestrator
- `lib/regions.js` — region detection (vision call)
- `lib/judgmentAgent.js` — Laws of UX + Nielsen + House Rules (no severity)
- `lib/complianceAgent.js` — WCAG, model-inferred portion only
- `lib/contrast.js` — deterministic contrast ratio, validated against real
  screenshot pixels (sliding window + validity gates, not a single guess)
- `lib/severityRescorer.js` — blind re-scoring pass, never sees source/principle
- `lib/aggregator.js` — merges everything, crops region thumbnails

## Testing without an API key
`npm run test:dryrun` exercises the real `contrast.js` and `aggregator.js`
against a real screenshot, stubbing only the three model calls.
