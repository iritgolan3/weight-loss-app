// Bundles the TypeScript test files with esbuild, then runs them under
// node --test. Keeps the game source as the single source of truth.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outdir = join(root, '.test-build');
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const tests = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
if (!tests.length) { console.log('no tests'); process.exit(0); }

await build({
  entryPoints: tests.map((f) => join(root, 'tests', f)),
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: 'inline',
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});

try {
  execFileSync(process.execPath, ['--test', ...tests.map((f) => join(outdir, f.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit' });
} catch {
  process.exit(1);
}
