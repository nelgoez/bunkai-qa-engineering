/**
 * Jira Evidence Attacher
 *
 * Uploads a file as an attachment to a Jira issue.
 * Uses ATLASSIAN_URL / ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN from env.
 *
 * Usage:
 *   bun scripts/jira-attach-evidence.ts BK-123 ./screenshot.png
 *   bun scripts/jira-attach-evidence.ts BK-123 ./trace.zip --comment "Failure trace"
 */

import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const [issueKey, filePath, ...rest] = process.argv.slice(2);
const commentFlag = rest.indexOf('--comment');
const comment = commentFlag !== -1 ? rest.slice(commentFlag + 1).join(' ') : '';

if (!issueKey || !filePath) {
  console.error('Usage: bun scripts/jira-attach-evidence.ts <ISSUE-KEY> <file-path> [--comment "text"]');
  process.exit(1);
}

const url = process.env.ATLASSIAN_URL?.replace(/\/+$/, '');
const email = process.env.ATLASSIAN_EMAIL;
const token = process.env.ATLASSIAN_API_TOKEN;

if (!url || !email || !token) {
  console.error('Missing ATLASSIAN_URL / ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN in env');
  process.exit(1);
}

const absPath = resolve(filePath);
if (!existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

const fileName = basename(absPath);

// Upload via REST API
const proc = Bun.spawnSync([
  'curl',
  '-sS',
  '-w',
  '\nHTTP_STATUS:%{http_code}',
  '-u',
  `${email}:${token}`,
  '-X',
  'POST',
  '-H',
  'X-Atlassian-Token: no-check',
  '-F',
  `file=@${absPath}`,
  `${url}/rest/api/3/issue/${issueKey}/attachments`,
]);

const output = proc.stdout.toString();
const statusMatch = output.match(/HTTP_STATUS:(\d+)/);
const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0;
const body = output.replace(/HTTP_STATUS:\d+\n?/, '').trim();

if (status === 200) {
  console.log(`✅ Attached ${fileName} to ${issueKey}`);
}
else {
  console.error(`❌ Failed (HTTP ${status}): ${body}`);
  process.exit(1);
}

// Add comment if --comment was provided
if (comment) {
  const commentPayload = JSON.stringify({
    body: {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: comment }],
      }],
    },
  });

  const commentProc = Bun.spawnSync([
    'curl',
    '-sS',
    '-w',
    '\nHTTP_STATUS:%{http_code}',
    '-u',
    `${email}:${token}`,
    '-X',
    'POST',
    '-H',
    'Content-Type: application/json',
    '-d',
    commentPayload,
    `${url}/rest/api/3/issue/${issueKey}/comment`,
  ]);

  const cStatus = commentProc.stdout.toString().match(/HTTP_STATUS:(\d+)/);
  if (cStatus && Number.parseInt(cStatus[1], 10) === 201) {
    console.log(`✅ Comment added to ${issueKey}`);
  }
}
