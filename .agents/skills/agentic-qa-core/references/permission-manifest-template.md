# Permission Manifest Template

> Cited by: CLAUDE.md §2 (autonomous mode behavioral rule). The pre-execution
> contract the orchestrator generates and presents to the user BEFORE any
> autonomous work begins. User approves once, then execution runs uninterrupted
> except for HARD gates.

## When to generate

BEFORE any skill execution when `autonomous ≠ off`:

0. **Read user preferences.** Check for user-level gate overrides:
   - **opencode**: read `~/.config/opencode/instructions/autonomous-preferences.md` (loaded at session start via instructions glob). Look for the target skill's mode default and any gate overrides.
   - **Claude Code**: read `~/.claude/CLAUDE.md`. Look for "Autonomous mode defaults" table + "Gate overrides" section.
   - If neither exists, proceed with `autonomous-gates.md` defaults only.
1. Read the target ticket / scope.
2. Load the skill's context files.
3. Identify every gate the skill's phases will pass through.
4. Cross-reference against `autonomous-gates.md` for the current mode, THEN apply user preference overrides (user prefs beat table defaults — see autonomous-gates.md §"User preference overrides").
5. Fill this template and present to user.
6. WAIT for user OK. NEVER auto-start without manifest approval.

The manifest is written to `.session/autonomous/<scope>/permission-manifest.md`
and kept as an audit record alongside `plan.md` / `progress.md`.

## Template

```markdown
## Autonomous Permission Manifest — <scope>

**Mode:** <semi|full>
**Skill:** <skill-slug>
**Scope:** <JIRA-KEY | module | sprint-N>
**Generated:** <ISO-8601>

### Summary

<One sentence describing what will happen.>

### Permission gates (auto-approved in this mode)

| Phase | Gate | Auto-decision | Risk |
|-------|------|---------------|------|
| Phase 0 | Session resume | Auto-resume / Fresh | — |
| <Phase> | <Gate name from autonomous-gates.md> | <Auto-decision> | <Risk note if any> |
| ... | ... | ... | ... |

### Hard stops (ALWAYS surface to user)

| Gate ID | Gate name | When it fires |
|---------|-----------|---------------|
| <G-ID> | <Name> | <Condition> |
| ... | ... | ... |

### Writes that will happen

- [ ] Transition ticket: <from> → <to>
- [ ] Create artifact: <ATP / ATR / TC / bug>
- [ ] Post comment on: <JIRA-KEY>
- [ ] Write evidence: .context/PBI/.../evidence/
- [ ] Modify files: <list>

### Files that will be modified

| File | Change |
|------|--------|
| <path> | <what changes> |

### Commands that will run

| Command | Purpose | Pre-approved |
|---------|---------|--------------|
| <cmd> | <why> | Yes / No (HARD) |

### Risks

- <Risk 1> — <mitigation>
- <Risk 2> — <mitigation>

### Recovery on failure

If a HARD gate fires mid-execution:
1. All progress up to that point is saved in `progress.md`.
2. Session stays in `.session/<skill>/<scope>/` (NOT archived).
3. User can resume after fixing the issue.
4. Non-HARD failures are logged and the session continues.
```

## HARD gate override request (optional section)

If the manifest includes a HARD gate the user wants to pre-approve (e.g., bug
creation is the only HARD stop and the user trusts the AI's judgment), add:

```markdown
### Pre-approved HARD gates

| Gate ID | Gate name | User override |
|---------|-----------|---------------|
| G-ST-16 | Bug creation confirmation | AUTO — file without asking |
```

This section is ONLY added when the user explicitly requests it. Never propose it.
