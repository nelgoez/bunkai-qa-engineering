# Autonomous Gates — Gate bypass policy per mode

> Cited by: CLAUDE.md §2 (autonomous mode behavioral rule). This table is the
> single source of truth for which human checkpoints fire or auto-resolve at
> each autonomous level. Every workflow skill checkpoint is listed here.

## Modes

| Level | Behavior |
|-------|----------|
| `off` | Default — all checkpoints fire, all WAITs block. Standard operation. |
| `semi` | User approves scope/pick/plan upfront via permission manifest. Per-phase WAIT points still fire. |
| `full` | Only hard failures surface. Everything else auto-resolves per this table. |

## Gate bypass table

Legend: **HARD** = NEVER auto-approved (surface to user regardless of mode).
**Block** = normal WAIT-for-OK behavior. **Auto** = skip, proceed silently.
**Ask** = always prompt (even in semi mode).

### Sprint-Testing gates

| Gate ID | Stage | Gate name | `off` | `semi` | `full` |
|---------|-------|-----------|-------|--------|--------|
| G-ST-01 | Phase 0 | Session resume prompt | Ask | Ask | Auto-resume |
| G-ST-02 | SS | Story explanation WAIT | Block | Block | Auto-approve |
| G-ST-03 | SS | Sprint roadmap checkpoint (batch) | Block | Block | Auto-approve |
| G-ST-04 | SS | Environment reachability dead | **HARD** | **HARD** | **HARD** |
| G-ST-05 | SS | Inbox receive-check fail (auth tickets) | **HARD** | **HARD** | **HARD** |
| G-ST-06 | S1 | ATP review WAIT | Block | Block | Auto-approve |
| G-ST-07 | S1 | Risk score MEDIUM (4-7) ask | Ask | Ask | Auto: proceed |
| G-ST-08 | S1 | Risk score HIGH (8+) surface | Block | Block | Auto: log+proceed |
| G-ST-09 | S1 | Bug veto decision surface | Block | Block | Auto-approve |
| G-ST-10 | S2 | Smoke Go/No-Go | Block | Block | Auto: go if reachable |
| G-ST-11 | S2 | Blocking BUG_FOUND (security, data integrity) | **HARD** | **HARD** | **HARD** |
| G-ST-12 | S2 | Blocking BUG_FOUND (smoke/env down) | **HARD** | **HARD** | **HARD** |
| G-ST-13 | S2 | Non-blocking finding (cosmetic, minor) | Log | Auto: log+continue | Auto: log+continue |
| G-ST-14 | S2 | Severity recalibration gate (security/auth) | **HARD** | **HARD** | **HARD** |
| G-ST-15 | S3 | ATR review WAIT | Block | Block | Auto-approve |
| G-ST-16 | S3 | Bug creation confirmation | **HARD** | **HARD** | **HARD** |
| G-ST-17 | S3 | Ticket transition (Ready For QA → In Testing) | Ask | Ask | Auto-approve |
| G-ST-18 | S3 | Ticket transition (In Testing → Tested) | Ask | Ask | Auto-approve |
| G-ST-19 | S3 | Defect reported transition (blocked) | Ask | Ask | Auto-approve |
| G-ST-20 | S3 | Archive confirmation | Ask | Auto | Auto-archive |
| G-ST-21 | S3 | Per-ticket summary WAIT (batch) | Block | Block | Auto-approve |

### Test-Automation gates

| Gate ID | Stage | Gate name | `off` | `semi` | `full` |
|---------|-------|-----------|-------|--------|--------|
| G-TA-01 | Phase 0 | Session resume prompt | Ask | Ask | Auto-resume |
| G-TA-02 | Plan | Plan approval gate (Plan → Code) | Block | Block | Auto-approve |
| G-TA-03 | Plan | Scope picker ambiguous | Ask | Ask | Auto: ticket-driven |
| G-TA-04 | Code | Subagent failure | **HARD** | **HARD** | **HARD** |
| G-TA-05 | Review | Verifier ACCEPT gate | Block | Block | Auto: if all pass |
| G-TA-06 | Review | Review findings surface | Block | Block | Auto: log+proceed |
| G-TA-07 | Close | Archive confirmation | Ask | Auto | Auto-archive |

### Test-Documentation gates

| Gate ID | Stage | Gate name | `off` | `semi` | `full` |
|---------|-------|-----------|-------|--------|--------|
| G-TD-01 | Phase 0 | Session resume prompt | Ask | Ask | Auto-resume |
| G-TD-02 | Phase 0 | TMS modality ambiguous (ask user) | Ask | Ask | Auto: jira-xray |
| G-TD-03 | Scope | Scope picker ambiguous | Ask | Ask | Auto: ticket-driven |
| G-TD-04 | Scope | No Test Repository exists (ask) | Ask | Ask | Auto: skip create |
| G-TD-05 | Author | TC draft review | Block | Block | Auto-approve |
| G-TD-06 | Author | Candidate vs Manual verdict | Block | Block | Auto: Candidate |
| G-TD-07 | ROI | ROI calculation surface | Block | Block | Auto-approve |
| G-TD-08 | Close | Archive confirmation | Ask | Auto | Auto-archive |

### Regression-Testing gates

| Gate ID | Stage | Gate name | `off` | `semi` | `full` |
|---------|-------|-----------|-------|--------|--------|
| G-RG-01 | Phase 0 | Session resume prompt | Ask | Ask | Auto-resume |
| G-RG-02 | Trigger | Suite selection ambiguous | Ask | Ask | Auto: smoke |
| G-RG-03 | Trigger | Run confirmation | Block | Block | Auto-approve |
| G-RG-04 | Analyze | GO/NO-GO surface | Block | Block | Auto: GO if pass rate ≥ 95% |
| G-RG-05 | Analyze | REGRESSION classification surface | Block | Block | Auto: log+proceed |
| G-RG-06 | Close | Archive confirmation | Ask | Auto | Auto-archive |

### Shift-Left-Testing gates

| Gate ID | Stage | Gate name | `off` | `semi` | `full` |
|---------|-------|-----------|-------|--------|--------|
| G-SL-01 | Phase 0 | Session resume prompt | Ask | Ask | Auto-resume |
| G-SL-02 | Select | Candidate table WAIT | Block | Block | Auto: take all |
| G-SL-03 | Select | Per-Story summary WAIT | Block | Block | Auto-approve |
| G-SL-04 | Refine | Refinement draft review | Block | Block | Auto-approve |
| G-SL-05 | Refine | Ambiguity surface (no gap found) | Auto | Auto | Auto: skip |
| G-SL-06 | Close | Archive confirmation | Ask | Auto | Auto-archive |

### Cross-cutting gates (all skills)

| Gate ID | Gate name | `off` | `semi` | `full` |
|---------|-----------|-------|--------|--------|
| G-CC-01 | T4 skill load | **HARD** | **HARD** | **HARD** |
| G-CC-02 | Subagent TOOL_FAILURE | **HARD** | **HARD** | **HARD** |
| G-CC-03 | Environment dead / unreachable | **HARD** | **HARD** | **HARD** |
| G-CC-04 | Security / auth finding recalibration | **HARD** | **HARD** | **HARD** |
| G-CC-05 | Git push to main / force push | **HARD** | **HARD** | **HARD** |
| G-CC-06 | Credential missing (cannot proceed) | **HARD** | **HARD** | **HARD** |

## How the orchestrator uses this table

1. At mode activation (`autonomous ≠ off`), generate permission manifest citing gates that will auto-resolve.
2. At each checkpoint, cross-reference gate ID → mode column.
3. **HARD** → STOP, surface to user. Never auto-resolve.
4. **Block** → WAIT for user OK (semi/full skip this).
5. **Ask** → Prompt user regardless (even in semi).
6. **Auto** → Proceed silently. Log decision to `progress.md` notes field.
7. **Auto-resume** → Skip Phase 0 resume/restart/abort prompt. Read plan.md, jump to next phase.
8. **Auto-archive** → Move session dir to `.session/.archive/` without asking.

Gate ID format: `G-<SKILL_PREFIX>-<NN>` or `G-CC-<NN>` (cross-cutting).

## User preference overrides

The orchestrator reads user-level preferences BEFORE consulting this table.
Gate decisions from user preferences beat this table's defaults.

**opencode**: reads `~/.config/opencode/instructions/autonomous-preferences.md`
(loaded automatically via `instructions/*.md` glob in `opencode.json`).

**Claude Code**: reads `~/.claude/CLAUDE.md` (loaded at session start).

### Override format

Each preference file uses gate IDs from this table:

```markdown
## Gate overrides
- G-ST-06 (ATP review): auto_approve  → skip WAIT even in full mode
- G-ST-16 (bug creation): keep_hard    → keep HARD even in full mode
```

### Resolution order

1. User preference file (if present) → decides gate behavior
2. This table's mode column → fallback if preference file has no entry for that gate
3. HARD gates with explicit `keep_hard` in user file → stay HARD regardless of mode
4. HARD gates NOT in user file → this table's mode column decides

A gate ID missing from the user file falls through to this table. A gate ID
present in the user file with `auto_approve` beats the table's `Block`/`Ask`.
A gate ID present with `keep_hard` beats the table's `Auto`.
