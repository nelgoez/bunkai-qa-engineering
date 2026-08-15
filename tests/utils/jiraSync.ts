/**
 * KATA Architecture - TMS Synchronization
 *
 * Syncs ATC results to Test Management Systems.
 * Supports: X-Ray Cloud, Jira Direct
 *
 * Usage:
 *   bun run test:sync
 *   AUTO_SYNC=true bun test
 */

import type { AtcResult } from '@utils/decorators';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ATC_PARTIAL_PATH } from '@utils/decorators';
import { config, env } from '@variables';

// ============================================
// Types
// ============================================

interface XrayTestExecution {
  testKey: string
  status: 'PASSED' | 'FAILED' | 'TODO'
  comment: string
}

interface SyncResult {
  provider: string
  success: boolean
  message: string
  details?: unknown
}

// ============================================
// Main Sync Function
// ============================================

/**
 * Read ATC execution results from disk.
 *
 * Order matters: the global teardown runs BEFORE KataReporter.onEnd(), so the
 * aggregated `reports/atc_results.json` does not exist yet at sync time — only
 * the NDJSON partial stream does. Read the NDJSON first (available in both
 * teardown and standalone runs before onEnd), and fall back to the aggregated
 * report for `bun run test:sync` invoked after a completed run.
 */
function readAtcResults(reportPath: string): Record<string, AtcResult[]> {
  if (existsSync(ATC_PARTIAL_PATH)) {
    const results: Record<string, AtcResult[]> = {};
    const lines = readFileSync(ATC_PARTIAL_PATH, 'utf-8').split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as AtcResult;
        (results[entry.testId] ??= []).push(entry);
      }
      catch {
        // Skip malformed NDJSON lines (partial write from a killed worker).
      }
    }

    if (Object.keys(results).length > 0) {
      return results;
    }
  }

  // Playwright workers run under Node (not Bun), so Bun.file() is unavailable here.
  if (existsSync(reportPath)) {
    const reportData = JSON.parse(
      readFileSync(reportPath, 'utf-8'),
    ) as { results?: Record<string, AtcResult[]> };
    return reportData.results ?? {};
  }

  return {};
}

export async function syncResults(reportPath = 'reports/atc_results.json'): Promise<SyncResult> {
  if (!config.tms.autoSync) {
    console.log('[SKIP] TMS sync disabled. Set AUTO_SYNC=true to enable.');
    return { provider: 'none', success: true, message: 'Sync disabled' };
  }

  const results = readAtcResults(reportPath);

  if (Object.keys(results).length === 0) {
    console.log('[WARN] No ATC results to sync');
    return { provider: config.tms.provider, success: true, message: 'No results to sync' };
  }

  console.log(
    `\n[SYNC] Syncing ${Object.keys(results).length} test results to ${config.tms.provider}...`,
  );

  switch (config.tms.provider) {
    case 'xray':
      return syncToXray(results);
    case 'jira':
      return syncToJiraDirect(results);
    case 'none':
      console.log('[SKIP] No TMS provider configured');
      return { provider: 'none', success: true, message: 'No provider configured' };
  }
}

// ============================================
// X-Ray Cloud Sync
// ============================================

async function syncToXray(results: Record<string, AtcResult[]>): Promise<SyncResult> {
  const { clientId, clientSecret, projectKey } = config.tms.xray;

  if (!clientId || !clientSecret) {
    console.error(
      '[ERROR] Missing X-Ray credentials. Check XRAY_CLIENT_ID and XRAY_CLIENT_SECRET.',
    );
    return { provider: 'xray', success: false, message: 'Missing credentials' };
  }

  try {
    console.log('[AUTH] Authenticating with X-Ray Cloud...');

    const authResponse = await fetch('https://xray.cloud.getxray.app/api/v2/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.text();
      console.error('[ERROR] X-Ray authentication failed:', error);
      return { provider: 'xray', success: false, message: 'Authentication failed' };
    }

    const token = await authResponse.json();

    const tests: XrayTestExecution[] = [];

    for (const [testId, executions] of Object.entries(results)) {
      const finalStatus = executions.every(e => e.status === 'PASS') ? 'PASSED' : 'FAILED';
      const lastExecution = executions[executions.length - 1];

      tests.push({
        testKey: testId,
        status: finalStatus,
        comment:
          `KATA ATC: ${lastExecution.methodName}\n`
          + `Executions: ${executions.length}\n`
          + `Duration: ${lastExecution.duration}ms\n`
          + `Last run: ${lastExecution.executedAt}\n${
            lastExecution.error !== null ? `\nError:\n${lastExecution.error}` : ''
          }`,
      });
    }

    const payload = {
      info: {
        project: projectKey,
        summary: `KATA Execution - ${env.buildId}`,
        description: `Automated test execution via KATA Architecture\nEnvironment: ${env.current}`,
      },
      tests,
    };

    console.log('[UPLOAD] Importing results to X-Ray...');

    const importResponse = await fetch('https://xray.cloud.getxray.app/api/v2/import/execution', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!importResponse.ok) {
      const error = await importResponse.text();
      console.error('[ERROR] X-Ray import failed:', error);
      return { provider: 'xray', success: false, message: 'Import failed' };
    }

    const result = await importResponse.json();
    console.log('[SUCCESS] Results synced to X-Ray Cloud');
    console.log(`   Test Execution: ${result.key}`);

    return {
      provider: 'xray',
      success: true,
      message: `Synced to Test Execution: ${result.key}`,
      details: result,
    };
  }
  catch (error) {
    console.error('[ERROR] X-Ray sync error:', error);
    return {
      provider: 'xray',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Jira Direct Sync
// ============================================

interface JiraFieldDefinition {
  id: string
  type: string
  name: string
  options?: Record<string, string>
}

interface JiraFieldsFile {
  [slug: string]: JiraFieldDefinition
}

/**
 * Load the custom-field catalog from .agents/jira-fields.json (regenerated via
 * `bun run jira:sync-fields`). Single-select fields resolve their option ID
 * here — their REST payload requires `{ id: <optionId> }`, not a value string.
 * Returns {} when the file is absent so callers degrade to the comment fallback.
 */
function loadJiraFields(): JiraFieldsFile {
  try {
    const fieldsPath = resolve(process.cwd(), '.agents', 'jira-fields.json');
    if (!existsSync(fieldsPath)) {
      return {};
    }
    return JSON.parse(readFileSync(fieldsPath, 'utf-8')) as JiraFieldsFile;
  }
  catch {
    return {};
  }
}

/** Map the active test environment to a Test Environment📦️ option slug. */
function resolveEnvironmentSlug(environment: string): string | null {
  switch (environment) {
    case 'staging':
      return 'staging';
    case 'production':
      return 'production';
    case 'local':
      return 'dev';
    default:
      return null;
  }
}

/**
 * Fetch the set of Test issue keys assigned to the authenticated user.
 *
 * The sync must only reflect results onto Test tickets we own. Running the full
 * integration suite also executes ATCs that belong to other people's stories
 * (e.g. BK-149→160 under Ely's BK-18, BK-234→247 under the aborted BK-43), and
 * writing onto those tickets is an ownership violation. Filtering by
 * `assignee = currentUser()` keeps the sync self-maintaining without a
 * hardcoded allowlist.
 *
 * Returns null when the query fails so the caller can fail-safe.
 */
async function fetchOwnedTestKeys(
  url: string,
  headers: Record<string, string>,
): Promise<Set<string> | null> {
  try {
    // POST /search/jql — the GET /search?jql endpoint was removed (CHANGE-2046).
    const response = await fetch(`${url}/rest/api/3/search/jql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jql: 'assignee = currentUser() AND issuetype = Test',
        fields: ['key'],
        maxResults: 100,
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json() as { issues?: Array<{ key: string }> };
    return new Set((data.issues ?? []).map(issue => issue.key));
  }
  catch {
    return null;
  }
}

async function syncToJiraDirect(results: Record<string, AtcResult[]>): Promise<SyncResult> {
  const { url, user, apiToken } = config.tms.jira;

  if (!url || !user || !apiToken) {
    console.error('[ERROR] Missing Atlassian credentials. Check ATLASSIAN_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN.');
    return { provider: 'jira', success: false, message: 'Missing credentials' };
  }

  const fields = loadJiraFields();
  const testStatusField = fields.test_status;
  const toBeAutomatedField = fields.to_be_automated;
  const qaFrameworkField = fields.qa_framework;
  const testEnvironmentField = fields.test_environment;
  const vcrEstimationField = fields.vcr_estimation;

  const auth = btoa(`${user}:${apiToken}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const ownedTestKeys = await fetchOwnedTestKeys(url, headers);
  if (ownedTestKeys === null) {
    console.warn('[WARN] Could not resolve owned Test issues — aborting sync to avoid touching others\' tickets.');
    return { provider: 'jira', success: false, message: 'Could not resolve owned Test issues' };
  }

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const [testId, executions] of Object.entries(results)) {
    if (!ownedTestKeys.has(testId)) {
      console.log(`[SKIP] ${testId} not assigned to current user — skipping`);
      skippedCount++;
      continue;
    }

    const finalStatus = executions.every(e => e.status === 'PASS') ? 'PASS' : 'FAIL';
    const lastExecution = executions[executions.length - 1];

    // Build the custom-field payload. Single-select fields take { id: optionId }.
    const fieldsToSet: Record<string, unknown> = {};

    const statusOptionId = testStatusField?.options?.[finalStatus === 'PASS' ? 'passed' : 'failed'];
    if (testStatusField && statusOptionId) {
      fieldsToSet[testStatusField.id] = { id: statusOptionId };
    }

    const toBeAutomatedYes = toBeAutomatedField?.options?.yes;
    if (toBeAutomatedField && toBeAutomatedYes) {
      fieldsToSet[toBeAutomatedField.id] = { id: toBeAutomatedYes };
    }

    const playwrightFrameworkId = qaFrameworkField?.options?.playwright_javascript;
    if (qaFrameworkField && playwrightFrameworkId) {
      fieldsToSet[qaFrameworkField.id] = { id: playwrightFrameworkId };
    }

    const environmentSlug = resolveEnvironmentSlug(env.current);
    const environmentOptionId = environmentSlug ? testEnvironmentField?.options?.[environmentSlug] : undefined;
    if (testEnvironmentField && environmentOptionId) {
      fieldsToSet[testEnvironmentField.id] = { id: environmentOptionId };
    }

    // VCR is written in a SEPARATE best-effort PUT: the field may not be on the
    // Test edit screen yet, and a failed write must not break the main sync.
    const vcr = lastExecution.vcr;
    const vcrFieldsToSet: Record<string, unknown> = {};
    if (vcrEstimationField && vcr) {
      vcrFieldsToSet[vcrEstimationField.id] = `V${vcr.value} · C${vcr.cost} · R${vcr.risk}`;
    }

    try {
      let fieldWriteSucceeded = false;

      if (Object.keys(fieldsToSet).length > 0) {
        console.log(`[UPDATE] Updating ${testId}...`);

        const updateResponse = await fetch(`${url}/rest/api/3/issue/${testId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ fields: fieldsToSet }),
        });

        fieldWriteSucceeded = updateResponse.ok || updateResponse.status === 204;
        if (!fieldWriteSucceeded) {
          console.warn(`[WARN] Field update failed for ${testId}: ${updateResponse.status}`);
        }
      }

      if (Object.keys(vcrFieldsToSet).length > 0) {
        try {
          const vcrResponse = await fetch(`${url}/rest/api/3/issue/${testId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ fields: vcrFieldsToSet }),
          });
          if (!vcrResponse.ok && vcrResponse.status !== 204) {
            console.warn(`[WARN] VCR field skipped for ${testId}: ${vcrResponse.status} (field not on Test screen?)`);
          }
        }
        catch (error) {
          console.warn(`[WARN] VCR field write failed for ${testId}:`, error);
        }
      }

      if (fieldWriteSucceeded) {
        console.log(`[SUCCESS] Updated ${testId} -> ${finalStatus} (custom fields)`);
        successCount++;
      }
      else {
        // Fallback: the Test Status field could not be written — post a comment.
        const commentBody = {
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `KATA Execution - ${finalStatus}`,
                    marks: [{ type: 'strong' }],
                  },
                ],
              },
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: `ATC: ${lastExecution.methodName}\n` },
                  { type: 'text', text: `Executions: ${executions.length}\n` },
                  { type: 'text', text: `Duration: ${lastExecution.duration}ms\n` },
                  { type: 'text', text: `Environment: ${env.current}\n` },
                  { type: 'text', text: `Build: ${env.buildId}\n` },
                  { type: 'text', text: `Timestamp: ${lastExecution.executedAt}` },
                ],
              },
              ...(lastExecution.error !== null
                ? [
                    {
                      type: 'codeBlock',
                      attrs: { language: 'text' },
                      content: [{ type: 'text', text: `Error:\n${lastExecution.error}` }],
                    },
                  ]
                : []),
            ],
          },
        };

        const commentResponse = await fetch(`${url}/rest/api/3/issue/${testId}/comment`, {
          method: 'POST',
          headers,
          body: JSON.stringify(commentBody),
        });

        if (commentResponse.ok || commentResponse.status === 201) {
          console.log(`[SUCCESS] Commented ${testId} -> ${finalStatus} (field fallback)`);
          successCount++;
        }
        else {
          console.warn(`[WARN] Failed to update or comment on ${testId}`);
          failCount++;
        }
      }
    }
    catch (error) {
      console.error(`[ERROR] Failed to update ${testId}:`, error);
      failCount++;
    }
  }

  console.log(`\n[SUMMARY] Sync: ${successCount} success, ${failCount} failed, ${skippedCount} skipped (not owned)`);

  return {
    provider: 'jira',
    success: failCount === 0,
    message: `Updated ${successCount}/${successCount + failCount} issues (${skippedCount} skipped)`,
  };
}

// ============================================
// CLI Entry Point
// ============================================

if (process.argv[1]?.includes('jiraSync')) {
  syncResults()
    .then((result) => {
      console.log('\n[RESULT]', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default syncResults;
