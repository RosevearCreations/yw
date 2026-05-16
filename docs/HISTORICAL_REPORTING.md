# Historical Reporting

Last refreshed: **2026-05-14b**

Reports remain lazy-loaded so Admin does not time out from heavy report fetches. Keep the reporting fast path in `admin-directory` and add pagination/export gates before expanding report payloads.
