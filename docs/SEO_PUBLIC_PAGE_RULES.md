# SEO Public Page Rules

Last refreshed: **2026-05-15b**

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
