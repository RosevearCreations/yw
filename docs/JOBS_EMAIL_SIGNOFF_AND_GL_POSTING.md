# Jobs Quote Email, Signoff, and GL Posting

This pass extends the Jobs commercial/accounting workflow with:

- actual quote-package email delivery using configured Resend email delivery
- threshold matching that can be targeted by role, client, site, and job family
- completion-package signoff steps with drilldown history
- invoice candidate posting into fuller AR/AP coordination
- journal candidate posting into fuller GL coordination
- profitability management scorecards with margin and variance percentages

## Main additions

### Quote package delivery
- `estimate_quote_packages.send_status`
- `estimate_quote_packages.send_error`
- `estimate_quote_packages.last_send_attempt_at`
- `estimate_quote_packages.resend_count`
- `estimate_quote_packages.recipient_name`
- `estimate_quote_packages.recipient_profile_id`
- `estimate_quote_packages.copied_to_emails`
- `estimate_quote_packages.last_email_message_id`
- `quote_package_output_events.provider_name`
- `quote_package_output_events.provider_message_id`
- `quote_package_output_events.output_error`

### Threshold policy targeting
- `commercial_approval_thresholds.applies_to_client_id`
- `commercial_approval_thresholds.applies_to_client_site_id`
- `commercial_approval_thresholds.applies_to_role`
- `commercial_approval_thresholds.warning_text`
- `commercial_approval_thresholds.block_text`

### Completion signoff drilldown
- `job_completion_signoff_steps`
- `v_job_completion_signoff_directory`

### Invoice / GL posting
- `job_invoice_postings`
- `job_journal_postings`
- `v_job_invoice_posting_directory`
- `v_job_journal_posting_directory`

### Management scorecards
- `v_job_profitability_management_scorecard_directory`

## Best next tests
1. Render a quote package and use **Send Quote** with a real email address.
2. Confirm the quote package send event writes provider/message details.
3. Save a release review against a threshold targeted to a role, client, or site.
4. Add multiple completion signoff steps and sign one of them.
5. Post an invoice candidate and confirm AR/AP queue + posting row.
6. Post a journal candidate and confirm GL posting row.
7. Review profitability management scorecards by site, supervisor, route, and job family.

## Best next step after this
- stronger policy automation:
  - threshold enforcement on every relevant save path
  - deeper quote-send delivery status tracking
  - accountant handoff exports with posted invoice/journal references
  - fuller AR/AP and GL lifecycle beyond manual posting markers
