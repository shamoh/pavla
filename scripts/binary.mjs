#!/usr/bin/env node
// Binary branches (scripts/lib/binary.mjs): generated images kept out of the history, in `<branch>_binary` with a single commit.
//
// Usage (in this repo, the defaults: the images of the site, binary.lock, main_binary / obsah/aktualizace_binary):
//   npm run binary:pull                         the images of main into public/ (= unpack)
//   node scripts/binary.mjs unpack              the same; the branch whose tree binary.lock names
//   node scripts/binary.mjs pack <branch> [--push]   pack public/… into <branch>, write binary.lock
//   node scripts/binary.mjs promote             after a merge: main_binary gets the images binary.lock names,
//                                               then obsah/aktualizace_binary goes once main_binary has its commit
// For another repository (the content workflow): --dir <clone> --paths <a,b> [--lock <file>|--no-lock]
//   node scripts/binary.mjs unpack --dir ../obsah --paths export --no-lock --branch <b>_binary,main_binary
//   node scripts/binary.mjs pack <b>_binary --dir ../obsah --paths export --no-lock --push
//   node scripts/binary.mjs prune --dir ../obsah   deletes <x>_binary whose branch <x> is gone

import path from 'node:path';
import { SITE_BINARY, dropPromoted, pack, promote, pruneBinaries, unpack } from './lib/binary.mjs';

const args = process.argv.slice(2);
const command = args[0];
const opt = (name) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : undefined; };
const positional = args.slice(1).find((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--'));
const dir = path.resolve(process.env.INIT_CWD ?? process.cwd(), opt('--dir') ?? '.');
const paths = opt('--paths')?.split(',') ?? SITE_BINARY.paths;
const lock = args.includes('--no-lock') ? null : opt('--lock') ?? SITE_BINARY.lock;

try {
  if (command === 'pack') {
    if (!positional) throw new Error('pack needs the branch: node scripts/binary.mjs pack <branch> [--push]');
    const r = await pack({ dir, paths, branch: positional, push: args.includes('--push'), lock, message: opt('--message') ?? 'Binary files' });
    console.log(`${positional}: tree ${r.tree.slice(0, 7)}, commit ${r.commit.slice(0, 7)}${r.pushed ? ', pushed' : args.includes('--push') ? ', unchanged on origin' : ''}`);
  } else if (command === 'unpack') {
    const branches = opt('--branch')?.split(',') ?? [SITE_BINARY.main, SITE_BINARY.pending];
    const r = await unpack({ dir, paths, branches, lock });
    console.log(r ? `Restored ${paths.join(', ')} from ${r.branch} (tree ${r.tree.slice(0, 7)})` : `Nothing to restore: none of ${branches.join(', ')} exists yet`);
  } else if (command === 'promote') {
    const [from, to] = [opt('--from') ?? SITE_BINARY.pending, opt('--to') ?? SITE_BINARY.main];
    const r = await promote({ dir, from, to, lock: lock ?? SITE_BINARY.lock });
    console.log(r === 'promoted' ? 'The images of the merged update are main\'s now.' : 'main already has its images.');
    if (await dropPromoted({ dir, from, to })) console.log(`Deleted ${from}: ${to} has the same commit.`);
  } else if (command === 'prune') {
    const gone = await pruneBinaries({ dir });
    console.log(gone.length ? `Deleted: ${gone.join(', ')}` : 'No orphan binary branch.');
  } else {
    throw new Error('usage: node scripts/binary.mjs pack|unpack|promote|prune … (see the head of the script)');
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
