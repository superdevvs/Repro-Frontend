# Dashboard Refactor Notes

The dashboard route keeps `PermissionRoute` as the access gate. A fresh reload can show the
dashboard route skeleton while `/api/me/permissions` resolves; this is intentional so permission
changes made from Accounts are not masked by stale session-cached permissions.

Phase 7 bundle baseline before interaction-level lazy loading:
`Dashboard` ~159 KB, `Accounting` ~615 KB, `InvoiceViewDialog` ~388 KB, `ShootDetailsTourTab`
~328 KB, `map` ~1,020 KB. The pass targets app-wide chunks before squeezing
`Dashboard.tsx` further: `map`, `index`, `Accounting`, `InvoiceViewDialog`, `PieChart`, and
shoot-details chunks.

Phase 7 result after interaction-level lazy loading:
`Dashboard` ~155 KB, `Accounting` ~125 KB, `InvoiceViewDialog` ~16 KB, `ShootDetailsTourTab`
~59 KB. PDF and spreadsheet engines are now deferred into separate action-time chunks:
`jspdf` ~358 KB and `xlsx` ~430 KB.
