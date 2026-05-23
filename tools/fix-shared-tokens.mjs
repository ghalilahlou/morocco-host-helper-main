/**
 * Désactive les tokens « bus partagé » (1 token_id → plusieurs booking_id).
 * Les soumissions passées restent en archive ; les liens /v/{token} ne fonctionnent plus.
 *
 * Usage:
 *   node tools/fix-shared-tokens.mjs           # désactive les 5 connus + tout token partagé détecté
 *   node tools/fix-shared-tokens.mjs --dry-run # aperçu seulement
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

const dryRun = process.argv.includes('--dry-run');

const KNOWN_SHARED_TOKEN_IDS = [
  '50d51c12-127c-4a93-9cd3-5d988175e47a',
  '5cc9acf4-c299-48e7-8ada-084e9932c7ab',
  '73a33917-1a1e-4c27-a4c0-b4b8c7441945',
  'aee301ed-6505-46f0-9d4f-4222634b8fe5',
  'f6309bc8-0c51-4856-b8b8-de7370c65470',
];

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function findAllSharedTokenIds() {
  const { data: subs, error } = await supabase
    .from('guest_submissions')
    .select('token_id, booking_id')
    .not('token_id', 'is', null);

  if (error) throw error;

  const byToken = new Map();
  for (const s of subs || []) {
    if (!byToken.has(s.token_id)) byToken.set(s.token_id, new Set());
    byToken.get(s.token_id).add(s.booking_id);
  }

  return [...byToken.entries()]
    .filter(([, bids]) => bids.size > 1)
    .map(([token_id, bids]) => ({ token_id, nb_bookings: bids.size }));
}

async function main() {
  const detected = await findAllSharedTokenIds();
  const toDeactivate = new Set([
    ...KNOWN_SHARED_TOKEN_IDS,
    ...detected.map((d) => d.token_id),
  ]);

  console.log(dryRun ? '\n=== DRY RUN ===' : '\n=== DÉSACTIVATION TOKENS PARTAGÉS ===');
  console.log('Tokens à désactiver:', toDeactivate.size);

  for (const tokenId of toDeactivate) {
    const { data: tok } = await supabase
      .from('property_verification_tokens')
      .select('id, token, is_active, property_id, booking_id, metadata')
      .eq('id', tokenId)
      .maybeSingle();

    const det = detected.find((d) => d.token_id === tokenId);
    console.log('\n---', tokenId);
    if (!tok) {
      console.log('  (ligne property_verification_tokens introuvable — peut-être déjà supprimé)');
      continue;
    }
    console.log('  token:', tok.token?.slice(0, 20) + '...');
    console.log('  is_active:', tok.is_active, '→ false');
    console.log('  booking_id:', tok.booking_id);
    console.log('  nb_bookings (submissions):', det?.nb_bookings ?? '?');

    if (!dryRun && tok.is_active) {
      const { error } = await supabase
        .from('property_verification_tokens')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(typeof tok.metadata === 'object' && tok.metadata ? tok.metadata : {}),
            deactivatedReason: 'shared_token_fix',
            deactivatedAt: new Date().toISOString(),
            sharedBookingsCount: det?.nb_bookings,
          },
        })
        .eq('id', tokenId);

      if (error) console.error('  ERREUR:', error.message);
      else console.log('  ✅ désactivé');
    } else if (!tok.is_active) {
      console.log('  (déjà inactif)');
    }
  }

  // Vérification post-fix
  if (!dryRun) {
    const { data: stillActive } = await supabase
      .from('property_verification_tokens')
      .select('id, is_active')
      .in('id', [...toDeactivate])
      .eq('is_active', true);

    console.log('\n=== VÉRIFICATION ===');
    console.log(
      stillActive?.length
        ? `⚠️ Encore actifs: ${stillActive.map((t) => t.id).join(', ')}`
        : '✅ Tous les tokens listés sont inactifs.'
    );

    const after = await findAllSharedTokenIds();
    const activeShared = [];
    for (const d of after) {
      const { data: t } = await supabase
        .from('property_verification_tokens')
        .select('is_active')
        .eq('id', d.token_id)
        .maybeSingle();
      if (t?.is_active) activeShared.push(d);
    }
    console.log(
      'Tokens partagés encore actifs:',
      activeShared.length ? activeShared : 'aucun'
    );
  }

  console.log(`
Prochaines étapes hôte:
1. Pour chaque séjour concerné, émettre un NOUVEAU lien depuis la fiche réservation (booking_id explicite).
2. Déployer issue-guest-link + submit-guest-info-unified (correctifs déjà dans le repo).
3. Exécuter la migration SQL idx_one_active_token_per_booking si pas encore faite.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
