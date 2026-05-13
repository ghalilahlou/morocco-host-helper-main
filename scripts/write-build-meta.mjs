/**
 * Écrit dist/build-meta.json après le build pour détecter les nouveaux déploiements
 * (fetch no-store côté client sans dépendre du cache du bundle).
 */
import { writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) {
  console.warn('[write-build-meta] dist/ absent — skip (build incomplet ?)');
  process.exit(0);
}

let id =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  '';

if (!id) {
  try {
    id = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    id = `local-${Date.now()}`;
  }
}

const payload = JSON.stringify({
  id: String(id).slice(0, 64),
  builtAt: new Date().toISOString(),
});

writeFileSync(join(dist, 'build-meta.json'), payload, 'utf8');
console.log('[write-build-meta] dist/build-meta.json', payload.slice(0, 80) + '…');
