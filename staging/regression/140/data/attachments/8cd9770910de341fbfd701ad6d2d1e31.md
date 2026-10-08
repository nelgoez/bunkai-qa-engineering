# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/settings/settings-pages.test.ts >> BK-89: Settings > Workspaces >> lists my workspaces with role and a single active marker
- Location: tests/e2e/settings/settings-pages.test.ts:16:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="workspaces-list"]').first().locator('[data-testid="workspaces-rows"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="workspaces-list"]').first().locator('[data-testid="workspaces-rows"]')

```

```yaml
- complementary:
  - text: 分 Bunkai
  - button "Notifications, all read"
  - link "New project":
    - /url: /projects/new
  - button "Q2 QASmoke-20250605"
  - button "Search or jump to… ⌘ K"
  - navigation:
    - link "Home":
      - /url: /home
    - link "Activity":
      - /url: /activity
    - link "Projects 11":
      - /url: /projects
    - text: ATC Library soon Test Runs soon Bug Reports soon Metrics soon
    - link "Settings":
      - /url: /settings
  - text: Pinned projects
  - link "BK11 BK-11 Module Move Test":
    - /url: /projects/bk-11-module-move-test
  - link "PROJ проект":
    - /url: /projects/project-6b955fb3
  - link "PROJ プロジェクト":
    - /url: /projects/project-c91cfa2b
  - link "SCOP Scoping Test Project":
    - /url: /projects/scoping-test-project
  - link "PROJ 测试项目":
    - /url: /projects/project-309d13f6
  - link "REGR Regression Test Alpha":
    - /url: /projects/regression-test-alpha
  - link "CREM Crème Brûlée":
    - /url: /projects/creme-brulee
  - link "DESC Desc Test 5120":
    - /url: /projects/desc-test-5120
  - link "TEST Test 🚀 Project":
    - /url: /projects/test-project
  - link "TEST Test Project BK-8":
    - /url: /projects/test-project-bk-8
  - link "PROB ProbeMember1789099729624":
    - /url: /projects/probemember1789099729624
  - button "QH qa-headless@bunkai.io Owner"
- navigation "Settings sections":
  - link "Back to app":
    - /url: /projects
  - text: Available
  - link "Account":
    - /url: /settings/account
  - link "Tokens":
    - /url: /settings/tokens
  - link "Workspaces":
    - /url: /settings/workspaces
  - link "Notifications":
    - /url: /settings/notifications
  - link "Billing":
    - /url: /settings/billing
  - link "Data export":
    - /url: /settings/data-export
  - text: Coming soon Members soon Environments soon
- heading "Workspaces" [level=1]
- paragraph: Every workspace you belong to, and the one you're working in right now.
- region "Workspaces":
  - heading "Workspaces" [level=2]
  - paragraph: We couldn't load your workspaces. Your identity above loaded fine — only this section failed.
  - button "Retry"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | /**
  2   |  * KATA Architecture - Layer 3: Workspaces Page Component
  3   |  *
  4   |  * UI component for the Settings > Workspaces surface (BK-89: "View the
  5   |  * workspaces I belong to"). Renders every workspace the caller actively
  6   |  * belongs to with its name, slug, role, and the active-workspace marker.
  7   |  *
  8   |  * @atc IDs map to Jira Test issues BK-1030..BK-1037
  9   |  *
  10  |  * Page: /settings/workspaces (Bunkai TMS — staging)
  11  |  *
  12  |  * Locators (data-testid):
  13  |  *   - workspaces-list          (list container + "N workspaces" header)
  14  |  *   - workspaces-rows          (rows container)
  15  |  *   - workspace-row-<slug>     (one row per workspace)
  16  |  *   - workspace-active-<slug>  (active marker span, text "active" when active)
  17  |  *   - workspace-delete-<slug>  (delete button)
  18  |  */
  19  | 
  20  | import type { TestContextOptions } from '@TestContext';
  21  | 
  22  | import { expect } from '@playwright/test';
  23  | import { UiBase } from '@ui/UiBase';
  24  | import { atc, step } from '@utils/decorators';
  25  | 
  26  | // ============================================
  27  | // Workspaces Page Component
  28  | // ============================================
  29  | 
  30  | export class WorkspacesPage extends UiBase {
  31  |   constructor(options: TestContextOptions) {
  32  |     super(options);
  33  |   }
  34  | 
  35  |   // ============================================
  36  |   // Navigation (Public)
  37  |   // ============================================
  38  | 
  39  |   /**
  40  |    * Navigate to the Settings > Workspaces page.
  41  |    * Call this BEFORE using the workspace-list ATCs.
  42  |    */
  43  |   @step
  44  |   async goto(): Promise<void> {
  45  |     await this.page.goto(this.buildUrl('/settings/workspaces'));
  46  |   }
  47  | 
  48  |   // ============================================
  49  |   // Helpers (Private)
  50  |   // ============================================
  51  | 
  52  |   /**
  53  |    * The workspaces list region. Scoped to the first match because the settings
  54  |    * shell can briefly render a duplicate region during hydration; every ATC
  55  |    * asserts within this single region to avoid strict-mode violations.
  56  |    */
  57  |   private workspacesRegion() {
  58  |     return this.page.locator('[data-testid="workspaces-list"]').first();
  59  |   }
  60  | 
  61  |   // ============================================
  62  |   // ATCs - Complete Test Cases
  63  |   // ============================================
  64  | 
  65  |   /**
  66  |    * ATC: list every workspace the caller actively belongs to with its name and
  67  |    * slug. The list container, the rows wrapper, and at least one workspace row
  68  |    * must all render.
  69  |    */
  70  |   @atc('BK-1030')
  71  |   async listWorkspacesWithNameAndSlug(): Promise<void> {
  72  |     const region = this.workspacesRegion();
  73  |     await expect(region).toBeVisible();
> 74  |     await expect(region.locator('[data-testid="workspaces-rows"]')).toBeVisible();
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  75  |     await expect(region.locator('[data-testid^="workspace-row-"]').first()).toBeVisible();
  76  |   }
  77  | 
  78  |   /**
  79  |    * ATC: render the capitalised role label per membership (e.g. "Owner").
  80  |    */
  81  |   @atc('BK-1031')
  82  |   async renderCapitalisedRoleLabel(): Promise<void> {
  83  |     await expect(this.workspacesRegion()).toContainText('Owner');
  84  |   }
  85  | 
  86  |   /**
  87  |    * ATC: mark exactly one workspace as active. The active marker span renders
  88  |    * the text "active"; non-active rows leave it empty.
  89  |    */
  90  |   @atc('BK-1032')
  91  |   async markExactlyOneActiveWorkspace(): Promise<void> {
  92  |     const activeMarkers = this.workspacesRegion()
  93  |       .locator('[data-testid^="workspace-active-"]')
  94  |       .filter({ hasText: 'active' });
  95  |     await expect(activeMarkers).toHaveCount(1);
  96  |   }
  97  | 
  98  |   /**
  99  |    * ATC: render no leave, add or switch control in the Workspaces section —
  100 |    * the surface is read-only (workspace management lives in other flows).
  101 |    */
  102 |   @atc('BK-1037')
  103 |   async showNoLeaveAddOrSwitchControl(): Promise<void> {
  104 |     const list = this.workspacesRegion();
  105 |     await expect(list.getByRole('button', { name: /leave/i })).toHaveCount(0);
  106 |     await expect(list.getByRole('button', { name: /add workspace/i })).toHaveCount(0);
  107 |     await expect(list.getByRole('button', { name: /switch/i })).toHaveCount(0);
  108 |   }
  109 | }
  110 | 
```