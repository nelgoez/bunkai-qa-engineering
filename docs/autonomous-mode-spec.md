# Autonomous Mode — AI-Native Checkpoint Governance for Agentic QA

> **Target audience**: AI agents (Claude Code, OpenCode) reading this document to understand, evaluate, and replicate the feature.
> **Context**: Engineering QA course project using OpenCode + agentic QA workflow skills (sprint-testing, test-automation, test-documentation, shift-left-testing, regression-testing).

---

## 1. Problem

Agentic QA workflow skills run 30+ minutes through multiple phases. Each phase fires human checkpoints: "review this plan", "approve this ATP", "confirm bug creation", etc. For experienced QA engineers who trust the AI's judgment, these checkpoints create unnecessary friction — the human babysits an otherwise autonomous pipeline.

**The problem is not "make everything automatic"** — it's "let me pre-approve the safe decisions and only interrupt me for the dangerous ones."

---

## 2. Solution: Three-tier gate bypass

Autonomous mode introduces a slider with three levels. Each level controls **when** the orchestrator blocks and asks for human input.

| Mode            | Behavior                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `off` (default) | All checkpoints fire. Every WAIT blocks. Standard operation.                                     |
| `semi`          | User approves scope/pick/plan upfront via permission manifest. Per-phase WAIT points still fire. |
| `full`          | Only HARD gates surface. Everything else auto-resolves.                                          |

Set via `/autonomous full|semi|off` in conversation, or via config key in settings.

---

## 3. Gate classification

Every workflow checkpoint is classified into four types. The classification is stored in a single-source-of-truth table (`autonomous-gates.md`).

| Gate type | Meaning                                     | `off` | `semi` | `full` |
| --------- | ------------------------------------------- | ----- | ------ | ------ |
| **HARD**  | Never auto-approve. Always surface to user. | Block | Block  | Block  |
| **Block** | Normal checkpoint. User must approve.       | Block | Block  | Auto   |
| **Ask**   | Prompt user regardless.                     | Ask   | Ask    | Auto   |
| **Auto**  | Proceed silently, log decision.             | Auto  | Auto   | Auto   |

### HARD gates (non-negotiable, fire in ALL modes)

| Gate ID | Condition                                      |
| ------- | ---------------------------------------------- |
| G-CC-01 | T4 skill load (high-risk external tool access) |
| G-CC-02 | Subagent TOOL_FAILURE                          |
| G-CC-03 | Environment dead / unreachable                 |
| G-CC-04 | Security / auth finding recalibration          |
| G-CC-05 | Git push to main / force push                  |
| G-CC-06 | Credential missing (cannot proceed)            |
| G-ST-11 | Blocking BUG_FOUND (security, data integrity)  |
| G-ST-12 | Blocking BUG_FOUND (smoke/env down)            |
| G-ST-14 | Severity recalibration (security/auth)         |
| G-ST-16 | Bug creation confirmation                      |

### Example: sprint-testing gates across modes

| Gate                      | `off`    | `semi`   | `full`        |
| ------------------------- | -------- | -------- | ------------- |
| Session resume prompt     | Ask      | Ask      | Auto-resume   |
| Story explanation WAIT    | Block    | Block    | Auto-approve  |
| ATP review WAIT           | Block    | Block    | Auto-approve  |
| Risk score MEDIUM ask     | Ask      | Ask      | Auto: proceed |
| Bug creation confirmation | **HARD** | **HARD** | **HARD**      |
| Archive confirmation      | Ask      | Auto     | Auto-archive  |

Full gate table covers all 6 workflow skills: sprint-testing (21 gates), test-automation (7), test-documentation (8), regression-testing (6), shift-left-testing (6), plus 6 cross-cutting gates.

---

## 4. Permission manifest (pre-flight contract)

When `autonomous ≠ off`, **before any skill execution**, the orchestrator MUST:

1. Load the target ticket/scope
2. Load relevant context files
3. Read user preference overrides (if any)
4. Cross-reference every gate the session will hit against the gate table for the current mode
5. Generate a **permission manifest** — a one-page upfront contract
6. Present it to the user
7. **WAIT for explicit OK**

### Manifest structure

```markdown
## Autonomous Permission Manifest — UPEX-123

**Mode:** full
**Skill:** sprint-testing
**Scope:** UPEX-123
**Generated:** 2026-06-03T12:00:00Z

### Permission gates (auto-approved in this mode)

| Phase   | Gate                 | Auto-decision         | Risk                         |
| ------- | -------------------- | --------------------- | ---------------------------- |
| Phase 0 | Session resume       | Auto-resume           | —                            |
| SS      | Story explanation    | Auto-approve          | Low — story already read     |
| S1      | ATP review           | Auto-approve          | Low — follows template       |
| S2      | Smoke Go/No-Go       | Auto: go if reachable | Medium — env assumed healthy |
| S3      | Archive confirmation | Auto-archive          | —                            |

### Hard stops (ALWAYS surface)

| Gate ID | Gate name                     | When it fires                    |
| ------- | ----------------------------- | -------------------------------- |
| G-ST-11 | Blocking BUG_FOUND (security) | Data integrity or auth bug found |
| G-ST-16 | Bug creation confirmation     | New bug needs to be filed        |

### Writes that will happen

- [ ] Transition ticket: Ready For QA → In Testing → Tested
- [ ] Create ATP + ATR + TC in Xray

### Commands that will run

| Command                   | Purpose            | Pre-approved |
| ------------------------- | ------------------ | ------------ |
| acli issue transition ... | Move ticket        | Yes          |
| git branch ...            | Create test branch | Yes          |
```

The manifest is written to `.session/autonomous/<scope>/permission-manifest.md` as an audit record.

---

## 5. Runtime gate resolution

At each checkpoint during execution, the orchestrator:

1. Looks up the gate ID in the gate table
2. Reads the mode column → gets the default decision
3. Applies user preference overrides if they exist (user prefs beat table defaults)
4. If **HARD** → STOP, surface to user, save progress to `progress.md`
5. If **Block** in current mode → WAIT for user OK
6. If **Auto** in current mode → proceed silently, log to `progress.md`

Subagents are **unchanged** — autonomous mode only affects the main-thread orchestrator, not dispatching or subagent behavior.

---

## 6. User preference overrides

Users can customize gate behavior via config files:

**OpenCode**: `~/.config/opencode/instructions/autonomous-preferences.md`
**Claude Code**: `~/.claude/CLAUDE.md` (section: "Autonomous mode defaults" + "Gate overrides")

```markdown
## Gate overrides

- G-ST-06 (ATP review): auto_approve → skip WAIT even in semi mode
- G-ST-16 (bug creation): keep_hard → keep HARD even in full mode
```

Resolution order:

1. User preference file (if present) → decides gate behavior
2. Gate table's mode column → fallback if no user override
3. HARD gates with `keep_hard` → stay HARD regardless of mode
4. HARD gates NOT in user file → table's mode column decides

---

## 7. Session management composition

Autonomous mode composes with the session persistence contract:

| Feature               | `off`                      | `semi`         | `full`                                        |
| --------------------- | -------------------------- | -------------- | --------------------------------------------- |
| Phase 0 resume check  | Ask (resume/restart/abort) | Ask            | Auto-resume (skip prompt, jump to next phase) |
| Archive on completion | Ask confirmation           | Auto-archive   | Auto-archive                                  |
| Failed session        | Leave in place             | Leave in place | Leave in place                                |

---

## 8. Files needed for implementation

Copy these files into the target repo to enable autonomous mode:

```
AGENTS.md                                    # Line: "/autonomous full|semi|off" command definition
CLAUDE.md                                    # §15 AUTONOMOUS MODE + AUTONOMOUS MODE behavioral register
.claude/skills/agentic-qa-core/references/
├── autonomous-gates.md                      # Gate classification table (single source of truth)
├── permission-manifest-template.md           # Pre-flight manifest template
└── session-management.md                    # §§4,8: auto-resume, auto-archive behavior
```

### Wiring into a skill's SKILL.md

Each workflow skill declares in its Subagent Dispatch Strategy:

```markdown
Orchestration & Session contracts: this skill follows
autonomous-gates.md (gate bypass policy) AND
session-management.md (auto-resume, auto-archive).
```

### Wiring into conversation

In AGENTS.md or CLAUDE.md, add:

```markdown
Autonomous mode: /autonomous full|semi|off.
off=default, all checkpoints fire.
semi=scope/pick/plan approved upfront; per-phase WAITs still fire.
full=only HARD gates surface.
When autonomous≠off: BEFORE any skill execution, generate permission manifest,
present, WAIT for OK.
Then execute with gate bypass per autonomous-gates.md.
```

---

## 9. Safety invariants

These are non-negotiable — the system must uphold them regardless of mode:

1. **Bug creation never auto-approved.** Filing a bug in the client's Jira is an irreversible action with external visibility. Always requires human confirmation.
2. **Security findings never downgraded.** If the AI detects a potential security or auth issue, it MUST surface it. Auto-recalibration is forbidden.
3. **Environment failure is always HARD.** If the target environment (staging, API, DB) is unreachable or returns auth errors, the session cannot proceed. No auto-retry loop.
4. **Manifest approval is mandatory.** Even in `full` mode, the initial permission manifest requires explicit human OK. The AI cannot auto-start autonomous execution.
5. **Progress is never lost.** If a HARD gate fires mid-execution, all progress up to that point is preserved in `progress.md`. Session stays in-place (not archived). User can resume after fixing the issue.

---

## 10. Why this works for AI agents

The gate table is machine-readable. An AI reading it can deterministically decide:

```
Given: mode = full, gate = G-ST-06 (ATP review WAIT)
Table says: full → Auto-approve
Action: proceed silently, log "ATP review auto-approved (autonomous=full)"
```

No ambiguity. No judgment call. The table is the contract.

The permission manifest is the upfront human approval. Once approved, the AI executes with clear "if this, then that" rules from the gate table. Only the hard stops interrupt.
