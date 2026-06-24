# BK-147 — Session Context

## Ticket
BK-147: App Shell | Open ATCs and Tests as tabs with a persistent explorer
Epic: BK-7 (Project & Module Hierarchy)
Status: Ready For QA
Priority: Highest
Story Points: 5

## Summary
Presentation-layer change: detail views (ATC editor, Test view) open as tabs inside a workbench with persistent project explorer sidebar. No backend change. PR #43 merged 19 Jun, deployed to staging. Ely confirmed "ready for QA verification."

## 10 ACs
1. App shell stays visible after sign-in (nav, workspace switcher, search, account block)
2. Explorer stays visible when opening an item (tab opens, tree stays, item highlighted)
3. Multiple tabs open at once (switch without losing)
4. Re-opening focused item does not duplicate tab
5. Closing active tab → adjacent tab becomes active
6. Closing last tab → workbench index state
7. Project toolbar reachable from any tab
8. Deep link opens directly as tab
9. Opening deleted/invisible item → safe not-found in-shell
10. Switching projects does not carry tabs across

## Design notes
- Pure frontend, no backend change
- Related to BK-32 (Test detail view, QA Approved)
- Labels: app-shell, from-bk32-review, ux

## Test approach
- Primary: UI/browser (Playwright CLI)
- Secondary: URL deep-link testing
- No API or DB testing needed (no backend change)

## Open questions
- How to authenticate for browser session? Test user credentials needed.
- Is "Rocket" project still available for testing (Ely validated on it)?
- What's the exact URL pattern for deep-linking tests/ATCs?
