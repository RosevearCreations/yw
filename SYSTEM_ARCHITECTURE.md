# System Architecture

Current architecture marker: **2026-06-05a / schema 131**

Admin readiness now reads DB-backed queues for payment UI validation, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry through `admin-directory` safe optional-view loading.

