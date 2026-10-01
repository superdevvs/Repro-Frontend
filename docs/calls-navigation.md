# Calls navigation

Calls uses the original `DashboardLayout`, including its shared sidebar, Navbar, and mobile navigation. Keep those shared panels and their existing role and responsive behavior unchanged unless the user explicitly requests a shell change.

Calls routes belong in one compact horizontal navigation row inside the dashboard content. Tabs overflow horizontally instead of wrapping or introducing a separate Calls sidebar or bottom navigation. Keep the current tab visible, keyboard-accessible route links, the Call action reachable on phones, and small scroll controls within the same row when tabs overflow.

`DashboardLayout.loading.test.tsx` protects the original header, desktop sidebar, and mobile navigation on Calls routes. `e2e/calls-workspace.e2e.ts` checks the shell, compact tabs, pagination, and scrolling across desktop/phone and light/dark themes.

## Support belongs in Messaging

The user explicitly requires support requests inside the existing Messaging area, not a separate page or top-level sidebar item. The canonical destination is `/messaging/email/inbox?tab=support`, beside the staff Inbox tab. Only primary admins, superadmins and editing managers keep ordinary email tools, still subject to their existing resource permissions. Every other role uses Support for dashboard messages, even if an old email permission remains. Legacy email/compose links route into Support before email queries mount; preserve authored draft text and resolve imported conversation links through the authenticated Support lookup. Support-only access must not render or fetch email content or staff administration tabs.

Legacy `/support` links redirect to that tab while preserving request parameters and hashes. New links use `MESSAGING_SUPPORT_URL` or the same canonical URL, adding `&ticket=<id>` or `&new=1` as needed. Support is discoverable through the existing Messaging navigation, including the simplified header and mobile menu for roles without the desktop sidebar. Do not move it to a standalone workspace without explicit user instruction.

## Help stays inside Robbie chat

Help & guides is an in-chat panel, never a replacement page or chat mode. Keep Robbie's existing Home/History controls, messages, composer, session and draft mounted when guides open. Desktop uses a compact side panel; smaller screens use an accessible sheet that returns to the same chat. Existing `?tab=help` and `&article=<id>` links open that panel.

Ask Robbie about this prepares the existing composer, retains authored draft text and the current session, and waits for an explicit Send. Role-filtered guide access and Messaging Support links remain unchanged. Do not move guides to a standalone workspace without explicit user instruction.
