/**
 * Génère public/og-checky.png (1200×630) pour les aperçus de liens (Open Graph).
 * Exécuter : node scripts/generate-og-assets.mjs  ou  npm run og:assets
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'src', 'assets', 'logo.png');
const publicDir = path.join(root, 'public');

const W = 1200;
const H = 630;

const GRADIENT_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a2038"/>
        <stop offset="55%" style="stop-color:#1a3d48"/>
        <stop offset="100%" style="stop-color:#2DBFB8"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`,
);

async function main() {
  if (!fs.existsSync(logoPath)) {
    console.error('Missing', logoPath);
    process.exit(1);
  }

  const baseBg = await sharp(GRADIENT_SVG).png().toBuffer();

  const logoW = Math.round(W * 0.45);
  const logoBuf = await sharp(logoPath)
    .resize(logoW, null, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(logoBuf).metadata();
  const lw = meta.width;
  const lh = meta.height;
  const left = Math.round((W - lw) / 2);
  const top = Math.round((H - lh) / 2);

  await sharp(baseBg)
    .composite([{ input: logoBuf, left, top }])
    .png()
    .toFile(path.join(publicDir, 'og-checky.png'));

  console.log('Wrote public/og-checky.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
