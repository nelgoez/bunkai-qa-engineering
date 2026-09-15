# ADR-0003: Selector contract (`data-testid`)

- Status: Accepted
- Date: 2026-09-15
- Supersedes: —
- Superseded by: —

## Context

UI locators must survive product markup churn. A selector strategy tied to CSS layout or
copy breaks on every cosmetic refactor, so the contract must be stable and agreed with the
product team.

## Decision

The primary locator is the `data-testid` attribute, agreed with the product team so test ids
are first-class markup. Example (`tests/components/ui/LoginPage.ts`):

- `[data-testid="login-email"]`, `[data-testid="login-continue"]`,
  `[data-testid="login-password"]`, `[data-testid="login-signin"]`,
  `[data-testid="login-error"]`.

Locators are written inline in ATCs; a locator is extracted into a private helper only when
used 2+ times (the `fillAndSubmitLoginForm` pattern). Role/text locators are a fallback when
a stable `data-testid` is unavailable.

## Consequences

### Positive

- Stable across layout/copy refactors; test ids carry no styling or wording.
- Inline-locator + extract-at-2-uses keeps components small and readable (KATA rule).

### Negative / trade-off

- Depends on the product team adding and maintaining `data-testid`. A missing id forces a
  fallback locator and a note back to the product team.

## Alternatives considered

- **CSS / XPath selectors** — rejected: brittle, couples tests to layout structure.
- **Role-based locators only** — rejected: the app does not yet have complete ARIA semantics,
  so roles alone are not reliable.
