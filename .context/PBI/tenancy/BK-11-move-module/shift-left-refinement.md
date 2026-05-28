# Shift-Left Refinement: BK-11 — Move a Module to a different parent (with cycle-detection + path rebuild)

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-05-27
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena (QA Engineer) — reorganizes the Module taxonomy as the product-under-test evolves. Moves a sub-module from `/cart/add-to-cart` to `/checkout/add-to-cart` when the feature moves to a different domain.
- **Secondary personas (if any)**: Mateo (QA Lead) — expects the defect heatmap and coverage rollups to remain accurate after module reorganization. Karim (agent) — relies on module path stability for API-driven test discovery. Downstream references (US, AC, ATCs, Tests) must not break after a move.
- **Business value proposition**: Module reorganization is a routine product-maintenance operation. Without move, the taxonomy rots — modules stay in their original parent forever, misrepresenting the product structure. Move enables the Module tree to evolve with the product. Unlike create (BK-9), move is a **structurally dangerous** operation: a bug in cycle detection or path rebuild corrupts the **entire subtree**, not just one row.
- **KPI(s) influenced**: Module tree health (no orphans, no cycles), time-to-reorganize (seconds vs manual delete+recreate), traceability integrity (US/AC/ATC still reachable after move)
- **User journey position**: Flow 1 (Setup), Step 3 (post-initial-setup maintenance). After the initial Module tree is built (BK-9), Elena reorders and reorganizes it as the product scope evolves. Also invoked by Mateo when restructuring a mature project for reporting alignment.

### Technical context
- **Frontend**: Module tree context menu → "Move to..." action. Opens a parent-selector dialog (tree browser within same project). User picks destination parent + optionally sets position among new siblings. Drag-and-drop tree reordering likely Phase 2; MVP uses explicit move dialog.
- **Backend**: `POST /api/v1/modules/{id}/move` `{ parent_module_id: string | null, position?: number }` → 200 `{ module }`. Bearer + role (member+). **This is a dedicated RPC-style endpoint**, not a PATCH `parent_module_id` field — the complexity (cycle detection + path cascade + position rebalance + children_count update) justifies a dedicated transactional endpoint.
- **DB tables**: `modules` (id, project_id, parent_module_id, name, slug, path, depth, position, children_count, archived_at).
- **External services**: None.
- **Integration points specific to this Story**:
  - **Cycle detection**: Before accepting `parent_module_id`, recursively walk the subtree of the module being moved. If the target parent IS the module itself or any descendant, reject with `MODULE_CIRCULAR_PARENT`.
  - **Depth recheck**: Compute `new_depth = target_parent.depth + 1`. If `new_depth + subtree_max_depth > 6`, reject with `MODULE_MAX_DEPTH`. The subtree max depth must be computed from the module's descendants, not just the module's own depth.
  - **Path rebuild**: Update `modules.path` for the moved module AND all descendants (recursive CTE). New path = `target_parent.path + "/" + module.slug` for the moved module; descendants inherit the new prefix.
  - **Position rebalance at old parent**: After removing the module from its old parent, shift sibling positions down (decrement positions > old_position). Decrement old parent's `children_count`.
  - **Position insertion at new parent**: If `position` specified, shift existing siblings (increment positions ≥ new_position). If not specified, append at `MAX(position) + 1`. Increment new parent's `children_count`.
  - **Cross-project guard**: `parent_module_id` must belong to the same project as the module being moved. Reject with `PARENT_MODULE_WRONG_PROJECT`.
  - **Authorization**: Bearer (member+) of the workspace. Both source and target modules must belong to the same workspace.
  - **activity_log**: Append row with `action = "module.moved"`, `entity_type = "module"`, `payload_summary` including old_parent, new_parent, old_path, new_path.
  - **Realtime broadcast**: Publish updated module + all descendants on `project_id` channel for live tree refresh.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | **High** | Cycle detection (recursive CTE walk of subtree), path rebuild cascade (O(descendants)), depth recheck including subtree depth, position rebalance at two parents, children_count updates at two parents — all in a single transaction. This is the most algorithm-heavy Story in EPIC-BK-002. |
| Integration | Low | Single internal DB transaction (no external services). Realtime broadcast is infrastructure-level. |
| Data validation | **High** | Cycle detection correctness for arbitrary-depth trees, depth guard with subtree depth, position collision at new parent, parent existence + project scope + archived check, root move (`parent_module_id: null`) edge case, self-move no-op detection. |
| UI | Medium | Parent-selector dialog (tree browser within same project) + position preview among new siblings. Must show warning at depth ≥ 4 (soft warning). Must disable self and descendant nodes in the tree picker. |

**Estimated test effort**: ~4–6 person-hours (manual exploratory) + ~10–14 person-hours (automated tests, ~40+ outlines with parametrization). Informs PO estimation. HIGH risk justifies the investment.

### Epic-level inheritance (if applicable)
- **Epic**: EPIC-BK-002 — Project & Module Hierarchy
- **Risks restated at Story level**:
  - **Cycle creation** — a module becoming its own ancestor breaks recursive CTEs (infinite loop), crashes the tree view, and corrupts materialized paths. This is the highest-impact bug in the entire Module feature set.
  - **Path cascade corruption** — if path rebuild fails for some descendants, the module subtree splits into two disjoint path spaces. Breadcrumbs break; subtree queries return partial results.
  - **Concurrent move race condition** — two admins moving modules in the same tree simultaneously can produce orphaned positions, stale children_counts, or interleaved path updates.
  - **Depth overflow after move** — moving a deep subtree under a parent near the depth limit silently exceeds ≤6, breaking tree render performance.
- **Integration points inherited**: Supabase Auth (user identity), activity log (audit trail), Realtime (tree refresh). Same project-scoped isolation as BK-9.
- **PO/Dev answers already given at epic level**:
  - Module nesting depth ≤ 6, soft warning at 4 (business-data-map.md §2).
  - Materialized `path` column format: `/parent-slug/child-slug`.
  - Module slug is project-scoped unique (NOT changed by move — only path changes).
  - Cross-project moves NOT allowed (tenancy model, user-provided contract).
  - Soft-delete via `archived_at` with cascade (BK-039).
- **Test strategy inherited**: Hierarchy validation (depth, circularity, parent scope), tree integrity after move, path correctness for entire subtree, Realtime propagation.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | Story title only: "Move a Module to a different parent (with cycle-detection + path rebuild)" | What are the explicit acceptance criteria? Story has zero ACs. | Cannot derive test scenarios. All scenarios below inferred from domain context + user-provided contract. | Write explicit ACs: AC1 (Move to different parent), AC2 (Move to root), AC3 (Cycle detection rejection), AC4 (Depth limit after move), AC5 (Path rebuild for subtree), AC6 (Position rebalance), AC7 (Authorization). |
| 2 | Endpoint design: `POST /api/v1/modules/{id}/move` vs `PATCH /api/v1/modules/{id}` with `parent_module_id` field | User-provided: dedicated `/move` RPC-style endpoint. Alternative: reuse PATCH with `parent_module_id` body field. | Different URL surfacing, different Zod schema, different OpenAPI documentation. | **Adopt dedicated `POST /api/v1/modules/{id}/move`**. The move operation is complex enough (cycle detection + path cascade + dual position rebalance + dual children_count) to justify a dedicated endpoint. PATCH on modules should handle rename only (name change). |
| 3 | Slug after move — does it change? | Module slug derived from name at creation time. Does moving a module under a new parent change its slug? | Path assertions depend on knowing whether slug is stable. | **Slug does NOT change on move**. Only the `path` column is recalculated. Slug is a module identity property, not a location property. |
| 4 | Position behavior at old parent after removal | Should sibling positions at the old parent be compacted (shift to fill the gap) or left with a gap? | Position ordering tests at old parent depend on rebalance strategy. | **Compact**: shift all siblings with `position > removed_position` down by 1. This keeps positions contiguous (1,2,3,...). No gaps. |
| 5 | Depth limit after move — subtree depth | The constraint is "module depth ≤ 6". If a module at depth 2 with descendants at depth 5 (subtree spans 2→5) is moved under a parent at depth 3, the deepest descendant would be at depth 6 (OK). If moved to depth 4, deepest descendant would be at depth 7 (rejected). Is this the intended behavior? | Test data for depth scenarios requires knowing subtree-depth computation. | **Confirmed**: compute `new_max_depth = target_parent.depth + 1 + subtree_depth`. Where `subtree_depth = MAX(descendant.depth) - module.depth`. If `new_max_depth > 6`, reject with `MODULE_MAX_DEPTH`. |
| 6 | Cross-project move guard | User-provided contract says cross-project move is NO. What error code? | Negative test scenario blocked. | Reject with `400 PARENT_MODULE_WRONG_PROJECT`. Same error as BK-9 create. |
| 7 | Move to same parent (no-op) | What happens when `parent_module_id` equals the current parent? | Undefined behavior — should this be a no-op 200 or a 400 error? | **No-op → 200** with the module unchanged. Avoids unnecessary transaction overhead. Optionally return 400 `MODULE_ALREADY_IN_PARENT` if stricter UX is desired. **NEEDS PO/DEV CONFIRMATION**. |
| 8 | Moving a module under an archived parent | Should archived modules accept children? | Consistent with BK-9 create behavior. | **Reject** with `400 PARENT_MODULE_ARCHIVED`. Same as BK-9 Scenario 2.4. |
| 9 | Moving an archived module | Can an archived (soft-deleted) module be moved? | Edge case that could break path rebuild. | **Reject** with `400 MODULE_ARCHIVED`. Archived modules should be immutable. **NEEDS PO/DEV CONFIRMATION**. |
| 10 | Activity log detail | Should the activity log record the old_path and new_path, or just old_parent_id and new_parent_id? | Audit trail completeness for debugging path corruption. | Record both: `{action: "module.moved", old_parent_id, new_parent_id, old_path, new_path, moved_descendants_count}`. Enables reconstruction of moves from the audit log. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | No acceptance criteria. Story is a title + contract sketch. | Write full AC set (7 ACs minimum). | QA cannot design test scenarios. Dev has no contract. PO cannot estimate. |
| 2 | AC | No error catalog for move-specific failures. | Error codes: `MODULE_CIRCULAR_PARENT`, `MODULE_MAX_DEPTH`, `PARENT_MODULE_NOT_FOUND`, `PARENT_MODULE_WRONG_PROJECT`, `PARENT_MODULE_ARCHIVED`, `MODULE_ARCHIVED`, `MODULE_ALREADY_IN_PARENT` (if no-op → error), `VALIDATION_ERROR`. | Negative test scenarios blocked. Inconsistent error codes across endpoints. |
| 3 | AC | No AC for path rebuild of all descendants. This is the riskiest part of the operation. | Add Positive scenario: Given module with 3 levels of descendants, When moved to new parent, Then all descendant paths reflect the new prefix. | Partial path rebuild silently corrupts the subtree — breadcrumbs and subtree queries produce wrong results. |
| 4 | AC | No AC for concurrent move protection. | Add Technical AC: When two concurrent moves target the same module or modify the same subtree, either both succeed with consistent state OR one is rejected with no partial writes. | Race condition between two admins reorganizing the same tree simultaneously. |
| 5 | AC | No AC for position rebalance at both old and new parent. | Add scenarios: verify old parent positions compacted, new parent positions shifted if explicit position given. | Position ordering breaks — modules appear in wrong order in tree view, drag-reorder (Phase 2) foundation is corrupted. |
| 6 | AC | No AC for children_count update on both old and new parent. | Add assertions: old parent children_count decremented, new parent children_count incremented. | Tree view shows wrong child counts, "expand" chevrons appear/disappear incorrectly. |
| 7 | AC | No AC for depth recomputation of entire subtree. | Add assertion: verify every descendant's `depth` column reflects the new position in the tree. | Depth enforcement for future creates uses stale depth values — modules may exceed depth 6 without being caught. |
| 8 | Technical detail | Transaction scope — is the entire move (cycle check + path update + position rebalance + children_count + activity_log) in ONE database transaction? | Implementation and test rollback scenarios need to know this. | Without a transaction, partial failure leaves the tree in an inconsistent state (module moved but descendants have old paths). |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Move module to root level (`parent_module_id: null`) | Module becomes a root module. `path = "/{slug}"`, `depth = 0`. All descendant paths recalculated from new root. Old parent children_count decremented. | Critical | Add to AC |
| 2 | Move deep subtree (module at depth 3 with descendants at depth 5) to root | Subtree max depth after move = 2 (root→L1 = depth 1, descendant at relative depth 2). All paths recalculated. Position appended to root-level siblings. | Critical | Add to AC (Boundary) |
| 3 | Move module at depth 5 with one child at depth 6 to a parent at depth 1 | New subtree spans depths 2→3. OK — well within depth 6 limit. | High | Add to AC (Positive) |
| 4 | Move module at depth 3 with deep descendants (down to depth 6) to a parent at depth 1 | New deepest descendant = 1 + (6-3) + 1 = depth 5. OK. | High | Test only |
| 5 | Move module at depth 3 with deep descendants (down to depth 6) to a parent at depth 4 | New deepest descendant = 4 + 1 + (6-3) = depth 8. **Rejected** with MODULE_MAX_DEPTH. | Critical | Add to AC |
| 6 | Cyclic move: A → B → C, try to move A under C (C is descendant of A) | Reject with `MODULE_CIRCULAR_PARENT`. Recursive CTE detects C is in A's subtree. | Critical | Add to AC |
| 7 | Direct self-reference: move module to itself as parent | Reject with `MODULE_CIRCULAR_PARENT`. Trivial check. | High | Add to AC |
| 8 | Move to non-existent parent | Reject with `404 PARENT_MODULE_NOT_FOUND`. | High | Add to AC |
| 9 | Move to parent in a different project | Reject with `400 PARENT_MODULE_WRONG_PROJECT`. | Critical | Add to AC |
| 10 | Two concurrent moves swapping two modules (A ↔ B) | Both should succeed. The second move reads the post-move state of the first. OR one is rejected if implemented with optimistic locking. | High | Test only (concurrent test tooling) |
| 11 | Move a module currently being viewed by another user | Move succeeds. Realtime broadcast updates the other user's tree view within 3s. | Medium | Add to AC (Integration) |
| 12 | Move a module that has User Stories, ACs, ATCs, and Tests anchored to it | Move succeeds. Downstream entities remain linked via `module_id` FK (unchanged). They are discoverable via the new path in the tree. No cascade needed — the FK is stable. | Critical | Add to AC (Integration) |
| 13 | Move with explicit position `99999` when new parent has 3 children | Position clamped to `MAX(position) + 1` (append at end) OR inserted at 99999 with gaps. | Low | Ask Dev |
| 14 | Move with `position: 0` or `position: -1` | Reject with `400 VALIDATION_ERROR` "Position must be a positive integer". | Medium | Add to AC (Boundary) |
| 15 | Move at depth 4 (soft warning boundary) | Move succeeds normally. UI shows soft warning toast: "Module nesting is getting deep (level 4). Consider flattening." | Medium | Add to AC (UI edge) |
| 16 | Move a module with no children (leaf node) | Move succeeds. Only the module's own row is updated (path, depth, position, parent_module_id). No cascade needed. | Critical | Add to AC (Positive) |
| 17 | Move a module with 100 descendants | All 100 descendant paths recalculated in one transaction. Performance budget: p95 < 200ms. | High | Test only (Performance) |
| 18 | Move module, then immediately query tree view | Tree view renders the module at the new position. Old position shows sibling shift. | High | Test only (E2E) |
| 19 | Unauthenticated request to `/move` | `401 UNAUTHORIZED`. | High | Add to AC |
| 20 | Viewer role user attempting move | `403 FORBIDDEN`. Viewers cannot mutate. | High | Add to AC |
| 21 | Moving the last child of a module (old parent children_count becomes 0) | Old parent `children_count = 0`. Tree view hides expand chevron. | Medium | Add to AC (Boundary) |

### Contradictions
| # | Source A | Source B | Conflict | Resolution needed |
|---|----------|----------|-----------|-------------------|
| 1 | User-provided: `POST /api/v1/modules/{id}/move` | business-feature-map.md FEAT-006: "Module create / rename / move / soft-delete" — move listed alongside rename (PATCH) | Is move a dedicated endpoint or a field in PATCH? | **Adopt dedicated endpoint** `POST /modules/{id}/move`. PATCH on modules handles rename only. The complexity of move justifies its own transactional endpoint. Update feature-map if needed. |
| 2 | business-data-map.md §2: "Module depth ≤ 6" | No FR specifies whether depth is checked against the moved module's own depth or the deepest descendant's depth after move. | Subtree depth vs module depth — the constraint must account for descendants. | **Subtree max depth** (deepest descendant) must be ≤ 6 after move. Verified in Ambiguity #5 above. |
| 3 | business-data-map.md §5: "Materialized paths updated on parent change" | No FR specifies whether path update cascades to descendants atomically or lazily. | Cascade scope — all descendants vs batch job. | **Atomic cascade in the same transaction**. Lazy path update would create a window where descendant paths refer to the old parent prefix. |

### Testability validation
**Verdict**: Partial — must resolve before sprint planning.

Issues:
- **No acceptance criteria** — Story is a title + contract sketch. All scenarios in Phase 3 are inferred.
- **No error catalog** — 8+ validation rules implied but no error codes specified.
- **No performance budget** — path rebuild cascade for large subtrees (100+ descendants) has undefined latency target.
- **Subtree depth computation unspecified** — ambiguity #5 blocks test data generation for depth-limit scenarios.
- **No-open vs error on same-parent move** — ambiguity #7 affects UX behavior.
- **Archived module move behavior unspecified** — ambiguity #9 needs confirmation.
- **No concurrency strategy** — optimistic lock, pessimistic lock, or last-write-wins?

---

## Phase 3 — Refined Acceptance Criteria

> **Note**: ALL scenarios below are inferred from domain context (business-data-map.md §2, business-feature-map.md FEAT-006, user-provided API contract). Every scenario is marked **NEEDS PO/DEV CONFIRMATION** because the Story has zero original ACs.

### AC1 — Move module to a different parent (Positive)

#### Scenario 1.1: Should move a leaf module to a different parent within the same project (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: entire AC is inferred
- **Given**: Project "Checkout v2" has modules "Cart" (id=mod-cart, depth=0, children_count=0) and "Payment" (id=mod-payment, depth=0, children_count=1). Module "Coupon" (id=mod-coupon, slug="coupon", path="/cart/coupon", depth=1, parent_module_id=mod-cart, position=1) is a child of "Cart". Authenticated user is member+.
- **When**: `POST /api/v1/modules/mod-coupon/move` with body `{ "parent_module_id": "mod-payment" }`
- **Then**:
  - **API**: `200 { "success": true, "data": { "id": "mod-coupon", "name": "Coupon", "slug": "coupon", "path": "/payment/coupon", "parent_module_id": "mod-payment", "depth": 1, "position": 1, "children_count": 0, "project_id": "proj-01" } }`
  - **DB**: `modules` row for "Coupon": `path="/payment/coupon"`, `parent_module_id=mod-payment`, `depth=1`, `position=1`. Old parent "Cart": `children_count` decremented to 0. New parent "Payment": `children_count` incremented to 2. Old parent sibling positions compacted (module at position 2 shifted to position 1 if any).
  - **System state**: `activity_log` row with `action="module.moved"`, `payload_summary` including old_parent_id, new_parent_id, old_path="/cart/coupon", new_path="/payment/coupon". Realtime broadcast on `project_id=proj-01` channel — tree view refreshes.
  - **UI**: Module "Coupon" disappears from under "Cart" and appears under "Payment" in the tree.

#### Scenario 1.2: Should move a module with descendants and rebuild all child paths (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" (id=mod-cart, path="/cart", depth=0) has child "Checkout" (id=mod-checkout, path="/cart/checkout", depth=1) which has child "Billing" (id=mod-billing, path="/cart/checkout/billing", depth=2). Module "Payment" (id=mod-payment, path="/payment", depth=0) exists.
- **When**: `POST /api/v1/modules/mod-checkout/move` with body `{ "parent_module_id": "mod-payment" }`
- **Then**:
  - **API**: `200`. Module "Checkout" returned with `path="/payment/checkout"`, `depth=1`, `parent_module_id=mod-payment`. Child "Billing" implicitly updated (not returned in response but verifiable via GET).
  - **DB**: "Checkout" row: `path="/payment/checkout"`, `depth=1`. "Billing" row: `path="/payment/checkout/billing"`, `depth=2`. Old parent "Cart": `children_count` decremented. New parent "Payment": `children_count` incremented. Old parent sibling positions compacted.
  - **Key assertion**: `GET /api/v1/modules/mod-billing` returns `path="/payment/checkout/billing"` (not `/cart/checkout/billing`).

#### Scenario 1.3: Should move a module to root level (`parent_module_id: null`) (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Add to Cart" (id=mod-atc, path="/cart/add-to-cart", depth=1, parent_module_id=mod-cart, position=1). Module "Cart" has 2 children.
- **When**: `POST /api/v1/modules/mod-atc/move` with body `{ "parent_module_id": null }`
- **Then**:
  - **API**: `200`. Module returned with `path="/add-to-cart"` (or "/add-to-cart" — root path format), `depth=0`, `parent_module_id=null`, `position=<last_root_sibling + 1>`.
  - **DB**: `parent_module_id = null`, `path = "/add-to-cart"`, `depth = 0`. Old parent "Cart": `children_count` decremented to 1.

#### Scenario 1.4: Should move a module and explicitly set position among new siblings (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: shift siblings or reject?
- **Given**: Module "Payment" has 3 children at positions 1 (GiftCard), 2 (Stripe), 3 (PayPal). Module "Coupon" (currently under "Cart", position 1) to be moved.
- **When**: `POST /api/v1/modules/mod-coupon/move` with body `{ "parent_module_id": "mod-payment", "position": 2 }`
- **Then**:
  - **API**: `200`. "Coupon" at position 2 under "Payment". Siblings shifted: GiftCard stays at 1, Stripe at 3, PayPal at 4.
  - **DB**: "Coupon" position = 2. "Stripe" position = 3. "PayPal" position = 4.

#### Scenario 1.5: Should move module and auto-assign position at end when position not specified (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Payment" has 2 children at positions 1 and 2.
- **When**: `POST /api/v1/modules/mod-coupon/move` with body `{ "parent_module_id": "mod-payment" }` (no position)
- **Then**: `200`. "Coupon" gets position 3 (MAX + 1).

#### Scenario 1.6: Should preserve slug after move (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Coupon" with slug "coupon", path "/cart/coupon".
- **When**: Moved to parent "Payment" (slug "payment").
- **Then**: Slug remains "coupon". Path becomes "/payment/coupon". Slug is identity, not location.

---

### AC2 — Cycle detection (Negative)

#### Scenario 2.1: Should reject move when target parent is the module itself (self-reference) (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Cart" with id `mod-cart`.
- **When**: `POST /api/v1/modules/mod-cart/move` with body `{ "parent_module_id": "mod-cart" }`
- **Then**: `400 { "success": false, "error": { "code": "MODULE_CIRCULAR_PARENT", "message": "Cannot set a module as its own parent" } }`. No DB change.

#### Scenario 2.2: Should reject move when target parent is a descendant of the module (indirect cycle) (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Chain: "Cart" (L0) → "Checkout" (L1) → "Billing" (L2). Module "Billing" is id `mod-billing`.
- **When**: `POST /api/v1/modules/mod-cart/move` with body `{ "parent_module_id": "mod-billing" }` — Cart would become a child of Billing, which is its grandchild.
- **Then**: `400 { "success": false, "error": { "code": "MODULE_CIRCULAR_PARENT", "message": "Cannot set parent to a descendant module. This would create a cycle." } }`. No DB change. Recursive CTE detects Billing is in Cart's descendant tree.

#### Scenario 2.3: Should reject move when target parent is the current parent (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: no-op 200 vs error 400?
- **Given**: Module "Coupon" with parent_module_id = `mod-cart`.
- **When**: `POST /api/v1/modules/mod-coupon/move` with body `{ "parent_module_id": "mod-cart" }`
- **Then**: Either `200` with unchanged module (no-op) OR `400 { "code": "MODULE_ALREADY_IN_PARENT", "message": "Module is already in this parent" }`. **Recommend**: 200 no-op — avoids unnecessary error handling in the UI. **NEEDS PO/DEV CONFIRMATION**.

---

### AC3 — Depth limit after move (Negative + Boundary)

#### Scenario 3.1: Should reject move when subtree depth would exceed 6 at new parent (Type: Negative, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Gateway" is at depth 3, has descendants down to depth 6 (subtree spans 4 levels: depth 3,4,5,6). Target parent "Root-A" is at depth 4.
- **When**: `POST /api/v1/modules/mod-gateway/move` with body `{ "parent_module_id": "mod-root-a" }`
- **Then**: New maximum descendant depth = 4 (target parent depth) + 1 (gateway as child) + (6-3) (subtree relative depth) = 8. Rejected: `400 { "success": false, "error": { "code": "MODULE_MAX_DEPTH", "message": "Moving this module would cause descendants to exceed the maximum nesting depth of 6" } }`. No DB change.

#### Scenario 3.2: Should allow move when subtree depth is exactly 6 after move (Type: Boundary, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Gateway" at depth 2, deepest descendant at depth 5 (relative subtree depth = 3). Target parent at depth 2.
- **When**: Moved to target parent.
- **Then**: New deepest descendant = 2 + 1 + 3 = 6. **Allowed** — depth 6 is the maximum. Return 200.

#### Scenario 3.3: Should allow move to root when subtree depth ≤ 6 (Type: Boundary, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module at depth 3 with descendants down to depth 5 (relative depth = 2). Move to root.
- **When**: `POST /api/v1/modules/{id}/move` with `{ "parent_module_id": null }`
- **Then**: New maximum depth = 0 + 1 + 2 = 3. **Allowed**. Return 200.

#### Scenario 3.4: Should show soft warning when moved module lands at depth ≥ 4 (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: UI-only concern?
- **Given**: Module moved to a parent at depth 3 (so module lands at depth 4).
- **When**: User performs move via UI.
- **Then**: API returns 200 normally. UI shows soft warning toast: "Module nesting depth is 4. Consider flattening your hierarchy." API does NOT reject.

---

### AC4 — Position rebalance (Boundary)

#### Scenario 4.1: Should compact sibling positions at old parent after module removal (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Parent "Cart" has 3 children at positions 1, 2, 3. Module at position 2 is moved away.
- **When**: Move completes.
- **Then**: Remaining siblings: position 1 stays at 1, position 3 shifts to 2. No gap at position 2.

#### Scenario 4.2: Should decrement old parent children_count and increment new parent children_count (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: "Cart" has children_count=3. "Payment" has children_count=1.
- **When**: Move a child from "Cart" to "Payment".
- **Then**: "Cart" children_count = 2. "Payment" children_count = 2. Tree view chevrons updated accordingly.

#### Scenario 4.3: Should reject position 0 or negative (Type: Boundary, Priority: Medium)
- **Given**: Valid target parent exists.
- **When**: `POST /api/v1/modules/{id}/move` with `{ "parent_module_id": "<id>", "position": 0 }`
- **Then**: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Position must be a positive integer" } }`. No DB change.

#### Scenario 4.4: Should handle position beyond current sibling count (Type: Edge, Priority: Low)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Target parent has 3 children at positions 1,2,3.
- **When**: Move with `position: 99999`
- **Then**: Module appended at position 4 (clamped to MAX + 1) OR inserted at position 99999 (gap). **Recommend**: clamp to MAX + 1.

---

### AC5 — Authorization and validation (Negative)

#### Scenario 5.1: Should reject move when target parent module does not exist (Type: Negative, Priority: High)
- **Given**: Module `mod-999` does not exist.
- **When**: `POST /api/v1/modules/{id}/move` with `{ "parent_module_id": "mod-999" }`
- **Then**: `404 { "success": false, "error": { "code": "PARENT_MODULE_NOT_FOUND", "message": "Parent module not found" } }`. No DB change.

#### Scenario 5.2: Should reject move when target parent belongs to a different project (Type: Negative, Priority: Critical)
- **Given**: Module "Checkout" belongs to Project A (proj-01). Target parent "Payment" belongs to Project B (proj-02).
- **When**: `POST /api/v1/modules/mod-checkout/move` with `{ "parent_module_id": "mod-payment" }`
- **Then**: `400 { "success": false, "error": { "code": "PARENT_MODULE_WRONG_PROJECT", "message": "Parent module does not belong to the same project" } }`. No DB change.

#### Scenario 5.3: Should reject move when target parent is archived (Type: Negative, Priority: Medium)
- **Given**: Module "Legacy" has `archived_at` set.
- **When**: `POST /api/v1/modules/{id}/move` with `{ "parent_module_id": "<legacy-id>" }`
- **Then**: `400 { "success": false, "error": { "code": "PARENT_MODULE_ARCHIVED", "message": "Cannot move a module under an archived parent" } }`. No DB change.

#### Scenario 5.4: Should reject move when module being moved is archived (Type: Negative, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Old Feature" has `archived_at` set.
- **When**: `POST /api/v1/modules/<old-feature-id>/move` with `{ "parent_module_id": "<valid-parent>" }`
- **Then**: `400 { "success": false, "error": { "code": "MODULE_ARCHIVED", "message": "Cannot move an archived module" } }`. No DB change.

#### Scenario 5.5: Should reject move when module being moved does not exist (Type: Negative, Priority: High)
- **Given**: Module `mod-999` does not exist.
- **When**: `POST /api/v1/modules/mod-999/move` with `{ "parent_module_id": "<valid>" }`
- **Then**: `404 { "success": false, "error": { "code": "MODULE_NOT_FOUND", "message": "Module not found" } }`. No DB change.

#### Scenario 5.6: Should reject unauthenticated requests (Type: Negative, Priority: High)
- **Given**: No valid auth token.
- **When**: `POST /api/v1/modules/{id}/move`
- **Then**: `401 { "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`. No DB change.

#### Scenario 5.7: Should reject viewer-role user (Type: Negative, Priority: High)
- **Given**: User is a `viewer` in the workspace.
- **When**: `POST /api/v1/modules/{id}/move`
- **Then**: `403 { "success": false, "error": { "code": "FORBIDDEN", "message": "Member role or higher required to move modules" } }`. No DB change.

#### Scenario 5.8: Should reject move with empty request body (Type: Boundary, Priority: Medium)
- **Given**: Valid module exists. Authenticated user.
- **When**: `POST /api/v1/modules/{id}/move` with body `{}`
- **Then**: `400 { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "parent_module_id is required" } }`. No DB change.

---

### AC6 — Data integrity after move (Integration)

#### Scenario 6.1: Should rebuild depth column for all descendants after move (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Checkout" at depth 1 with child "Billing" at depth 2 and grandchild "Invoice" at depth 3. Moved to new parent at depth 2.
- **When**: Move completes.
- **Then**: "Checkout" depth = 3. "Billing" depth = 4. "Invoice" depth = 5. All depth columns updated in the same transaction.

#### Scenario 6.2: Should preserve module identity (id, slug, name) after move (Type: Positive, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module with id, slug, name, project_id.
- **When**: Moved to new parent.
- **Then**: id, slug, name, project_id, created_at unchanged. Only parent_module_id, path, depth, position, updated_at change.

#### Scenario 6.3: Should keep downstream entities (US, AC, ATCs, Tests) linked to module after move (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Module "Coupon" has 2 User Stories, 3 ATCs, and 1 Test anchored to it.
- **When**: Module moved to new parent.
- **Then**: All downstream entities remain linked via `module_id` FK (unchanged). `GET /api/v1/modules/mod-coupon/user-stories` returns the same 2 User Stories. Tree view shows them under the new path.

#### Scenario 6.4: Should write activity_log row with move details (Type: Positive, Priority: High)
- **Given**: Valid move request.
- **When**: Move succeeds.
- **Then**: `activity_log` row with `action="module.moved"`, `entity_type="module"`, `entity_id=<module-id>`, `payload_summary` containing old_parent_id, new_parent_id, old_path, new_path, moved_descendants_count.

#### Scenario 6.5: Should broadcast Realtime update on project channel (Type: Integration, Priority: High)
- **Given**: User A viewing the tree, User B performs move.
- **When**: Move completes.
- **Then**: User A's tree view updates within 3s. Module appears at new location. Old location shows sibling compaction.

#### Scenario 6.6: Should roll back entire transaction on partial failure (Type: Integration, Priority: Critical)
- **Given**: Move succeeds for the module but path update for a descendant fails (simulated DB error).
- **When**: Transaction rolls back.
- **Then**: Module stays in original location. No partial writes. Old parent children_count unchanged. New parent children_count unchanged. activity_log NOT written. Return 500.

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should handle concurrent moves on different modules in disjoint subtrees (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: optimistic locking vs serializable isolation?
- **Given**: Module A (under parent X) and Module B (under parent Y). X and Y are unrelated.
- **When**: Two concurrent move requests: Move A to parent Z, Move B to parent W.
- **Then**: Both succeed. No interference. Children counts correct on all four parents.

#### Scenario E2: Should handle concurrent moves targeting the same new parent (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**
- **Given**: Parent "Payment" has 1 child. Modules A and B are in different subtrees.
- **When**: Two concurrent move requests both targeting parent "Payment" with no explicit position.
- **Then**: Both succeed. One gets position 2, other gets position 3 (or one gets 409 if position conflict). Children_count = 3. No lost updates.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 8 | Leaf move, subtree move, move to root, position specified, position auto, slug stability, depth recomputation, downstream entity preservation |
| Negative | 14 | Self-reference cycle, indirect descendant cycle, same-parent no-op, depth overflow (subtree), parent not found, parent wrong project, parent archived, module archived, module not found, unauthenticated, viewer forbidden, empty body, position 0, missing module_id |
| Boundary | 6 | Depth exactly 6 after move, depth 7 rejected, root move with subtree, position clamp (large value), children_count zero, last child moved |
| Integration | 5 | Activity log write, Realtime broadcast, transaction rollback, downstream FK stability, concurrent disjoint moves |
| Performance | 2 | 100-descendant path rebuild latency, tree view render after move |
| API | 4 | 200 response shape, error envelope consistency, OpenAPI spec coverage, rate limit enforcement |
| **Total** | **39** | HIGH risk justifies thorough coverage — tree corruption is the hardest bug to fix in production |

**Rationale**: Module move is the most algorithmically complex operation in the tenancy domain. Five structural risks (cycle creation, path corruption, depth overflow, position desync, children_count drift) each require Positive + Boundary + Error paths. The subtree path rebuild cascading through N descendants is a breadth-first verification problem — every depth level, every descendant path, every intermediate state must be correct. The 39-outline count reflects this: ~4 outlines per risk × 5 risks + integration + performance.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should move a leaf module to a different parent** — Pre: module at depth 1 under "Cart", target "Payment" at depth 0. Expected: 200, path="/payment/{slug}", depth=1, old parent children_count--, new parent children_count++.
- **Should move a module with descendants and rebuild all child paths** — Pre: module with 2 levels of descendants, moved to new parent. Expected: all descendant paths begin with new parent prefix, all depths recalculated.
- **Should move a module to root level** — Pre: module at depth 1, `parent_module_id: null`. Expected: 200, path="/{slug}", depth=0, position appended to root siblings.
- **Should move a module with explicit position and shift siblings** — Pre: target parent has 3 children, position=2. Expected: 200, module at pos 2, siblings at pos 1,3,4.
- **Should auto-assign position at end when not specified** — Pre: target parent has 2 children. Expected: 200, module at position 3.
- **Should preserve module slug after move** — Pre: slug="coupon", move to "/payment". Expected: 200, slug unchanged, path="/payment/coupon".
- **Should not change module identity fields (id, name, project_id, created_at)** — Pre: valid move. Expected: all identity columns unchanged.
- **Should preserve downstream entity FK links after move** — Pre: module has US/AC/ATCs anchored. Expected: all entities still reachable via module_id after move.

#### Negative
- **Should reject self-reference (module as its own parent)** — Pre: target parent_id = own id. Expected: 400 MODULE_CIRCULAR_PARENT.
- **Should reject indirect cycle (moving ancestor under descendant)** — Pre: Cart→Checkout→Billing, move Cart under Billing. Expected: 400 MODULE_CIRCULAR_PARENT.
- **Should reject move when subtree max depth would exceed 6** — Pre: deepest descendant at relative depth 4, target parent at depth 3. Expected: 400 MODULE_MAX_DEPTH.
- **Should reject move with non-existent target parent** — Pre: parent_module_id = nonexistent. Expected: 404 PARENT_MODULE_NOT_FOUND.
- **Should reject move to parent in different project** — Pre: target parent from project B, module from project A. Expected: 400 PARENT_MODULE_WRONG_PROJECT.
- **Should reject move under archived parent** — Pre: target parent has archived_at set. Expected: 400 PARENT_MODULE_ARCHIVED.
- **Should reject move of archived module** — Pre: module has archived_at set. Expected: 400 MODULE_ARCHIVED (NEEDS PO CONFIRM).
- **Should reject move when module does not exist** — Pre: nonexistent module id in URL. Expected: 404 MODULE_NOT_FOUND.
- **Should reject unauthenticated request** — Pre: no auth token. Expected: 401 UNAUTHORIZED.
- **Should reject viewer-role user** — Pre: viewer auth'd. Expected: 403 FORBIDDEN.
- **Should reject position 0** — Pre: position=0. Expected: 400 VALIDATION_ERROR.
- **Should reject empty request body** — Pre: body={}. Expected: 400 "parent_module_id is required".
- **Should reject missing module_id in body (only uses URL param)** — Pre: body has no parent_module_id. Expected: 400 VALIDATION_ERROR.
- **Should reject negative position** — Pre: position=-1. Expected: 400 VALIDATION_ERROR.

#### Boundary
- **Should allow move when deepest descendant lands exactly at depth 6** — Pre: subtree max depth after move = 6. Expected: 200, move succeeds.
- **Should reject move when deepest descendant would land at depth 7** — Pre: subtree max depth after move = 7. Expected: 400 MODULE_MAX_DEPTH.
- **Should handle subtree move to root and verify depths** — Pre: module at depth 3 with descendants, move to root. Expected: new depths 0,1,2,... correctly computed.
- **Should compact sibling positions at old parent** — Pre: remove position 2 of 3. Expected: remaining siblings at 1,2 (compacted).
- **Should set old parent children_count to 0 when last child moved** — Pre: parent has 1 child. Expected: after move, children_count=0.
- **Should handle explicit position beyond sibling count (clamp)** — Pre: 3 siblings, position=99999. Expected: module appended at position 4.

#### Integration
- **Should write activity_log row on successful move** — Pre: valid move. Expected: activity_log row with action="module.moved", old_path + new_path + descendant_count.
- **Should broadcast Realtime update on project channel** — Pre: User B viewing tree, User A moves module. Expected: User B tree refreshes within 3s.
- **Should roll back entire transaction if path rebuild fails mid-cascade** — Pre: simulate DB error on descendant path update. Expected: module stays in original location, no partial writes.
- **Should keep downstream entities (US, AC, ATCs) linked after move** — Pre: module with anchored entities moved. Expected: entity FKs unchanged, entities visible under new path.
- **Should handle concurrent disjoint moves without interference** — Pre: two moves in unrelated subtrees. Expected: both succeed, parent counts correct.

#### Performance
- **Should complete move of module with 100 descendants in <200ms p95** — Pre: 100-descendant chain. Expected: response within latency budget.
- **Should render tree view correctly after move with 20+ children at new parent** — Pre: move to parent with many siblings. Expected: tree view positions correct, no visual gaps.

#### API
- **Should return 200 with full module body on successful move** — Pre: valid move. Expected: `{ success: true, data: { id, name, slug, path, parent_module_id, depth, position, children_count, project_id, updated_at } }`.
- **Should return consistent error envelope for all failure modes** — Pre: invalid input. Expected: `{ success: false, error: { code, message, details? } }`.
- **Should enforce rate limit on move endpoint** — Pre: 101 POST /move in 1 min. Expected: 429 + Retry-After.
- **Should be documented in OpenAPI spec** — Pre: spec reflects POST /modules/{id}/move with request/response schemas. Expected: endpoint discoverable via /api/openapi.json.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Self-reference cycle | No (implied by title) | Critical | Add to AC |
| 2 | Indirect descendant cycle (arbitrary depth) | No | Critical | Add to AC |
| 3 | Subtree depth overflow after move | No | Critical | Add to AC |
| 4 | Move to root level | No (user contract: parent_module_id=null) | Critical | Add to AC |
| 5 | Path rebuild for entire subtree (N descendants) | No (implied by "path rebuild") | Critical | Add to AC |
| 6 | Position rebalance at old parent (gap compaction) | No | High | Add to AC |
| 7 | Position insertion at new parent (shift or reject) | No | High | Add to AC (NEEDS PO CONFIRM) |
| 8 | Concurrent moves on same module (race) | No | High | Test only (optimistic lock strategy) |
| 9 | Concurrent moves on different modules same target parent | No | High | Test only |
| 10 | Move to same parent (no-op) | No | Medium | Add to AC (NEEDS PO CONFIRM) |
| 11 | Move archived module | No | Medium | Add to AC (NEEDS PO CONFIRM) |
| 12 | Move under archived parent | No | Medium | Add to AC |
| 13 | Move module with downstream US/AC/ATCs/Tests | No | Critical | Add to AC |
| 14 | Depth recomputation for all descendants | No | Critical | Add to AC |
| 15 | children_count update on both parents | No | High | Add to AC |
| 16 | Last child leaves parent → children_count=0 | No | Medium | Add to AC (Boundary) |
| 17 | Soft warning at depth 4 (UI only) | No | Medium | Add to AC |
| 18 | Slug stability after move | No | High | Add to AC |
| 19 | Module identity preservation (id, name, created_at) | No | High | Add to AC |
| 20 | Position out of bounds (large number) | No | Low | Ask Dev |
| 21 | Position 0 or negative | No | Medium | Add to AC |
| 22 | Move module not belonging to caller's workspace (RLS) | No | High | Test only (RLS enforcement) |
| 23 | Bearer PAT read-only scope attempting move | No | Medium | Test only (scope enforcement) |
| 24 | Move module, then immediately query tree view (freshness) | No | High | Test only (E2E) |
| 25 | Move triggered during Jira import (async worker) | No | Low | Deferred (unlikely collision) |
| 26 | Activity log payload summary contains old/new path + descendant count | No | Medium | Add to AC |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: **Significant Issues** — HIGH (12) risk Story with zero acceptance criteria for the most algorithmically complex operation in the Module domain. Tree corruption from a move bug is the hardest class of bug to fix in production.

**Key findings**:
- **Zero ACs** — Story is a title + contract sketch. All 39 test outlines and 8 refined ACs were inferred from domain context and the user-provided API contract.
- **Five structural risks** (cycles, path corruption, depth overflow, position desync, children_count drift) each require separate Positive + Boundary + Error coverage — none are addressed.
- **Subtree path rebuild is the highest-risk component** — a partial write leaves the Module tree in a state where half the descendants have old paths and half have new paths. Transaction atomicity is non-negotiable.
- **Concurrent move strategy is unspecified** — two admins reorganizing the same tree can create orphaned positions and corrupt children_counts if not protected by optimistic/pessimistic locking.
- **Move is one of the "silent killers" identified in master-test-plan.md §4.5** — a path corruption bug leaves breadcrumbs broken and subtree queries partial, with no automated reconciliation.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **What are the complete acceptance criteria for BK-11?**
   - **Context**: The Story is a title + contract sketch. All 8 ACs and 39 test outlines in this refinement were inferred. The PO must confirm or correct the AC set.
   - **Impact if unanswered**: Dev has no contract. QA cannot write test scenarios. PO cannot estimate. This is a HIGH (12) risk Story — flying blind on requirements is unacceptable.
   - **Suggested answer**: Adopt the 8 ACs defined in Phase 3: AC1 (Move module), AC2 (Cycle detection), AC3 (Depth limit), AC4 (Position rebalance), AC5 (Authorization), AC6 (Data integrity). 39 test outlines.

2. **Is the move endpoint a dedicated `POST /api/v1/modules/{id}/move` or a PATCH field on `PATCH /api/v1/modules/{id}`?**
   - **Context**: User-provided contract says dedicated `/move`. FEAT-006 groups move alongside rename (PATCH-style). The complexity justifies a dedicated endpoint.
   - **Impact if unanswered**: API contract design affects frontend route builders, Zod schemas, OpenAPI spec.
   - **Suggested answer**: **Dedicated `POST /api/v1/modules/{id}/move`**. PATCH handles rename only. Move has distinct validation (cycle detection, path cascade, dual position+count rebalance) that doesn't fit a field-level PATCH.

3. **Should move to the same parent be a no-op (200) or an error (400)?**
   - **Context**: User clicks "Move to..." and selects the current parent by mistake. UX preference determines behavior.
   - **Impact if unanswered**: Error handling in the frontend differs significantly between 200 (transparent) and 400 (user sees error toast).
   - **Suggested answer**: **200 no-op** — return the module unchanged. Avoids unnecessary error handling and transaction overhead.

4. **Should archived modules be movable?**
   - **Context**: Archived modules are soft-deleted (BK-039). Should they be locked from all mutations including move?
   - **Impact if unanswered**: Edge case test scenario blocked. Could allow moving archived modules under new parents, breaking the cascade-delete logic.
   - **Suggested answer**: **Reject moves on archived modules** (400 MODULE_ARCHIVED). Archived = immutable.

5. **What is the performance budget for subtree path rebuild?**
   - **Context**: Path rebuild cascades through all descendants. A module at depth 2 with 200 descendants requires 200 row updates.
   - **Impact if unanswered**: No latency target means no performance test. Large subtrees could cause timeout.
   - **Suggested answer**: p95 < 200ms for subtrees ≤ 100 descendants. p95 < 500ms for subtrees ≤ 500 descendants. Beyond 500, consider async path rebuild (Phase 2 optimization).

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Transaction isolation level for move?**
   - **Context**: The move touches: cycle detection (read), module row update, N descendant row updates, old parent children_count update, new parent children_count update, position rebalance for old siblings, position rebalance for new siblings, activity_log insert.
   - **Testing impact**: Determines whether concurrent move tests expect serialized execution or last-write-wins.

2. **Optimistic locking strategy for concurrent moves?**
   - **Context**: Two admins reorganizing the same tree. Without locking, children_counts and positions can drift.
   - **Testing impact**: Concurrent test scenarios depend on the locking strategy. If using `updated_at` as a version column, concurrent tests verify the second move gets 409.

3. **How is descendant depth recomputed?**
   - **Context**: After move, every descendant's depth must reflect the new position. Is this done via `depth_delta = new_parent_depth + 1 - module.old_depth` applied to all descendants? Or computed on-the-fly per descendant from path?
   - **Testing impact**: Depth assertions in test data depend on the computation strategy. Delta-based is simpler to verify.

4. **Is the path rebuild a single UPDATE with string replacement or a per-row UPDATE loop?**
   - **Context**: `UPDATE modules SET path = REPLACE(path, '/old-prefix', '/new-prefix') WHERE path LIKE '/old-prefix/%'` vs per-row cursor.
   - **Testing impact**: String REPLACE is fast but dangerous — if a descendant has the old prefix as a substring in its slug, it gets corrupted. Per-row is safe but slower. Verify the chosen strategy with edge-case slugs.

5. **Does the activity_log capture the full subtree move or just the root module?**
   - **Context**: One activity_log row for the move or N+1 rows (one per affected module)?
   - **Testing impact**: Activity log assertions depend on this. One row with `moved_descendants_count` is recommended.

6. **How is children_count maintained — stored integer or computed via COUNT query?**
   - **Context**: BK-9 create increments it. Move must decrement old parent AND increment new parent. If computed, no update needed but tree view performance suffers.
   - **Testing impact**: children_count assertions require knowing whether it's stored or computed.

7. **Realtime broadcast scope — does it publish all affected descendant rows or just the moved module?**
   - **Context**: Tree view needs to know about all moved modules to refresh their position in the tree.
   - **Testing impact**: Integration test for Realtime must verify all affected nodes appear in the broadcast.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | Single-sentence title + contract sketch | Write explicit 8 ACs from Phase 3 covering move, cycle detection, depth limit, position rebalance, auth, data integrity | Dev has contract. QA can test. PO can estimate. |
| 2 | No error catalog | Add error codes: MODULE_CIRCULAR_PARENT, MODULE_MAX_DEPTH, MODULE_ARCHIVED, PARENT_MODULE_NOT_FOUND, PARENT_MODULE_WRONG_PROJECT, PARENT_MODULE_ARCHIVED, MODULE_ALREADY_IN_PARENT, MODULE_NOT_FOUND | Agents can branch on stable error codes. Negative scenarios become testable. |
| 3 | No transaction guarantees specified | Add DoD item: "The entire move operation (cycle check + path cascade + position rebalance + children_count + activity_log) executes in a single DB transaction. Partial writes are impossible." | Prevents silent tree corruption from mid-cascade failures. |
| 4 | No performance criteria | Add performance bar: "p95 latency < 200ms for subtrees ≤ 100 descendants." and "Tree view refresh < 3s after Realtime broadcast." | Measurable quality gate. |
| 5 | No concurrency strategy | Add Technical AC: "Two concurrent moves on the same module must be serialized. Only one succeeds; the other returns 409 CONCURRENT_MODIFICATION." | Prevents race-condition corruption of positions and children_counts. |
| 6 | FK stability not documented | Add AC: "After move, all downstream entities (US, AC, ATC, Test) remain linked via module_id FK." | Reassures PO/Dev that move does not require cascade re-anchoring of child entities. |
| 7 | Slug stability not documented | Add AC: "Module slug does NOT change after move. Only path is recalculated." | Clarifies identity vs location semantics. |

---

## Data feasibility flags

- **`modules` table not yet scaffolded** — schema must exist with `parent_module_id`, `path`, `depth`, `position`, `children_count` columns before this Story can be implemented.
- **No live API endpoints** — Module CRUD (BK-9) must be implemented first. Move depends on the modules table + recursive CTE for cycle detection.
- **Test data setup requires multi-level trees** — test fixtures must create chains of 6+ modules for depth scenarios, 3-level subtrees for path rebuild scenarios, and sibling lists for position rebalance.
- **Recursive CTE available in Postgres** — Supabase Postgres 16 supports `WITH RECURSIVE`. Cycle detection implementation should use this native capability.
- **Path string replacement risk** — if descendants have slugs that contain the parent slug as a substring (e.g., parent slug "cart", descendant slug "cart-item"), REPLACE-based path update could corrupt paths. Per-row update with explicit prefix matching is safer.

---

## Recommended testing strategy

### Pre-implementation
- PO must confirm the 8 ACs defined in Phase 3. This Story cannot enter a sprint without explicit ACs.
- Dev must confirm transaction isolation level and optimistic locking strategy.
- Define `api-contracts.yaml` entry for `POST /modules/{id}/move` with request/response schemas.
- Confirm the recursive CTE pattern for cycle detection and subtree depth computation.
- Seed test fixture: a 6-level-deep tree with at least 3 branches for cycle and depth testing.

### During implementation
- Unit test: cycle detection function in isolation (10+ tree shapes: self, direct child, grandchild, unrelated).
- Unit test: path rebuild function (prefix replacement, edge-case slugs).
- Unit test: depth delta computation for subtrees.
- Integration test: move leaf module → verify path, depth, position, children_count, activity_log.
- Integration test: move subtree → verify all descendant paths and depths.
- Contract test: validate request/response shapes against OpenAPI spec.

### Post-implementation (in-sprint by /sprint-testing)
- Execute all 39 outlines defined in Phase 4 (with parametrization expanded by sprint-testing).
- End-to-end test: Create 6-level tree → move subtree → verify tree view renders correctly → verify downstream entities still reachable.
- Concurrency test: Two parallel moves on same module (verify one succeeds, other gets serialized).
- Cycle detection exhaustive test: 8 tree shapes with self, direct, indirect cycles at various depths.
- Depth limit exhaustive test: 4 subtree shapes moved to parents at depths 0, 1, 2, 3, 4 — verify rejection at correct threshold.
- Realtime test: Two browser tabs, move module in tab A, verify tab B tree updates within 3s.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Cycle detection bug allows module to become its own ancestor | Low | Critical — infinite loop in recursive CTE, tree view crashes, path corruption | AC2 Scenarios 2.1, 2.2 (self-reference + indirect cycle) |
| 2 | Path rebuild corrupts descendant paths (wrong prefix, partial update) | Medium | Critical — subtree split into two disjoint path spaces, breadcrumbs broken | AC1 Scenario 1.2, AC6 Scenarios 6.1, 6.6 |
| 3 | Depth overflow after move not detected | Medium | High — modules exceed depth 6, tree render breaks | AC3 Scenarios 3.1, 3.2, 3.3 |
| 4 | Race condition on concurrent moves corrupts positions or children_counts | Medium | High — tree view shows wrong ordering, expand chevrons broken | AC4 Scenarios 4.1, 4.2, Scenarios E1, E2 |
| 5 | Transaction rollback failure leaves partial writes | Low | Critical — module moved but descendants have old paths | AC6 Scenario 6.6 |
| 6 | Slug collision via path replacement (parent and child share prefix substrings) | Low | Medium — descendant path corrupted | Unit test for path rebuild edge-case slugs |
| 7 | Realtime broadcast misses some descendant nodes after move | Medium | Medium — stale nodes remain in tree view | AC6 Scenario 6.5 |
| 8 | Archived module mistakenly movable | Low | Medium — archived modules reappear in tree | AC5 Scenario 5.4 |

---

## Next steps

- [ ] PO answers 5 Critical Questions before sprint planning
- [ ] Dev answers 7 Technical Questions before estimation
- [ ] Story updated in Jira with refined ACs (Phase 3) + edge cases (Phase 5) + label `shift-left-reviewed`
- [ ] API contract for `POST /modules/{id}/move` added to `api-contracts.yaml`
- [ ] BK-9 (Create Modules) must be implemented and stable before this Story starts — move depends on the modules table and base Module CRUD
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit Phases 1-3 (label `shift-left-reviewed` detected) and add parametrization + test-data + numbered steps to the outlines above
