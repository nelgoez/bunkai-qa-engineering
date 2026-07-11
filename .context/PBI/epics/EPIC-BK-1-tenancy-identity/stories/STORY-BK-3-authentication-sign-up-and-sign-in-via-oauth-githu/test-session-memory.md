# Test Session Memory — BK-3

**TMS Modality:** jira-native
**Active Env:** staging (staging-upexbunkai.vercel.app)
**Epic:** EPIC-BK-1-tenancy-identity

## Ticket Summary
- **Summary:** Authentication | Sign up and sign in via OAuth (GitHub / Google)
- **Assignee:** Andrés Daniel Cumare Morales
- **Status:** Ready For QA
- **Story Points:** 8
- **PR:** feature/BK-3-oauth → PR#56 (merged to staging, commit d56316c)

## Key Decisions (from comments.md)
1. **Redirect resolved**: first-time → `/onboarding`, returning → `/projects`
2. **AC-7 reversed**: identity linking ON (auto-link providers), `EMAIL_EXISTS` error path removed
3. **CSRF**: custom `state` cookie + server-side 403 on mismatch
4. **OAuth flow**: visitor clicks provider → consent screen → callback → state validation + code exchange → session + redirect

## Acceptance Criteria (10)
| AC | Summary | Gherkin |
|----|---------|---------|
| AC-1 | GitHub first-time sign-up | Given unauthenticated, When GitHub OAuth first time, Then workspace created + redirected /onboarding |
| AC-2 | Google first-time sign-up | Same as AC-1 but Google |
| AC-3 | Returning user no duplicate | Given existing workspace, When OAuth again, Then redirected /projects |
| AC-4 | Consent denied | When user denies OAuth consent, Then redirect back with error toast |
| AC-5 | CSRF state mismatch | When state cookie tampered, Then 403 returned |
| AC-6 | 3rd-party cookie blocked | When cookies blocked, Then polling fallback ≤30s |
| AC-7 | Cross-provider auto-link | When GitHub user then Google same email, Then linked to same workspace |
| AC-8 | Workspace bootstrap failure | When workspace creation fails, Then error shown |
| AC-9 | Initiation failure | When OAuth button fails to start flow, Then error shown |
| AC-10 | UI buttons enabled | GitHub/Google buttons visible, enabled, correct copy |

## Existing ATP
32 test outlines (10 positive, 8 negative, 10 boundary, 4 integration)
6 parametrized artifacts collapsing 13 data rows

## Stage State
- [ ] Stage 1 — Planning
- [ ] Stage 2 — Execution
- [ ] Stage 3 — Reporting
