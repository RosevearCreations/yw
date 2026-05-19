# AI Context

Last refreshed: **2026-05-18a**

## Current instruction for future passes

Always update Markdown and schema files with every build change. Keep retired Markdown archived, not active in the root. Keep temp files out of the ZIP. Verify JavaScript syntax, smoke checks, CSS brace balance, and one H1 on exposed pages.

## Latest technical focus

Admin live load was falling back to cached data. The latest fix stages Admin requests by panel scope and reserves `scope: all` for emergency fallback only.
