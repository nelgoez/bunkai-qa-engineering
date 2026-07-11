# BK-14 — Test Session Memory

**Status:** Stage 1 — Planning | **Strategy:** Balanced (API + UI)
**Environment:** Staging (staging-upexbunkai.vercel.app)
**Auth:** Need workspace member PAT + login session for UI

## Shared constants

- Base URL: https://staging-upexbunkai.vercel.app
- API prefix: /api/v1
- Module test: "BK-14 QA Test Module" (create if needed)
- Jira test key: "BK-42" (must not be linked to another story in this project)
- Test story title: "Refund a paid order"
- Short title: "Re"
- Malformed key: "not a key"
- Editor content: "# Heading\n**bold** and `code`"

## ATP structure

API tests (8):
1. POST create with full valid payload → 201
2. POST title "Re" (2 chars) → 422 validation_failed
3. POST title 201 chars → 422 too_long
4. POST description > 50KB → 422 too_large
5. POST external_id malformed → 422
6. POST duplicate external_id in project → 409
7. PATCH external_id immutable → 409
8. DELETE soft-deletes → GET returns 200 with deleted_at set
9. GET cross-workspace module → empty or 403

UI tests (4):
1. Create story via form → appears in module list, preview renders Markdown
2. Short title rejected → inline error shown
3. Jira key link visible on saved story
4. Remove story → disappears from list

## Data setup (prerequisites)

- Existing module "BK-14 QA Test Module" (or create via modules API)
- Workspace membership confirmed
- PAT or session cookie for staging auth
