/**
 * Dud-bucket / free-energy checks for opponent tables (plan §1.8).
 * Uses Vitest + CardContentService (Vite `import.meta.glob`); not runnable as a plain Node ESM file.
 * Run: npm run build:opponent-piles
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('npx vitest run src/test/opponentPiles.coverage.test.ts', {
  cwd: root,
  stdio: 'inherit',
});
