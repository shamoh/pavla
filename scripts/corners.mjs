#!/usr/bin/env node
// The corner editor: a local page for clicking the corners of the sheet in the master photos of the content
// repository (scripts/corners.html, the server's side in scripts/lib/corner-editor.mjs). Reads the content
// repository, writes only meta_corners of the description the page asks for (after a confirmation on the page).
//
// Usage:  npm run corners [-- <content repository>] [--port 4327]
//   without a folder: CONTENT_DIR from .env; the server listens only on 127.0.0.1.

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { editorPage, route, trustedRequest } from './lib/corner-editor.mjs';
import { EDGE_DEFAULTS } from './lib/edges.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');
const contentDir = target ? path.resolve(process.env.INIT_CWD ?? process.cwd(), target) : path.resolve(siteRoot, process.env.CONTENT_DIR ?? '');
const port = Number(opt('--port') ?? 4327);
try {
  if (!target && !process.env.CONTENT_DIR) throw new Error('no content repository: npm run corners -- <folder>, or CONTENT_DIR in .env');
  await fs.access(path.join(contentDir, 'tvorba'));
  const config = YAML.parse(await fs.readFile(path.join(siteRoot, 'site.config.yaml'), 'utf8'));
  const edges = { ...EDGE_DEFAULTS, ...config.images?.edges };
  const page = editorPage(await fs.readFile(path.join(siteRoot, 'scripts', 'corners.html'), 'utf8'), edges);
  http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      if (!trustedRequest(req.method, req.headers, port)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('only the editor page itself may ask');
        return;
      }
      try {
        const r = await route(contentDir, page, req.method, req.url, Buffer.concat(chunks).toString('utf8'), { search: edges.search });
        res.writeHead(r.status, { 'content-type': r.type, 'cache-control': 'no-store' });
        res.end(r.body);
        if (req.method === 'POST' && r.status === 200) console.log(`Written: ${JSON.parse(r.body).written}`);
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }).on('error', (e) => {
    console.error(`✗ ${e.code === 'EADDRINUSE' ? `port ${port} is taken: npm run corners -- --port <another>` : e.message}`);
    process.exitCode = 1;
  }).listen(port, '127.0.0.1', () => console.log(`Corner editor of ${contentDir}: http://127.0.0.1:${port}/  (Ctrl+C to stop)`));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
