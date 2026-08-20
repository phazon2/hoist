import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('docs', { recursive: true });
await build({ entryPoints: ['web/main.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'docs/app.js', logLevel: 'warning' });
cpSync('web/index.html', 'docs/index.html');
cpSync('web/style.css', 'docs/style.css');
console.log('BUILD OK -> docs/');
