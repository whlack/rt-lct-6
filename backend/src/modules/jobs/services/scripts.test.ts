import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readdir,
  copyFile,
  writeFile,
  readFile,
  rm,
  chmod,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('user scripts validate flags and deployment stops before startup when migration fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crm-script-contract-'));
  const scripts = join(root, 'scripts'),
    bin = join(root, 'bin'),
    log = join(root, 'calls');
  await mkdir(scripts);
  await mkdir(bin);
  const original = fileURLToPath(
    new URL('../../../../../scripts/', import.meta.url),
  );
  for (const name of (await readdir(original)).filter((name) =>
    name.endsWith('.sh'),
  )) {
    await copyFile(join(original, name), join(scripts, name));
    await chmod(join(scripts, name), 0o755);
  }
  await writeFile(join(root, '.env'), '');
  await writeFile(join(root, 'docker-compose.yaml'), '');
  await writeFile(join(root, 'docker-compose.prod.yaml'), '');
  await writeFile(
    join(bin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_LOG"
case "$*" in *"run --rm migrate"*) if [ "$FAIL_MIGRATION" = 1 ]; then exit 7; fi ;; esac
exit 0
`,
  );
  await chmod(join(bin, 'docker'), 0o755);
  const invoke = (name: string, args: string[], fail = false) =>
    spawnSync('sh', [join(scripts, name), ...args], {
      env: {
        ...process.env,
        PATH: bin + ':' + process.env.PATH,
        TEST_LOG: log,
        FAIL_MIGRATION: fail ? '1' : '0',
      },
      encoding: 'utf8',
    });
  try {
    for (const name of (await readdir(scripts)).filter(
      (name) => name !== 'common.sh',
    ))
      for (const args of [[], ['--wrong'], ['--local', '--prod']])
        assert.notEqual(invoke(name, args).status, 0, name);
    assert.notEqual(invoke('deploy.sh', ['--local']).status, 0);
    for (const flag of ['--local', '--prod']) {
      for (const name of [
        'migrate.sh',
        'start.sh',
        'stop.sh',
        'status.sh',
        'logs.sh',
      ])
        assert.equal(invoke(name, [flag]).status, 0, name);
    }
    await writeFile(log, '');
    assert.equal(invoke('deploy.sh', ['--prod'], true).status, 7);
    const failed = await readFile(log, 'utf8');
    assert.match(failed, /pull\n/);
    assert.match(failed, /--profile migration run --rm migrate/);
    assert.doesNotMatch(failed, / up /);
    await writeFile(log, '');
    assert.equal(invoke('deploy.sh', ['--prod']).status, 0);
    const passed = (await readFile(log, 'utf8')).split('\n').filter(Boolean);
    assert.equal(passed.length, 3);
    assert.match(passed[0], /pull$/);
    assert.match(passed[1], /run --rm migrate$/);
    assert.match(passed[2], /up --no-build/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
