/** Bundles and runs the balance report (tools/balance.ts). */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'gj-balance-')), 'balance.mjs');
await build({
  entryPoints: ['tools/balance.ts'],
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
});
await import(`file://${out}`);
