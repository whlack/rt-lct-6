import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { DatabaseService } from '../../src/database/database.service.js';

if (process.env.ACCEPTANCE_ISOLATED !== '1')
  throw new Error('Fault fixtures require an isolated acceptance stack');
const db = new DatabaseService();
const mode = process.argv[2],
  scenario = process.argv[3];
const path = '/artifacts/faults.json';
type Result = { id: string; attempts?: number; status?: string };
let results: Record<string, Result> = {};
try {
  results = JSON.parse(await readFile(path, 'utf8')) as Record<string, Result>;
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
async function token() {
  const response = await fetch(
    'http://keycloak:8080/realms/crm/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        username: 'acceptance-0',
        password: 'acceptance-password-1',
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  assert.equal(response.status, 200);
  const value = (await response.json()) as { access_token: string };
  return {
    authorization: 'Bearer ' + value.access_token,
    'content-type': 'application/json',
  };
}
try {
  if (mode === 'enqueue') {
    const university = await db.prisma.university.findFirstOrThrow({
      select: { id: true },
    });
    const response = await fetch('http://backend:3000/api/reports/exports', {
      method: 'POST',
      headers: await token(),
      body: JSON.stringify({ format: 'xlsx', universityId: university.id }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 202);
    const value = (await response.json()) as { id: string };
    results[scenario] = { id: value.id };
  } else {
    assert.ok(results[scenario]);
    const deadline = Date.now() + 180000;
    for (;;) {
      const job = await db.prisma.exportJob.findUniqueOrThrow({
        where: { id: results[scenario].id },
      });
      if (mode === 'running' && job.status === 'RUNNING') break;
      if (mode === 'retry' && job.attempts > 0 && job.status === 'QUEUED')
        break;
      if (mode === 'wait' && job.status === 'SUCCEEDED') {
        if (scenario !== 'redis') assert.ok(job.attempts >= 2);
        const response = await fetch(
          'http://backend:3000/api/jobs/' + job.id + '/file',
          { headers: await token() },
        );
        assert.equal(response.status, 200);
        assert.ok((await response.arrayBuffer()).byteLength > 0);
        results[scenario] = {
          id: job.id,
          attempts: job.attempts,
          status: job.status,
        };
        break;
      }
      assert.notEqual(job.status, 'FAILED', job.errorCode ?? 'JOB_FAILED');
      assert.ok(Date.now() < deadline, mode + '_TIMEOUT');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ scenario, result: mode.toUpperCase() }));
} finally {
  await db.onModuleDestroy();
}
