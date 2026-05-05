# Jobs Quote Acceptance and Accounting Lifecycle

Pass 099 adds the next commercial/accounting layer on top of the quote, release, completion, and posting foundations.

## What this pass adds

- Quote engagement tracking
  - first viewed at
  - last viewed at
  - open count
  - accepted / declined markers
  - client engagement event history
- Stronger release evaluation state
  - last evaluated at
  - evaluation count
  - last threshold message
- Completion readiness rollup
  - required closeout counts
  - signoff completion counts
  - evidence asset counts
  - ready-for-accounting boolean
- Accounting lifecycle events
  - completion signoff events
  - invoice posting events
  - journal posting events
  - accountant handoff events

## Why this matters

This moves the Jobs page from isolated actions into a clearer management workflow:
- quote engagement can be seen without leaving the commercial panel
- release reviews now preserve evaluation history and the latest threshold message
- completion reviews can be judged for accounting readiness using signoff, closeout, and evidence state together
- posted invoice/journal actions now leave a visible accounting lifecycle trail

## Best next steps after this pass

1. Public or client-safe quote acceptance/open tracking from a shareable quote view
2. Automatic threshold checks on every commercial save path, not only release review paths
3. Deeper completion package signoff and evidence workflow
4. Fuller AR/AP and GL lifecycle beyond manual posting markers
5. Profitability and variance scorecards that can be filtered by site, supervisor, route, and job family
