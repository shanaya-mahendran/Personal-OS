#!/usr/bin/env node
/**
 * start-local.mjs
 *
 * Practical local-start helper for Shanaya OS.
 *
 * This does not magically install Supabase or Gemini. It validates the
 * likely prerequisites, prints the exact missing pieces, and then starts
 * the dev server only if the basics look healthy.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function bad(msg) {
  console.log(`  ✗ ${msg}`);
}

function section(title) {
  console.log(`\n${title}\n${'─'.repeat(title.length)}`);
}

function hasEnv(key) {
  if (!existsSync(envFile)) return { found: false, value: null };
  try {
    const raw = readFileSync(envFile, 'utf8');
    const match = raw.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
    if (!match) return { found: false, value: null };
    return { found: true, value: match[1].trim() };
  } catch {
    return { found: false, value: null };
  }
}

function lookHealthy(key) {
  const env = hasEnv(key);
  if (!env.found) return { ok: false, reason: `${key} is missing` };
  if (!env.value) return { ok: false, reason: `${key} is empty` };
  return { ok: true };
}

section('Shanaya OS — local start check');

const browserVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
const serverVars = ['SUPABASE_SERVICE_ROLE_KEY'];

let browserOk = 0;
let serverOk = 0;

for (const key of browserVars) {
  const check = lookHealthy(key);
  if (check.ok) {
    ok(`${key} is present`);
    browserOk++;
  } else {
    bad(`${key}: ${check.reason}`);
  }
}

for (const key of serverVars) {
  const check = lookHealthy(key);
  if (check.ok) {
    ok(`${key} is present`);
    serverOk++;
  } else {
    bad(`${key}: ${check.reason}`);
  }
}

const nodeOk = execSync('node --version', { encoding: 'utf8' }).trim();
ok(`node ${nodeOk}`);

let npmOk = false;
try {
  execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' });
  npmOk = true;
} catch {
  npmOk = false;
}
if (npmOk) ok('npm available'); else bad('npm not available');

section('Verdict');

const needs =
  browserVars.length - browserOk + serverVars.length - serverOk;

if (needs === 0) {
  console.log('\nBasic env looks present. Starting dev server...');
} else {
  console.log(
    `\n${needs} required value(s) look missing in .env.local. ` +
      'Start the dev server anyway?',
  );
}

const wantsDev = process.argv.includes('--yes') || process.argv.includes('-y');

if (!wantsDev) {
  console.log(
    '\nRun again with --yes to start anyway, or fix .env.local first.',
  );
  process.exitCode = 1;
  process.exit(0);
}

console.log('\nStarting: npm run dev');
try {
  execSync('npm run dev', { stdio: 'inherit' });
} catch {
  process.exitCode = 1;
}
