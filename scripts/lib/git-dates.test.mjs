import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addedDates, hasHistory, lineDates } from './git-dates.mjs';

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], {
  env: { ...process.env, GIT_AUTHOR_DATE: '2026-08-01T12:00:00Z', GIT_COMMITTER_DATE: '2026-08-01T12:00:00Z' },
});

test('addedDates: the day a file was added, kept when it is moved; uncommitted files and no repository = unknown', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-git-'));
  try {
    assert.equal(await hasHistory(dir), false, 'no repository');
    assert.deepEqual(await addedDates(dir, ['a.yaml']), new Map());
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.test');
    git(dir, 'config', 'user.name', 'Test');
    await fs.writeFile(path.join(dir, 'a.yaml'), 'title: A\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'add');
    await fs.mkdir(path.join(dir, 'kolekce'));
    git(dir, 'mv', 'a.yaml', 'kolekce/a.yaml');
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'move'], {
      env: { ...process.env, GIT_AUTHOR_DATE: '2026-09-15T12:00:00Z', GIT_COMMITTER_DATE: '2026-09-15T12:00:00Z' },
    });
    await fs.writeFile(path.join(dir, 'b.yaml'), 'title: B\n');
    assert.equal(await hasHistory(dir), true);
    assert.deepEqual(await addedDates(dir, ['kolekce/a.yaml', 'b.yaml']), new Map([['kolekce/a.yaml', '2026-08-01']]));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('lineDates: the day a matching line last changed, following renames; none without such a change or history', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-git-'));
  const commit = (day, message) => execFileSync('git', ['-C', dir, 'commit', '-q', '-a', '-m', message], {
    env: { ...process.env, GIT_AUTHOR_DATE: `${day}T12:00:00Z`, GIT_COMMITTER_DATE: `${day}T12:00:00Z` },
  });
  try {
    assert.deepEqual(await lineDates(dir, ['a.yaml'], '^meta_instagram: true'), new Map(), 'no repository');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.test');
    git(dir, 'config', 'user.name', 'Test');
    await fs.writeFile(path.join(dir, 'a.yaml'), 'meta_instagram: false\ntitle: A\n');
    await fs.writeFile(path.join(dir, 'b.yaml'), 'meta_instagram: false\n');
    git(dir, 'add', '.');
    commit('2026-08-01', 'add');
    await fs.writeFile(path.join(dir, 'a.yaml'), 'meta_instagram: true\ntitle: A\n');
    commit('2026-09-10', 'on Instagram');
    await fs.writeFile(path.join(dir, 'a.yaml'), 'meta_instagram: true\ntitle: A2\n');
    commit('2026-09-20', 'another title');
    await fs.mkdir(path.join(dir, 'kolekce'));
    git(dir, 'mv', 'a.yaml', 'kolekce/a.yaml');
    commit('2026-10-01', 'move');
    assert.deepEqual(await lineDates(dir, ['kolekce/a.yaml', 'b.yaml'], '^meta_instagram: true'), new Map([['kolekce/a.yaml', '2026-09-10']]));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
