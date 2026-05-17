# SEO Public Page Rules

Last refreshed: **2026-05-16b**

## Current rules

- Keep no more than one H1 per exposed page.
- Use clear words people search for in titles, headings, alt text, and helpful link text.
- Keep local terms accurate and visible when public marketing pages are added.
- Track title/meta/H1/local words/alt/broken asset checks in `admin_public_seo_checks`.

## Current implementation

Schema 108 adds `v_public_seo_smoke_check`. The current app shell has one H1. Full public-page crawling/scanning is still a future automation step.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Reviewed in the 2026-05-16b pass for schema 111 documentation consistency._
