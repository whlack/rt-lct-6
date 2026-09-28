import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import * as XLSX from 'xlsx';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../src/database/database.service.js';
import { redisConnection } from '../../src/config/jobs.js';
import { S3Adapter } from '../../src/integrations/storage/s3.adapter.js';

if (process.env.ACCEPTANCE_ISOLATED !== '1')
  throw new Error('Only an isolated acceptance container can run this fixture');
const api = 'http://backend:3000/api',
  kc = 'http://keycloak:8080';
const artifacts = '/artifacts';
await mkdir(artifacts, { recursive: true });
async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new Error('HTTP_' + response.status + '_' + new URL(url).pathname);
  return response.json() as Promise<Record<string, unknown>>;
}
const admin = await json(kc + '/realms/master/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN!,
    password: process.env.KEYCLOAK_ADMIN_PASSWORD!,
  }),
});
const adminHeaders = {
  authorization: 'Bearer ' + String(admin.access_token),
  'content-type': 'application/json',
};
async function adminRequest(path: string, method: string, body?: unknown) {
  let response = await fetch(kc + '/admin/realms/crm/' + path, {
    method,
    headers: adminHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    const renewed = await json(
      kc + '/realms/master/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: process.env.KEYCLOAK_ADMIN!,
          password: process.env.KEYCLOAK_ADMIN_PASSWORD!,
        }),
      },
    );
    adminHeaders.authorization = 'Bearer ' + String(renewed.access_token);
    response = await fetch(kc + '/admin/realms/crm/' + path, {
      method,
      headers: adminHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  if (!response.ok) throw new Error('KEYCLOAK_' + response.status);
  return response;
}
// Password grant exists solely in this private, throwaway realm.
await adminRequest('clients', 'POST', {
  clientId: 'acceptance',
  enabled: true,
  publicClient: true,
  directAccessGrantsEnabled: true,
  standardFlowEnabled: false,
});
const clients = (await (
  await adminRequest('clients?clientId=acceptance', 'GET')
).json()) as { id: string }[];
// Use the configured audience expected by the API, also only in this realm.
const webClients = (await (
  await adminRequest(
    'clients?clientId=' + process.env.KEYCLOAK_CLIENT_ID,
    'GET',
  )
).json()) as { id: string }[];
const client = (await (
  await adminRequest('clients/' + webClients[0].id, 'GET')
).json()) as Record<string, unknown>;
await adminRequest('clients/' + webClients[0].id, 'PUT', {
  ...client,
  directAccessGrantsEnabled: true,
  attributes: {},
});
assert.equal(clients.length, 1);
await adminRequest('', 'PUT', { accessTokenLifespan: 3600 });
const supervisorRole = (await (
  await adminRequest('roles/supervisor', 'GET')
).json()) as Record<string, unknown>;
const kamRole = (await (
  await adminRequest('roles/kam', 'GET')
).json()) as Record<string, unknown>;
const administratorRole = (await (
  await adminRequest('roles/admin', 'GET')
).json()) as Record<string, unknown>;
const identities: {
  subject: string;
  token: string;
  id: string;
  role: string;
}[] = [];
for (let i = 0; i < 50; i++) {
  const username = 'acceptance-' + i;
  await adminRequest('users', 'POST', {
    username,
    enabled: true,
    emailVerified: true,
    email: username + '@example.test',
    firstName: 'Тест',
    lastName: String(i),
    credentials: [
      { type: 'password', value: 'acceptance-password-1', temporary: false },
    ],
  });
  const users = (await (
    await adminRequest('users?username=' + username + '&exact=true', 'GET')
  ).json()) as { id: string }[];
  const subject = users[0].id,
    role = i === 0 ? 'admin' : i < 25 ? 'supervisor' : 'kam';
  await adminRequest('users/' + subject + '/role-mappings/realm', 'POST', [
    role === 'admin'
      ? administratorRole
      : role === 'kam'
        ? kamRole
        : supervisorRole,
  ]);
  const token = await json(kc + '/realms/crm/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.KEYCLOAK_CLIENT_ID!,
      username,
      password: 'acceptance-password-1',
    }),
  });
  const me = await json(api + '/me', {
    headers: { authorization: 'Bearer ' + String(token.access_token) },
  });
  identities.push({
    subject,
    token: String(token.access_token),
    id: String(me.id),
    role,
  });
}
const db = new DatabaseService();
const author = identities[0],
  headers = {
    authorization: 'Bearer ' + author.token,
    'content-type': 'application/json',
  };
try {
  const direction = await db.prisma.direction.create({
    data: { name: 'Связь и телекоммуникации' },
  });
  const program = await db.prisma.program.create({
    data: {
      name: 'Программа подготовки специалистов с длинным названием для проверки кириллицы',
    },
  });
  await db.prisma
    .$executeRaw`INSERT INTO universities(id,name,created_by_id,created_at,updated_at)
    SELECT md5('university-'||i)::uuid, 'Университет '||i, ${author.id}::uuid, now(), now() FROM generate_series(1,1000) i`;
  for (const [i, person] of identities.entries()) {
    await db.prisma
      .$executeRaw`INSERT INTO university_assignments(university_id,user_id)
      SELECT id,${person.id}::uuid FROM universities WHERE mod(abs(hashtext(name)),50)=${i}`;
  }
  await db.prisma
    .$executeRaw`INSERT INTO projects(id,university_id,direction_id,program_id,responsible_id,created_by_id,current_stage_index,created_at,updated_at,closed_at)
    SELECT md5('project-'||i)::uuid,md5('university-'||((i-1)%1000+1))::uuid,${direction.id}::uuid,${program.id}::uuid,
    ${author.id}::uuid,${author.id}::uuid,0,timestamp '2026-01-01'+(i%240)*interval '1 day',now(),
    CASE WHEN i%3=0 THEN timestamp '2026-09-01' ELSE NULL END FROM generate_series(1,10000) i`;
  // Spread responsibilities in addition to the university assignment scope.
  for (const [i, person] of identities.entries())
    await db.prisma
      .$executeRaw`UPDATE projects SET responsible_id=${person.id}::uuid WHERE mod(abs(hashtext(id::text)),50)=${i}`;
  await db.prisma
    .$executeRaw`INSERT INTO project_stages(id,project_id,position,title,expected_actor)
    SELECT md5('stage-'||id)::uuid,id,0,'Согласование документов',CASE WHEN abs(hashtext(id::text))%2=0 THEN 'KAM'::"ExpectedActor" ELSE 'UNIVERSITY'::"ExpectedActor" END FROM projects`;
  await db.prisma
    .$executeRaw`INSERT INTO project_events(id,project_id,actor_id,type,object_type,object_id,created_at)
    SELECT md5('event-'||i)::uuid,md5('project-'||((i-1)%10000+1))::uuid,${author.id}::uuid,'PROJECT_UPDATED','PROJECT',md5('project-'||((i-1)%10000+1))::uuid,
    timestamp '2026-01-01'+(i%270)*interval '1 day' FROM generate_series(1,200000) i`;
  await db.prisma.$executeRawUnsafe('ANALYZE');
  const plans = await db.prisma
    .$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT p.id FROM projects p WHERE EXISTS (SELECT 1 FROM project_events e WHERE e.project_id=p.id AND e.created_at >= timestamp '2026-03-01' AND e.created_at < timestamp '2026-04-01') ORDER BY p.created_at DESC,p.id LIMIT 25`;
  await writeFile(artifacts + '/explain.json', JSON.stringify(plans, null, 2));
  const report = await json(api + '/reports/projects?pageSize=100', {
    headers,
  });
  assert.equal(report.total, 10000);
  const statistics = await json(
    api + '/statistics?dateFrom=2026-01-01&dateTo=2026-09-30',
    { headers },
  );
  await writeFile(
    artifacts + '/statistics.json',
    JSON.stringify(statistics, null, 2),
  );
  const durations: number[] = [],
    failures: string[] = [];
  const firstProject = await db.prisma.project.findFirstOrThrow({
    select: { id: true },
  });
  const paths = [
    '/dashboard',
    '/reports/projects?page=2&pageSize=25',
    '/reports/projects?dateFrom=2026-03-01&dateTo=2026-03-31',
    '/projects/' + firstProject.id,
  ];
  async function load() {
    await Promise.all(
      identities.map(async (person) => {
        for (let i = 0; i < 20; i++) {
          const path =
            person.role === 'kam' ? '/dashboard' : paths[i % paths.length];
          const started = performance.now();
          const response = await fetch(api + path, {
            headers: { authorization: 'Bearer ' + person.token },
          });
          await response.arrayBuffer();
          durations.push(performance.now() - started);
          if (!response.ok) failures.push(String(response.status));
        }
      }),
    );
  }
  async function wait(id: string, wanted = 'SUCCEEDED') {
    const until = Date.now() + 600000;
    for (;;) {
      const started = performance.now();
      const state = await json(api + '/jobs/' + id, { headers });
      durations.push(performance.now() - started);
      if (state.status === wanted) return state;
      if (state.status === 'FAILED' || Date.now() > until)
        throw new Error('JOB_' + String(state.errorCode ?? 'TIMEOUT'));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const firstUniversity = await db.prisma.university.findFirstOrThrow({
    select: { id: true },
  });
  const exports = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      json(api + '/reports/exports', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          format: i % 3 === 0 ? 'xls' : i % 3 === 1 ? 'xlsx' : 'pdf',
          universityId: i === 1 ? undefined : firstUniversity.id,
        }),
      }),
    ),
  );
  const exportStates = await Promise.all([
    load(),
    ...exports.map(async (job, index) => {
      const state = await wait(String(job.id));
      const response = await fetch(api + '/jobs/' + String(job.id) + '/file', {
        headers,
      });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length > 0);
      const format = index % 3 === 0 ? 'xls' : index % 3 === 1 ? 'xlsx' : 'pdf';
      if (format === 'xls')
        assert.equal(bytes.subarray(0, 8).toString('hex'), 'd0cf11e0a1b11ae1');
      if (format !== 'pdf') {
        const workbook = XLSX.read(bytes, { type: 'buffer' });
        const lastRow = XLSX.utils.decode_range(
          workbook.Sheets[workbook.SheetNames[0]]['!ref']!,
        ).e.r;
        assert.equal(lastRow, index === 1 ? 10000 : 10);
      }
      await writeFile(artifacts + '/report-' + index + '.' + format, bytes);
      return state;
    }),
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Название направления'],
      ...Array.from({ length: 20000 }, (_, i) => [
        'Импортируемое направление ' + i,
      ]),
    ]),
    'Направления',
  );
  const workbook = Buffer.from(
    XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }),
  );
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(workbook)]), 'catalogs.xlsx');
  const upload = await json(api + '/catalog-imports', {
    method: 'POST',
    headers: { authorization: headers.authorization },
    body: form,
  });
  const previewStarted = performance.now();
  await Promise.all([load(), wait(String(upload.id), 'PREVIEW')]);
  const previewMs = performance.now() - previewStarted;
  await json(api + '/catalog-imports/' + String(upload.id) + '/apply', {
    method: 'POST',
    headers,
  });
  const applyStarted = performance.now();
  await Promise.all([load(), wait(String(upload.id))]);
  const applyMs = performance.now() - applyStarted;
  const applied = await json(api + '/catalog-imports/' + String(upload.id), {
    headers,
  });
  assert.equal((applied.counts as Record<string, number>).CREATED, 20000);
  await json(api + '/catalog-imports/' + String(upload.id) + '/apply', {
    method: 'POST',
    headers,
  });
  assert.equal(
    await db.prisma.direction.count({
      where: { name: { startsWith: 'Импортируемое направление' } },
    }),
    20000,
  );
  for (const format of ['png', 'pdf']) {
    const task = await json(api + '/statistics/exports', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        format,
        dateFrom: '2026-01-01',
        dateTo: '2026-09-30',
      }),
    });
    await wait(String(task.id));
    const response = await fetch(api + '/jobs/' + String(task.id) + '/file', {
      headers,
    });
    assert.equal(response.status, 200);
    await writeFile(
      artifacts + '/statistics.' + format,
      Buffer.from(await response.arrayBuffer()),
    );
  }
  const storage = new S3Adapter();
  const sample = Buffer.from('isolated S3 backup check');
  await storage.put(
    'acceptance/backup-sample',
    sample,
    'application/octet-stream',
  );
  await writeFile(
    artifacts + '/s3-sample.bin',
    Buffer.from(await storage.get('acceptance/backup-sample')),
  );
  await storage.put(
    'acceptance/restore-sample',
    sample,
    'application/octet-stream',
  );
  assert.deepEqual(
    Buffer.from(await storage.get('acceptance/restore-sample')),
    sample,
  );
  const sorted = [...durations].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const result = {
    platform: process.platform,
    cpuLimit:
      'Application containers share CPUs 0-3, worker capped at 2; generator on CPUs 4-5; application memory limits total below 8 GiB',
    dataset: { universities: 1000, projects: 10000, events: 200000 },
    concurrency: 50,
    exportProjectRows: [10, 10000, 10, 10, 10, 10, 10, 10, 10, 10],
    requests: durations.length,
    p95Ms: p95,
    failures,
    previewMs,
    applyMs,
    exports: exportStates.slice(1),
    interactivePassed: p95 <= 1000 && failures.length === 0,
  };
  await writeFile(artifacts + '/load.json', JSON.stringify(result, null, 2));
  const queue = new Queue('crm-exports', { connection: redisConnection() });
  try {
    await queue.pause();
    const denied = await json(api + '/reports/exports', {
      method: 'POST',
      headers,
      body: JSON.stringify({ format: 'xlsx' }),
    });
    await adminRequest('users/' + author.subject, 'PUT', { enabled: false });
    await queue.resume();
    const until = Date.now() + 60000;
    while (Date.now() < until) {
      const job = await db.prisma.exportJob.findUniqueOrThrow({
        where: { id: String(denied.id) },
      });
      if (job.status === 'FAILED') {
        assert.equal(job.errorCode, 'ACCESS_UNAVAILABLE');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(
      (
        await db.prisma.exportJob.findUniqueOrThrow({
          where: { id: String(denied.id) },
        })
      ).status,
      'FAILED',
    );
    const revoked = await fetch(
      api + '/jobs/' + String(exports[0].id) + '/file',
      { headers },
    );
    assert.equal(revoked.status, 403);
    await adminRequest('users/' + author.subject, 'PUT', { enabled: true });
  } finally {
    await queue.close();
  }
  const openapi = await json('http://backend:3000/api/docs-json');
  await writeFile(
    artifacts + '/openapi.json',
    JSON.stringify(openapi, null, 2),
  );
  assert.equal(failures.length, 0);
  assert.ok(p95 <= 1000, 'Interactive p95 exceeds 1 second');
  console.log(
    JSON.stringify({
      result: 'PASSED',
      requests: durations.length,
      p95Ms: p95,
      previewMs,
      applyMs,
    }),
  );
} finally {
  await db.onModuleDestroy();
}
