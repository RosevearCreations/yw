# Known Issues and Gaps

Last refreshed: **2026-05-18a**

## Immediate issues

1. Live Admin may still fall back to cached data until `admin-directory` is redeployed and old service worker files are cleared.
2. Some Admin panels still rely on broad directory state and should continue moving to panel-only refreshes.
3. Job actions need live testing against the production table names and permissions.
4. Accounting close screens still need deeper validation and export packaging tests with real data.
5. Schema drift checks depend on `app_schema_versions` being applied consistently.

## UX gaps

- Continue testing mobile Admin tables at narrow widths.
- Continue replacing long lists with paged/filterable panels.
- Add clearer retry buttons beside panels that fail staged loading.

## SEO/local gaps

- Keep one H1 per public page.
- Continue checking page titles, meta descriptions, local wording, and mobile usability each pass.
- Add more local service/location content only when it matches real service coverage.

## Fixed during this pass

- Corrected newline escaping in `report-subscription-delivery-run/index.ts` to avoid bundle parse failures similar to the previous `admin-manage` issue.
