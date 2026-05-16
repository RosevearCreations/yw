# Jobs Commercial Workflow

Last refreshed: **2026-05-15c**

Jobs remain a core workflow. This pass fixed Admin directory loading so the Edge Function no longer assumes `jobs.job_status`; live schema may use `jobs.status`.

Next work: connect jobs to saved filters, close blockers, evidence manager proof, and posting preview actions.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.
