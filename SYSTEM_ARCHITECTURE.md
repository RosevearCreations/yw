# System Architecture

## Frontend layers

- auth bootstrap and recovery
- auth UI and account security UI
- security and route guards
- API and outbox helpers
- admin UI and admin actions
- logbook/review UI
- form modules
- app shell

## Security model direction

Frontend now uses shared route and tier helpers so the app behaves consistently, but backend enforcement must validate:
- current user role
- current user active status
- site assignment access
- admin-only writes
- supervisor/HSE/job admin read limits

## Workforce model direction

The app is evolving from a simple safety app into a combined safety + workforce profile app for a construction company.
