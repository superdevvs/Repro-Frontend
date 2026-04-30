# Dashboard Refactor Notes

The dashboard route keeps `PermissionRoute` as the access gate. A fresh reload can show the
dashboard route skeleton while `/api/me/permissions` resolves; this is intentional so permission
changes made from Accounts are not masked by stale session-cached permissions.

Phase 7 bundle work should target app-wide chunks before squeezing `Dashboard.tsx` further:
`map`, `index`, `Accounting`, `InvoiceViewDialog`, `PieChart`, and shoot-details chunks.
