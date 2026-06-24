# Comments for BK-166

[View in Jira](https://jira.upexgalaxy.com/browse/BK-166)

---

### Automation for Jira - 22/6/2026, 00:39:27

🔎 Pull Request created. Task is pending to ANALYZE and REVIEW by the team. Waiting for PR Approval.

---

### Automation for Jira - 22/6/2026, 10:59:53

✅ Pull Request is successfully MERGED. Task is Done.

---

### Ely - 22/6/2026, 11:01:02

***Ready for QA on staging*** — PR [#54](https://github.com/upex-galaxy/upex-bunkai-tms/pull/54) merged to `staging`.

***What to test*** (https://staging-upexbunkai.vercel.app/login):

- Email-first routing: existing email → password step; new email → create step.
- Password sign-in (happy + wrong-password generic error, no enumeration leak).
- Sign-up → 6–8 digit email OTP → confirm → signed in.
- Unconfirmed account sign-in → routed to the verify step.
- Magic-link fallback still visible; OAuth still disabled.
- API rail: `POST /api/v1/auth/{signup,confirm,signin}` + `/check-email`; PAT + cookie coexist (no clobber).

***Notes for QA:***

- PATs minted on sign-in/confirm now use least-privilege default scopes (`atc:read`, `atc:write`, `run:execute`) — no global `workspace:admin` (per ADR-0005 / BK-135). ADR-0007 documents this feature.
- ⚠️ ***Email delivery caveat:*** the shared Supabase project is on the free-tier email cap, so a real human sign-up may not receive the OTP email until custom SMTP (Resend) is configured (in progress). For test accounts, use admin-confirmed users or `admin.generateLink` to obtain the OTP without inbox delivery.
- Migration `0034*auth*email*status*rpc` (service-role-only `auth*email*status` RPC) is applied to the shared DB.
- Smoke (Playwright, isolated logged-out profile) passed all code-path ACs on localhost.

---

### Benjamin Segovia - 23/6/2026, 19:18:54

Bug found during exploratory testing: BK-177 - Staging deployment missing email-first password sign-in UI and 2 of 4 BK-166 API routes

---

### Benjamin Segovia - 23/6/2026, 19:21:01

## QA Testing Complete - BK-166

***Environment******:*** Staging
***Result******:*** FAILED (0/42 TCs)

### Test Data Used

- Staging account: `STAGING*USER*EMAIL`

### Verified Behaviors

None — smoke test failed before any AC could be exercised.

### Failed Verification

- ***Smoke test******:*** staging serves the legacy magic-link-only login UI; `POST /api/v1/auth/check-email` and `POST /api/v1/auth/confirm` return HTTP 404 (route not deployed); `POST /api/v1/auth/signup` and `POST /api/v1/auth/signin` exist but return HTTP 422 instead of the documented 400.

### Defect

***BK-177*** (Critical) — Staging deployment missing email-first password sign-in UI and 2 of 4 BK-166 API routes. Root cause appears to be a deploy/build gap (source on `staging` branch has the feature; live site does not) — not an application logic defect.

### Notes

- AC4/AC11 (signup→OTP→confirm) were already out of scope for this environment regardless of the deploy gap — free-tier Supabase email cap, no service-role key available to QA tooling.
- DB cross-validation leg deferred this session (DBHub MCP pending `.env` credentials) — moot for this pass since the feature could not be reached.

***Artifacts******:*** ATP-customfield*10067, ATR-customfield*10147, Bug-BK-177

---

### Benjamin Segovia - 23/6/2026, 21:26:08

@@Ely heads up on this one — QA hit a blocker before any of the 42 planned test cases could run.

Staging (`https://staging-upexbunkai.vercel.app/login`) is still serving the old magic-link-only screen. At the API level, `POST /api/v1/auth/check-email` and `POST /api/v1/auth/confirm` return a plain 404 (route not found), and `signup`/`signin` exist but answer `422` instead of the `400` the code expects on a validation failure.

The `staging` branch itself looks right — `upex-bunkai-tms` is at commit `16863ca` (2026-06-22), which includes PR #54 — so the merge is there, the live deployment just doesn't reflect it. Filed as ***BK-177*** with the repro steps and evidence, linked back to this story, and transitioned BK-166 to Blocked until it's redeployed.

Could you check which Vercel deployment that staging alias is actually pointing to? Once it's serving the right build, QA picks the full pass back up immediately — the ATP (42 outlines) is already written and ready to go.

---


_Synced from Jira by sync-jira-issues_
