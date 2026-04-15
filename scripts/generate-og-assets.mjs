/**
 * Génère public/og-checky.png (1200×630) et public/og-checky.gif (animation légère)
 * pour les aperçus de liens (Telegram, WhatsApp, etc.).
 * Exécuter : node scripts/generate-og-assets.mjs
 */
import sharp from 'sharp';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'src', 'assets', 'logo.png');
const publicDir = path.join(root, 'public');

const W = 1200;
const H = 630;
const FRAMES = 24;
const FPS = 12;

// Charte Checky (tailwind) : hero-fallback → teal
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

  // --- PNG statique (logo centré, ~45% largeur) ---
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

  // --- GIF : léger pulse sur le logo (scale + opacité) ---
  const encoder = GIFEncoder();
  const delay = Math.round(1000 / FPS);

  for (let i = 0; i < FRAMES; i++) {
    const t = (i / FRAMES) * Math.PI * 2;
    const scale = 1 + 0.04 * Math.sin(t);
    const scaledW = Math.round(lw * scale);
    const scaledH = Math.round(lh * scale);
    const scaledLogo = await sharp(logoBuf)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .ensureAlpha()
      .png()
      .toBuffer();

    const xl = Math.round((W - scaledW) / 2);
    const yt = Math.round((H - scaledH) / 2);

    const frame = await sharp(baseBg)
      .composite([{ input: scaledLogo, left: xl, top: yt }])
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = frame;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    encoder.writeFrame(index, W, H, { palette, delay, first: i === 0 });
  }

  encoder.finish();
  const gifBuf = encoder.bytes();
  fs.writeFileSync(path.join(publicDir, 'og-checky.gif'), gifBuf);
  console.log('Wrote public/og-checky.gif');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
