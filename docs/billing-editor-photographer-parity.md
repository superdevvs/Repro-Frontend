# Editor, photographer, and weekly billing redesign parity

## Editor self billing

- `EditorEarningsWorkspace` accepts optional `startDate` and `endDate` for self mode. It delegates to `EditorSelfBillingWorkspace`, which owns its connected summary, earnings trend, completed-work ledger, and payout history. The parent should not also render the former estimate-based editor summary/chart.
- Earnings filters and overview use the completion date. Payout history uses the recorded `paid_at` date and saved payout batches; unrelated legacy payments without a batch remain separate records.
- Recorded totals and the chart use saved `payout_amount`. Current-rate estimates are separately labeled and excluded from recorded totals. Any paid line, including a saved zero-rate/zero-payout line, retains its snapshot when rates change.
- Search, exact service selection, paid/unpaid filters, list/grid, and 10/20-row pagination remain available. The ledger has a bounded body, and mobile initially uses the grid.
- CSV, Excel, and PDF downloads use all filtered rows in the active ledger/history tab. Email reports retain the existing endpoint's date-only scope and disclose that distinction before sending.
- Shoot detail retains service quantities/rates/payouts, edited media from the existing authenticated API, the existing empty notes state, and completion/payment activity including the recorded paying actor. Media and dialogs are bounded.
- Self-service rate editing keeps the existing service add/remove/save API, refreshes current estimates through authenticated metadata changes, and is now presented in a bounded dialog.
- Self mode has no mark-paid action.

## Admin editor earnings

- Existing editor search, payout-status, service-type, date filters, summary API, detail API, exports, email report, and mark-paid confirmation/API remain.
- Connected summary, 5/10-row editor queue, 10/20-row detail ledger/history, and bounded panes replace the tall card layout. Current rates remain accessible in a detail tab.
- Saved-versus-estimated amounts remain explicit. Paid zero snapshots are preserved. Mark paid is available only in the existing admin workspace and is disabled while detail is loading or belongs to a different selected editor.
- The earnings API has no weekly-invoice ID/private-note mechanism. No new editor private-note endpoint or placeholder save action is introduced.

## Weekly reviews for sales and photographers

- Existing role-specific APIs, complete multi-page fetch, independent date filters, aggregate metrics, review-status details, commission/service lines, expenses, notes, and saved payout totals remain.
- History has 3/5 rows per page, independent bounded scroll, row selection, selected export scope, CSV/Excel/PDF, and combined selected-invoice PDFs. Selection persists across pagination.
- Expense add/remove, sales submission, photographer approval/edit-change dialog, returned-review workflow, and invoice details remain on their existing APIs and dialogs. Paid records and server-locked (`can_edit: false`) records expose no edit/review actions.
- History/detail panes have bounded height and scroll; headings and pagination remain visible.

## Photographer shoot earnings

- Only the signed-in photographer's assigned shoots are included. Existing pay and payout-status/date utilities remain the source of truth, including assignment-specific pay.
- Property/client/services, workflow, earnings, payout state/date, completed/scheduled date, image/grid display, and view-shoot action remain.
- Search, payout filtering, 6/12-row pagination, compact list/grid, bounded scrolling, and initial mobile grid have been added.
- The shoot list remains explicitly labeled as all assigned shoots; the parent date control scopes the photographer overview/chart while weekly review dates remain independent.

## Validation

- 23 targeted tests pass across `editorBillingWorkspaceUtils.test.ts`, `PhotographerShootsTable.billing.test.tsx`, `WeeklyInvoiceReview.billing.test.tsx`, and the existing `weeklyInvoiceReviewUtils.test.ts`.
- Regressions cover snapshot preservation (including paid zero amounts), estimates excluded from recorded totals, completion-versus-payment dates, legacy payment grouping, exact filters, photographer assignment isolation/pagination/search, weekly selection persistence/export, and paid/server-lock behavior.
- Scoped ESLint passes; `git diff --check` is clean for these components. Parent owns full TypeScript/build, integrated role/browser/mobile checks, and deployment.
- Implementation uses existing live APIs and data only. Fictional examples are confined to the separate approval prototypes and test fixtures.
