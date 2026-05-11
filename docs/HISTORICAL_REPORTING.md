# Historical Reporting

Last refreshed: **2026-05-10**

## Current direction

Reports should be useful without making Admin slow. The reporting UI now lazy-loads when opened. The next reporting work should focus on smaller payloads, date filters, rollups, and saved presets.

## Priority report areas

- Open HSE follow-up.
- Incident and corrective-action trends.
- Training/SDS expiry.
- Job status and completion proof.
- Payroll/time review status.
- Accounting close status.
- Reconciliation exceptions.
- Scheduler/report delivery status.

## Performance rules

- Default to recent date windows.
- Use pagination for large datasets.
- Use pre-aggregated DB views for dashboard cards.
- Load detailed rows only when a panel is opened.
- Preserve a friendly timeout message instead of breaking the screen.
