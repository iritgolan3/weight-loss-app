/**
 * Builds the whole game into ONE self-contained .html file that runs from a
 * local double-click (file://) with no server, no install and no network.
 *
 * It bundles as an IIFE rather than an ES module on purpose: browsers block
 * module scripts loaded over file:// for CORS reasons, so a classic inline
 * script is the only thing that works from the filesystem.
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'dist-standalone');
mkdirSync(outDir, { recursive: true });

const result = await build({
  entryPoints: [join(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'safari15', 'edge100'],
  minify: true,
  legalComments: 'none',
  write: false,
  define: { 'import.meta.env.MODE': '"production"' },
});

const js = result.outputFiles[0].text;

// Start from the real index.html so the standalone build cannot drift from it.
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(
  /<script type="module" src="[^"]*"><\/script>/,
  `<script>\n${js}\n</script>`,
);
html = html.replace(
  '<title>GLASS JAW — Championship Boxing</title>',
  '<title>GLASS JAW — Championship Boxing</title>\n<!-- Single-file build: no install, no server, no assets. Just open it. -->',
);

const out = join(outDir, 'glass-jaw.html');
writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${out}  (${kb} KB, self-contained)`);
