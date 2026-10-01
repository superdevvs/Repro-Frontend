# Calls navigation

Calls uses the original `DashboardLayout`, including its shared sidebar, Navbar, and mobile navigation. Keep those shared panels and their existing role and responsive behavior unchanged unless the user explicitly requests a shell change.

Calls routes belong in one compact horizontal navigation row inside the dashboard content. Tabs overflow horizontally instead of wrapping or introducing a separate Calls sidebar or bottom navigation. Keep the current tab visible, keyboard-accessible route links, the Call action reachable on phones, and small scroll controls within the same row when tabs overflow.

`DashboardLayout.loading.test.tsx` protects the original header, desktop sidebar, and mobile navigation on Calls routes. `e2e/calls-workspace.e2e.ts` checks the shell, compact tabs, pagination, and scrolling across desktop/phone and light/dark themes.
