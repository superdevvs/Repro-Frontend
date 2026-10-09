# Settings UI acceptance checklist

Use this checklist when changing Settings. Record local and deployed evidence separately.

## Navigation and information structure

- [ ] Admin navigation has at most six primary sections: My Account, Branding, Editing, Business, Integrations, Robbie AI.
- [ ] Only permitted sections and subsections appear; empty sections disappear.
- [ ] Personal details, account/security and notification preferences remain easy to reach.
- [ ] Personal portfolio branding and shared photo watermarks have explicit scope labels.
- [ ] AI photo providers and Robbie assistant configuration remain separate workflows.
- [ ] System Monitor has no sidebar or mobile shortcut and is hidden until five consecutive Account & security tab clicks reveal its underline tab inside My Account.
- [ ] Unlock persists for the current browser session and authenticated user only; superadmin secondary roles retain access, and impersonation blocks it.
- [ ] Other tab/category interactions reset an unfinished click sequence. Four clicks do not reveal monitoring, and the fifth leaves Account selected.
- [ ] Existing `?tab=` links open the correct subsection. Locked overview links cannot bypass the unlock; `/system-monitor?view=server` returns to Settings and retains the view after unlocking.
- [ ] Changing categories remembers the last subsection during the current visit.

## Compact and responsive layout

- [ ] Primary navigation uses compact icon tabs, expanding the selected or hovered label on desktop and phone.
- [ ] Subsections use text tabs with a clear active underline, no pill background or icons; compact phone labels retain their full accessible names.
- [ ] Primary tabs remain a single horizontally scrolling row; a single-subsection group hides its redundant second row.
- [ ] Small subsection lists remain usable through horizontal scrolling without page overflow.
- [ ] Related contact fields use two columns when space allows and one column on phones.
- [ ] Profile identity and personal fields share a card; the save action is visible in the initial 900px-high test viewport.
- [ ] Card spacing and headings are consistent; normal input sizes remain intact.
- [ ] Password controls and service-area diagnostic tools use accessible disclosures.
- [ ] Long labels, existing provider controls, empty states and loaded data stay within the content width.
- [ ] Check desktop, tablet, narrow phone and normal phone widths, plus light and dark themes. Include 390x600, 320x568 and 667x375 landscape; navigation must not grow into a vertical menu.

## Accessibility and behavior

- [ ] New navigation controls have accessible names, visible focus and selected-state feedback.
- [ ] Phone section and subsection controls have 44px targets; the full profile avatar is clickable.
- [ ] Arrow keys switch both categories and subsections; Tab reaches fields and save actions. On short-height phones, every save action remains reachable by scrolling.
- [ ] Editing email automatically reveals current-password verification.
- [ ] Profile, account and notification forms send the original payload shapes and retain saved values after reload.
- [ ] Existing notification opt-outs, provider restrictions and account/security rules remain intact.
- [ ] No mutation occurs merely from switching sections or opening legacy links.
- [ ] Check runtime errors and real API loading separately from browser extension noise.

## Release verification

- [ ] Run targeted navigation, role/access and affected settings tests; typecheck, lint, build, file/bundle budgets and dependency policy.
- [ ] Complete the full GitHub quality gate through the prepared deployment workflow.
- [ ] Verify the deployed commit, index and hashed assets.
- [ ] Inspect the real signed-in Settings page on desktop and phone, every section, and System Monitor navigation.
- [ ] Keep production save actions out of visual verification; exercise saves with isolated local fixtures.
- [ ] Preserve temporary screenshots and acceptance reports outside the workspace, under `C:\Users\shubh\Desktop\Projects\ui exploration\time picker\repro-settings\`.
- [ ] Remove only clean release worktrees whose commits are contained in `origin/main`.
