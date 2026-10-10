# ADR-0006: Pin the GitHub REST API version for the CI failure-notification path

- Status: Proposed
- Date: 2026-10-10
- Supersedes: —
- Superseded by: —

> Scope note: this is a **CI / notification-path** decision, adjacent to the test suite
> rather than a test-architecture choice. It is recorded here at the requester's direction
> because it is a hard-to-reverse integration constraint on the repo's CI surface.

## Context

The `notify-failure` job in the four suite workflows (`sanity.yml`, `smoke.yml`,
`regression.yml`, `build.yml`) posts a GitHub issue on a red run via
`actions/github-script` (Octokit), calling `POST /repos/{owner}/{repo}/issues`.

The CI log emits this warning on every run:

```
[@octokit/request] "POST https://api.github.com/repos/nelgoez/bunkai-qa-engineering/issues"
is deprecated. It is scheduled to be removed on Fri, 10 Mar 2028 00:00:00 GMT.
See https://docs.github.com/en/rest/about-the-rest-api/api-versions
```

Root cause: **GitHub REST API versioning**, not an issues-endpoint sunset. Requests that omit
the `X-GitHub-Api-Version` header default to API version `2022-11-28`, whose published
**end of support is 2028-03-10**. Version `2026-03-10` is the current calendar version
(first with breaking changes). A request to a version past end-of-support returns `410 Gone`.

A second, independent warning rides the same job: `actions/github-script@v7` targets
Node.js 20, which is deprecated on GitHub runners (forced onto Node 24).

Adjacent fix landed in the same change set: the notify job's dedup key included the run
number, so it never deduplicated and opened one issue per failed run (16 accumulated). The
title is now stable per workflow and repeat failures append a comment instead.

## Decision

- Record `2028-03-10` as the deadline for the `2022-11-28` default on the CI notification path.
- **Defer the migration**: no code change now. The immediate objective is removing the noise
  and the issue-spam, both done.
- When migrating before the deadline, choose **one** of:
  1. Pin `X-GitHub-Api-Version: 2026-03-10` on the API call and apply the version's breaking
     changes (reviewed against the `2026-03-10` changelog).
  2. Upgrade `actions/github-script` (and thus Octokit) to a release that sends the current
     version by default, which also clears the Node-20 deprecation.
  3. Replace the Octokit call with the `gh` CLI (`gh issue create` / `gh issue comment`),
     which is already allowed in this repo's permission model.

- Preference order when the time comes: **(2) upgrade the action**, then **(3) `gh` CLI**,
  then **(1) manual header pin** (most coupled to Octokit internals).

## Consequences

### Positive

- The deadline and the exact remediation options are captured once, so it is a scheduled
  chore, not a future surprise that breaks CI silently.
- The stable-title dedup already removes the daily issue spam and the token/attention cost
  it carried across three workflows.

### Negative / trade-off

- Deferring leaves a known deprecation warning in every CI log until the migration, which
  trains readers to ignore warnings.
- Any of the three remediation paths is a workflow edit that must be applied to **all four**
  workflows in lockstep; a partial fix leaves inconsistent behavior.

## Alternatives considered

- **Fix now by pinning the header** — rejected for this pass: requires auditing the
  `2026-03-10` breaking changes against the notify payload, out of scope for the current work.
- **Ignore the warning** — rejected: it is dated and actionable; ignoring it risks a silent
  CI failure after 2028-03-10.
- **Drop the failure-notification job entirely** — rejected: a red suite must not be silent.
