#!/usr/bin/env node
/**
 * start-prod.mjs
 *
 * Convenience wrapper for running the standalone production build.
 *
 * Prerequisites:
 *   - npm run build has already produced a `standalone/` folder.
 *   - Runtime env vars (.env.local or host env) are configured.
 *
 * Usage:
 *   node scripts/start-prod.mjs
 *
 * This is not a deployment script. It just starts the compiled standalone
 * server locally so you can verify the built output before deploying.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standaloneServer = join(root, 'standalone', 'server.js');

const section = (title) => {
  console.log(`\n${title}\n${'─'.repeat(title.length)}`);
};

section('Shanaya OS — standalone host check');

if (!existsSync(standaloneServer)) {
  console.log(
    '\nstandalone/server.js not found. Run this first:\n\n  npm run build\n\nThen retry.',
  );
  process.exitCode = 1;
  process.exit(0);
}

ok('standalone/server.js found');

try {
  execSync('node --version', { encoding: 'utf8', stdio: 'pipe' });
  ok('node available');
} catch {
  bad('node not available');
  process.exitCode = 1;
}

section('Starting standalone server');

console.log(
  '\nIf this is your first run after build, make sure .env.local (or the host env) still has:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL\n' +
    '  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n' +
    '  SUPABASE_SERVICE_ROLE_KEY\n',
);

try {
  execSync('node standalone/server.js', {
    cwd: root,
    stdio: 'inherit',
  });
} catch {
  process.exitCode = 1;
}
