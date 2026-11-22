// main.ts — Vault Runner's hand-in program. Runs on Node 22 with the standard
// library only (the vendored make.fun library is the sole import): it copies
// game/ and screenshots/ into the output directory and writes dossier.json by
// buildDossier, byte for byte the same on every run.
//
// Locally the grader's /output is not writable, so MAKEFUN_OUTPUT_DIR stands in:
//   mkdir out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A deterministic tree copy: readdirSync is not sorted, and the grader compares
// runs byte for byte, so walk in code-unit order and copy files plainly.
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else writeFileSync(dst, readFileSync(src));
  }
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, 'game'), join(outDir, 'game'));
copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps, so the program fails where the scorer would refuse it.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
