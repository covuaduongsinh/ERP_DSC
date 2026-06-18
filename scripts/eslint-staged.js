#!/usr/bin/env node

/**
 * Lint staged TS/TSX files using each file's *workspace-local* ESLint.
 *
 * This monorepo pins different ESLint majors per app (e.g. OTB uses ESLint 9 +
 * eslint-config-next 16 flat config, while most apps use ESLint 8). The repo-root
 * ESLint (v8) cannot parse the newer apps' configs, which broke the lint-staged
 * pre-commit hook. Grouping staged files by workspace and invoking that
 * workspace's own ESLint via `npx` fixes it without disabling linting.
 *
 * Usage (invoked by lint-staged): node scripts/eslint-staged.js <file> [<file> ...]
 */

const { spawnSync } = require('child_process');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

const root = process.cwd();

// Group files by their workspace dir (apps/<name> or packages/<name>); root otherwise.
const byPkg = new Map();
for (const file of files) {
  const abs = path.resolve(file);
  const rel = path.relative(root, abs).split(path.sep);
  let pkgDir = root;
  if ((rel[0] === 'apps' || rel[0] === 'packages') && rel[1]) {
    pkgDir = path.join(root, rel[0], rel[1]);
  }
  if (!byPkg.has(pkgDir)) byPkg.set(pkgDir, []);
  byPkg.get(pkgDir).push(abs);
}

for (const [pkgDir, list] of byPkg) {
  const rels = list.map((f) => path.relative(pkgDir, f));
  // shell:true is required on Windows so Node can launch the npx .cmd shim
  // (Node refuses to spawn .cmd/.bat directly with EINVAL on recent versions).
  const cmd = ['npx', 'eslint', '--fix', ...rels.map((r) => JSON.stringify(r))].join(' ');
  const res = spawnSync(cmd, { cwd: pkgDir, stdio: 'inherit', shell: true });
  if (res.status !== 0) process.exit(res.status || 1);
}
